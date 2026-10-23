"""Bounded subprocess coordinator; call from a request worker thread, never the event loop."""
from dataclasses import asdict
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time

from .document_parser_worker import ParserLimits

WORKER_PATH = Path(__file__).with_name("document_parser_worker.py")
_PARSER_SLOT = threading.BoundedSemaphore(1)
ERRORS = {
    "invalid": (422, "The resume could not be parsed. Try exporting it again as PDF or DOCX."),
    "encrypted": (422, "Password-protected resumes are not supported. Upload an unencrypted PDF or DOCX."),
    "limit": (413, "This resume exceeds processing limits. Upload a simpler document with fewer pages or images."),
    "timeout": (422, "This resume took too long to process. Try a simpler PDF or DOCX."),
    "busy": (429, "Another resume is being processed. Please try again shortly."),
    "unavailable": (503, "Resume processing is temporarily unavailable. Please try again later."),
}


class ResumeParseError(ValueError):
    def __init__(self, code):
        self.code = code if code in ERRORS else "invalid"
        self.status_code, message = ERRORS[self.code]
        super().__init__(message)


def _bounded_exchange(process, content, max_output, timeout):
    """Bound parent memory too, including a worker that stops reading or floods stdout."""
    output = []
    def send_input():
        try:
            process.stdin.write(content)
            process.stdin.close()
        except (OSError, ValueError):
            pass
    def read_output():
        try:
            output.append(process.stdout.read(max_output + 1))
        except (OSError, ValueError):
            output.append(b"")
    writer = threading.Thread(target=send_input, daemon=True)
    reader = threading.Thread(target=read_output, daemon=True)
    deadline = time.monotonic() + timeout
    writer.start()
    reader.start()
    try:
        reader.join(max(0, deadline - time.monotonic()))
        if reader.is_alive():
            raise ResumeParseError("timeout")
        if not output or len(output[0]) > max_output:
            raise ResumeParseError("limit")
        try:
            process.wait(timeout=max(0, deadline - time.monotonic()))
        except subprocess.TimeoutExpired as exc:
            raise ResumeParseError("timeout") from exc
        return output[0]
    finally:
        if process.poll() is None:
            process.kill()
        process.wait()
        writer.join()
        reader.join()
        for pipe in (process.stdin, process.stdout):
            try:
                pipe.close()
            except (OSError, ValueError):
                pass


def parse_resume(content: bytes, content_type: str, limits: ParserLimits | None = None) -> str:
    limits = limits or ParserLimits.from_environment()
    if len(content) > limits.max_input_bytes:
        raise ResumeParseError("limit")
    if not _PARSER_SLOT.acquire(blocking=False):
        raise ResumeParseError("busy")
    try:
        # Do not inherit database/Groq/Supabase credentials, proxy settings,
        # Python startup hooks, or other application environment in the worker.
        environment = {key: value for key, value in os.environ.items()
                       if key.upper() in {"SYSTEMROOT", "WINDIR", "TEMP", "TMP"}}
        try:
            process = subprocess.Popen(
                [sys.executable, "-I", "-B", str(WORKER_PATH), content_type, json.dumps(asdict(limits))],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                env=environment, cwd=WORKER_PATH.parent,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
        except OSError as exc:
            raise ResumeParseError("unavailable") from exc
        raw = _bounded_exchange(process, content, limits.max_text_chars * 4 + 2048, limits.timeout_seconds)
        if process.returncode != 0:
            raise ResumeParseError("limit")
        try:
            result = json.loads(raw)
        except (ValueError, UnicodeError, RecursionError) as exc:
            raise ResumeParseError("invalid") from exc
        if not isinstance(result, dict):
            raise ResumeParseError("invalid")
        if result.get("status") != "ok":
            raise ResumeParseError(result.get("code", "invalid"))
        text = result.get("text")
        if not isinstance(text, str) or len(text) > limits.max_text_chars:
            raise ResumeParseError("limit")
        return text
    finally:
        _PARSER_SLOT.release()
