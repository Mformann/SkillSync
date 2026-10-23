"""Standalone, resource-limited document worker. Documents enter/leave through pipes only."""
from dataclasses import dataclass
import io
import json
import math
import os
import sys
import zipfile


@dataclass(frozen=True)
class ParserLimits:
    timeout_seconds: float = 8.0
    memory_mb: int = 256
    max_input_bytes: int = 10 * 1024 * 1024
    max_text_chars: int = 200_000
    max_pdf_pages: int = 50
    max_archive_entries: int = 256
    max_expanded_bytes: int = 25 * 1024 * 1024
    max_compression_ratio: int = 200

    @classmethod
    def from_environment(cls):
        try:
            timeout = float(os.getenv("RESUME_PARSE_TIMEOUT_SECONDS", "8"))
            memory = int(os.getenv("RESUME_PARSE_MEMORY_MB", "256"))
        except ValueError as exc:
            raise RuntimeError("Invalid resume parser resource configuration.") from exc
        if not 1 <= timeout <= 15 or not 128 <= memory <= 512:
            raise RuntimeError("Resume parser timeout must be 1–15 seconds and memory 128–512 MB.")
        return cls(timeout_seconds=timeout, memory_mb=memory)


class DocumentRejected(Exception):
    def __init__(self, code):
        self.code = code


_JOB_HANDLE = None


def apply_resource_limits(limits):
    """Fail closed if the platform cannot enforce a process memory ceiling."""
    memory_bytes = limits.memory_mb * 1024 * 1024
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        class BasicLimits(ctypes.Structure):
            _fields_ = [
                ("PerProcessUserTimeLimit", ctypes.c_int64), ("PerJobUserTimeLimit", ctypes.c_int64),
                ("LimitFlags", wintypes.DWORD), ("MinimumWorkingSetSize", ctypes.c_size_t),
                ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", wintypes.DWORD),
                ("Affinity", ctypes.c_size_t), ("PriorityClass", wintypes.DWORD),
                ("SchedulingClass", wintypes.DWORD),
            ]

        class IoCounters(ctypes.Structure):
            _fields_ = [(name, ctypes.c_uint64) for name in (
                "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
                "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]

        class ExtendedLimits(ctypes.Structure):
            _fields_ = [("BasicLimitInformation", BasicLimits), ("IoInfo", IoCounters),
                        ("ProcessMemoryLimit", ctypes.c_size_t), ("JobMemoryLimit", ctypes.c_size_t),
                        ("PeakProcessMemoryUsed", ctypes.c_size_t), ("PeakJobMemoryUsed", ctypes.c_size_t)]

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
        kernel.CreateJobObjectW.restype = wintypes.HANDLE
        kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
        kernel.SetInformationJobObject.restype = wintypes.BOOL
        kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        kernel.AssignProcessToJobObject.restype = wintypes.BOOL
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel.CreateJobObjectW(None, None)
        if not handle:
            raise OSError("Cannot create parser resource job.")
        info = ExtendedLimits()
        info.BasicLimitInformation.LimitFlags = 0x100 | 0x2 | 0x8  # process memory, CPU time, process count
        info.BasicLimitInformation.PerProcessUserTimeLimit = math.ceil(limits.timeout_seconds + 1) * 10_000_000
        info.BasicLimitInformation.ActiveProcessLimit = 1
        info.ProcessMemoryLimit = memory_bytes
        if not kernel.SetInformationJobObject(handle, 9, ctypes.byref(info), ctypes.sizeof(info)) or not kernel.AssignProcessToJobObject(handle, kernel.GetCurrentProcess()):
            kernel.CloseHandle(handle)
            raise OSError("Cannot enforce parser resource job.")
        global _JOB_HANDLE
        _JOB_HANDLE = handle  # Retain the job for the entire process lifetime.
    elif sys.platform.startswith("linux"):
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
        cpu = math.ceil(limits.timeout_seconds + 1)
        resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    else:
        raise OSError("This platform has no supported parser resource isolation.")


def validate_docx_archive(content, limits):
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        entries = archive.infolist()
        if len(entries) > limits.max_archive_entries:
            raise DocumentRejected("limit")
        names = {entry.filename for entry in entries}
        if not {"[Content_Types].xml", "_rels/.rels", "word/document.xml"} <= names:
            raise DocumentRejected("invalid")
        claimed = actual = 0
        for entry in entries:
            if entry.flag_bits & 1:
                raise DocumentRejected("encrypted")
            if entry.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}:
                raise DocumentRejected("invalid")
            if ".." in entry.filename.replace("\\", "/").split("/") or entry.filename.startswith(("/", "\\")):
                raise DocumentRejected("invalid")
            claimed += entry.file_size
            if claimed > limits.max_expanded_bytes or entry.file_size > max(1, entry.compress_size) * limits.max_compression_ratio:
                raise DocumentRejected("limit")
            # Check actual expansion as well as attacker-controlled ZIP metadata.
            with archive.open(entry) as part:
                while chunk := part.read(min(64 * 1024, limits.max_expanded_bytes - actual + 1)):
                    actual += len(chunk)
                    if actual > limits.max_expanded_bytes:
                        raise DocumentRejected("limit")


def docx_text(document):
    """Physical XML cells occur once, unlike row.cells aliases for merged cells.

    Unique headers precede the body; unique footers follow it. Drawing text,
    images, embedded objects and external relationships are intentionally ignored.
    """
    from docx.oxml.ns import qn
    from docx.opc.constants import RELATIONSHIP_TYPE as RT
    from docx.text.paragraph import Paragraph

    def blocks(element):
        for child in element:
            if child.tag == qn("w:p"):
                yield Paragraph(child, document).text
            elif child.tag == qn("w:tbl"):
                for row in child.findall(qn("w:tr")):
                    for cell in row.findall(qn("w:tc")):
                        yield from blocks(cell)

    parts = {RT.HEADER: [], RT.FOOTER: []}
    seen = set()
    for relation in document.part.rels.values():
        if relation.is_external or relation.reltype not in parts:
            continue
        part = relation.target_part
        if part.partname not in seen:
            seen.add(part.partname)
            parts[relation.reltype].append(part.element)
    for header in parts[RT.HEADER]:
        yield from blocks(header)
    yield from blocks(document.element.body)
    for footer in parts[RT.FOOTER]:
        yield from blocks(footer)


def extract_document(content, content_type, limits):
    if len(content) > limits.max_input_bytes:
        raise DocumentRejected("limit")
    if content_type == "application/pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            raise DocumentRejected("encrypted")
        if len(reader.pages) > limits.max_pdf_pages:
            raise DocumentRejected("limit")
        pieces = (page.extract_text() or "" for page in reader.pages)
    elif content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        validate_docx_archive(content, limits)
        from docx import Document
        document = Document(io.BytesIO(content))
        pieces = docx_text(document)
    else:
        raise DocumentRejected("invalid")
    output = []
    size = 0
    for piece in pieces:
        size += len(piece) + bool(output)
        if size > limits.max_text_chars:
            raise DocumentRejected("limit")
        output.append(piece)
    return "\n".join(output)


def main():
    try:
        content_type = sys.argv[1]
        limits = ParserLimits(**json.loads(sys.argv[2]))
        try:
            apply_resource_limits(limits)
        except (OSError, ValueError):
            raise DocumentRejected("unavailable")
        content = sys.stdin.buffer.read(limits.max_input_bytes + 1)
        result = {"status": "ok", "text": extract_document(content, content_type, limits)}
    except DocumentRejected as exc:
        result = {"status": "error", "code": exc.code}
    except MemoryError:
        result = {"status": "error", "code": "limit"}
    except Exception:
        result = {"status": "error", "code": "invalid"}
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    main()
