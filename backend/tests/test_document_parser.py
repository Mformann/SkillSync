import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import io
import json
from pathlib import Path
import threading
import time
import zipfile

from docx import Document
from fastapi.testclient import TestClient
import httpx
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.auth_utils import AuthenticatedUser, get_current_user
from app.database import Base, get_session
from app.main import create_app
from app.services import document_parser as parser
from app.services.document_parser_worker import ParserLimits

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
TEXT = "Synthetic QA candidate built reliable Python APIs and SQL services with automated tests."


def docx_content(text=TEXT):
    document = Document()
    document.add_paragraph(text)
    output = io.BytesIO()
    document.save(output)
    return output.getvalue()


def pdf_content(pages=1, encrypted=False):
    writer = PdfWriter()
    for _ in range(pages):
        page = writer.add_blank_page(width=300, height=200)
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 10 100 Td ({TEXT}) Tj ET".encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    if encrypted:
        writer.encrypt("synthetic-password")
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def assert_rejected(content, content_type, code, limits=None):
    with pytest.raises(parser.ResumeParseError) as error:
        parser.parse_resume(content, content_type, limits)
    assert error.value.code == code
    return error.value


def test_normal_docx_and_pdf_parse_in_bounded_worker():
    assert parser.parse_resume(docx_content(), DOCX) == TEXT
    assert TEXT in parser.parse_resume(pdf_content(), "application/pdf")


@pytest.mark.parametrize("content,content_type", [(b"PKnot-a-zip", DOCX), (b"%PDF-broken", "application/pdf"), (b"plain text", "text/plain")])
def test_malformed_documents_are_recoverable(content, content_type):
    assert assert_rejected(content, content_type, "invalid").status_code == 422


def test_password_protected_pdf_has_specific_error():
    assert assert_rejected(pdf_content(encrypted=True), "application/pdf", "encrypted").status_code == 422


def test_pdf_page_limit():
    assert_rejected(pdf_content(pages=2), "application/pdf", "limit", replace(ParserLimits(), max_pdf_pages=1))


@pytest.mark.parametrize("content_type", [DOCX, "application/pdf"])
def test_extracted_text_is_bounded(content_type):
    content = docx_content() if content_type == DOCX else pdf_content()
    assert_rejected(content, content_type, "limit", replace(ParserLimits(), max_text_chars=30))


def test_docx_archive_expansion_limit():
    assert_rejected(docx_content(), DOCX, "limit", replace(ParserLimits(), max_expanded_bytes=1000))


def test_highly_compressed_docx_is_rejected_before_xml_parsing():
    assert_rejected(docx_content("A" * 500_000), DOCX, "limit")


def test_docx_archive_entry_limit():
    content = io.BytesIO(docx_content())
    with zipfile.ZipFile(content, "a") as archive:
        for index in range(260):
            archive.writestr(f"extra/{index}.xml", "x")
    assert_rejected(content.getvalue(), DOCX, "limit")


def test_input_limit_does_not_launch_a_worker(monkeypatch):
    monkeypatch.setattr(parser.subprocess, "Popen", lambda *a, **k: pytest.fail("Oversized input launched a worker"))
    assert_rejected(b"x" * 101, DOCX, "limit", replace(ParserLimits(), max_input_bytes=100))


def helper_worker(tmp_path, monkeypatch, source):
    path = tmp_path / "synthetic_worker.py"
    path.write_text(source, encoding="utf-8")
    monkeypatch.setattr(parser, "WORKER_PATH", path)
    original = parser.subprocess.Popen
    processes = []
    started = threading.Event()
    def spawn(*args, **kwargs):
        process = original(*args, **kwargs)
        processes.append(process)
        started.set()
        return process
    monkeypatch.setattr(parser.subprocess, "Popen", spawn)
    return processes, started


def test_timeout_kills_worker_and_releases_parser_capacity(tmp_path, monkeypatch):
    processes, started = helper_worker(tmp_path, monkeypatch,
        "import sys,time\nsys.stdin.buffer.read()\ntime.sleep(30)\n")
    limits = replace(ParserLimits(), timeout_seconds=0.6)
    def first():
        return assert_rejected(b"fixture", DOCX, "timeout", limits)
    with ThreadPoolExecutor(max_workers=1) as executor:
        task = executor.submit(first)
        assert started.wait(3)
        assert assert_rejected(b"fixture", DOCX, "busy").status_code == 429
        assert task.result(timeout=4).status_code == 422
    assert processes[0].poll() is not None
    monkeypatch.setattr(parser, "WORKER_PATH", Path(parser.__file__).with_name("document_parser_worker.py"))
    assert parser.parse_resume(docx_content(), DOCX) == TEXT


def test_worker_output_cannot_flood_parent_memory(tmp_path, monkeypatch):
    processes, _ = helper_worker(tmp_path, monkeypatch,
        "import sys,time\nsys.stdin.buffer.read()\nsys.stdout.buffer.write(b'x'*2_000_000)\nsys.stdout.buffer.flush()\ntime.sleep(30)\n")
    start = time.monotonic()
    assert_rejected(b"fixture", DOCX, "limit")
    assert time.monotonic() - start < 4
    assert processes[0].poll() is not None


def test_worker_without_stdin_reads_is_also_killed_on_deadline(tmp_path, monkeypatch):
    processes, _ = helper_worker(tmp_path, monkeypatch, "import time\ntime.sleep(30)\n")
    assert_rejected(b"x" * 1_000_000, DOCX, "timeout", replace(ParserLimits(), timeout_seconds=0.6))
    assert processes[0].poll() is not None


def test_worker_does_not_inherit_application_secrets(tmp_path, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "synthetic-secret")
    monkeypatch.setenv("DATABASE_URL", "synthetic-secret")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "synthetic-secret")
    helper_worker(tmp_path, monkeypatch,
        "import os,sys,json\nsys.stdin.buffer.read()\n"
        "assert not any(k in os.environ for k in ['GROQ_API_KEY','DATABASE_URL','SUPABASE_PUBLISHABLE_KEY'])\n"
        "print(json.dumps({'status':'ok','text':'environment-isolated'}))\n")
    assert parser.parse_resume(b"fixture", DOCX) == "environment-isolated"


def test_os_memory_limit_is_enforced_in_child(tmp_path, monkeypatch):
    worker = str(Path(parser.__file__).with_name("document_parser_worker.py"))
    source = f"import runpy,json,sys\nns=runpy.run_path({worker!r})\n"
    source += "limits=ns['ParserLimits'](**json.loads(sys.argv[2]))\nns['apply_resource_limits'](limits)\nsys.stdin.buffer.read()\n"
    source += "try:\n memory=bytearray(160*1024*1024)\n print(json.dumps({'status':'ok','text':'MEMORY LIMIT FAILED'}))\n"
    source += "except MemoryError:\n print(json.dumps({'status':'error','code':'limit'}))\n"
    processes, _ = helper_worker(tmp_path, monkeypatch, source)
    assert_rejected(b"fixture", DOCX, "limit", replace(ParserLimits(), memory_mb=128))
    assert processes[0].poll() is not None


def test_resource_isolation_failure_is_closed(tmp_path, monkeypatch):
    worker = str(Path(parser.__file__).with_name("document_parser_worker.py"))
    source = f"import runpy\nns=runpy.run_path({worker!r})\n"
    source += "def unavailable(_):\n raise OSError('synthetic setup failure')\n"
    source += "ns['main'].__globals__['apply_resource_limits']=unavailable\nns['main']()\n"
    helper_worker(tmp_path, monkeypatch, source)
    assert assert_rejected(b"fixture", DOCX, "unavailable").status_code == 503


@pytest.fixture
def api_environment():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    app = create_app()
    def database():
        with factory() as session:
            yield session
    app.dependency_overrides[get_session] = database
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id="synthetic-parser-user")
    yield app, factory
    engine.dispose()


def test_failed_document_processing_does_not_create_records(api_environment):
    app, factory = api_environment
    response = TestClient(app).post("/resume/upload",
        data={"job_role": "Backend engineer", "job_description": "Require Python and SQL expertise to develop reliable backend services and automated tests."},
        files={"file": ("resume.pdf", b"%PDF-broken", "application/pdf")})
    assert response.status_code == 422
    with factory() as session:
        for model in (models.TargetJob, models.Resume, models.Analysis):
            assert session.query(model).count() == 0


def test_upload_parser_does_not_block_health_requests(api_environment, tmp_path, monkeypatch):
    app, _ = api_environment
    processes, started = helper_worker(tmp_path, monkeypatch, "import sys,time\nsys.stdin.buffer.read()\ntime.sleep(30)\n")
    monkeypatch.setenv("RESUME_PARSE_TIMEOUT_SECONDS", "2")
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://qa") as client:
            upload = asyncio.create_task(client.post("/resume/upload",
                data={"job_role": "Backend engineer", "job_description": "Require Python and SQL expertise to develop reliable backend services and automated tests."},
                files={"file": ("resume.pdf", b"%PDF-fixture", "application/pdf")}))
            assert await asyncio.to_thread(started.wait, 2)
            health = await asyncio.wait_for(client.get("/health"), timeout=1)
            assert health.status_code == 200
            assert not upload.done()
            assert (await upload).status_code == 422
    asyncio.run(scenario())
    assert processes[0].poll() is not None


@pytest.mark.parametrize("key,value", [("RESUME_PARSE_TIMEOUT_SECONDS", "nan"), ("RESUME_PARSE_TIMEOUT_SECONDS", "0"),
    ("RESUME_PARSE_MEMORY_MB", "unlimited"), ("RESUME_PARSE_MEMORY_MB", "1024")])
def test_invalid_parser_limits_fail_configuration(monkeypatch, key, value):
    monkeypatch.setenv(key, value)
    with pytest.raises(RuntimeError):
        ParserLimits.from_environment()
