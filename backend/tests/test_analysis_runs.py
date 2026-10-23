"""Phase 3 regressions: durable accounting, concurrent workers and current inputs."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
import multiprocessing
import os
import threading
import time
import uuid

from fastapi import Header, HTTPException
from fastapi.testclient import TestClient
import httpx
import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from app import models, growth_models  # register metadata
from app.auth_utils import AuthenticatedUser, get_current_user
from app.database import Base, get_session
from app.main import create_app
from app.services import analysis_runs as runs
from app.services import ai_analysis_service as ai

JOB = "We require Python and Docker expertise for reliable production application delivery."
RESUME = "Alex Example\nalex@example.com\nBuilt production Python APIs and automated SQL tests for internal teams."


@pytest.fixture(params=["sqlite", "postgresql"])
def environment(request, tmp_path, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("GROQ_API_KEY", "synthetic-test-key")
    monkeypatch.setenv("AI_DAILY_ANALYSIS_LIMIT", "5")
    schema = None
    if request.param == "postgresql":
        url = os.getenv("ANALYSIS_TEST_DATABASE_URL")
        if not url:
            pytest.skip("Set ANALYSIS_TEST_DATABASE_URL to a disposable PostgreSQL database.")
        schema = "analysis_qa_" + uuid.uuid4().hex
        admin = create_engine(url)
        with admin.begin() as connection:
            connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
        engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    else:
        url = "sqlite:///" + str(tmp_path / "runs.db")
        engine = create_engine(url, connect_args={"check_same_thread": False})
        @event.listens_for(engine, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    app = create_app()
    def sessions():
        with factory() as db:
            yield db
    def identity(x_test_user: str = Header(default="candidate-a")):
        return AuthenticatedUser(id=x_test_user, email="synthetic@example.com")
    app.dependency_overrides[get_session] = sessions
    app.dependency_overrides[get_current_user] = identity
    with factory() as db:
        job = models.TargetJob(user_id="candidate-a", title="Python engineer", description=JOB, ai_consent=True)
        db.add(job); db.flush()
        resume = models.Resume(user_id="candidate-a", target_job_id=job.id, filename="synthetic.docx",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size_bytes=100, extracted_text=RESUME)
        db.add(resume); db.flush()
        analysis = models.Analysis(user_id="candidate-a", target_job_id=job.id, resume_id=resume.id, resume_text=RESUME)
        db.add(analysis); db.commit()
        aid, wid = analysis.id, job.id
    client = TestClient(app)
    yield client, factory, aid, wid, url, schema
    client.close()
    engine.dispose()
    if schema:
        with admin.begin() as connection:
            connection.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
        admin.dispose()


@pytest.fixture
def provider(monkeypatch):
    calls = []
    async def analyze(self, job, resume):
        calls.append((job, resume))
        return ai.RuleBasedProvider().analyze(job, resume)
    monkeypatch.setattr(ai.GroqProvider, "analyze_async", analyze)
    return calls


def endpoint(aid):
    return f"/resume/analysis/{aid}/run"


def duplicate_analysis(factory, aid, user_id="candidate-a", consent=None):
    with factory() as db:
        source = db.get(models.Analysis, aid)
        if user_id == source.user_id:
            wid, rid = source.target_job_id, source.resume_id
        else:
            job = models.TargetJob(user_id=user_id, title="Other role", description=JOB, ai_consent=True)
            db.add(job); db.flush()
            wid, rid = job.id, None
        if consent is not None:
            db.get(models.TargetJob, wid).ai_consent = consent
        analysis = models.Analysis(user_id=user_id, target_job_id=wid, resume_id=rid, resume_text=RESUME)
        db.add(analysis); db.commit()
        return analysis.id


def test_forced_runs_cannot_reset_allowance_and_cache_is_free(environment, provider, monkeypatch):
    client, factory, aid, *_ = environment
    monkeypatch.setenv("AI_DAILY_ANALYSIS_LIMIT", "1")
    first = client.post(endpoint(aid)).json()
    assert first["status"] == "completed_ai"
    assert client.post(endpoint(aid)).json()["input_hash"] == first["input_hash"]
    second = client.post(endpoint(aid), params={"force": True}).json()
    assert second["status"] == "completed_fallback"
    assert len(provider) == 1
    with factory() as db:
        assert db.query(models.AIUsage).count() == 1
        assert db.query(models.AIUsage).one().status == "dispatched"
        assert db.query(models.AnalysisRun).count() == 2
        assert db.query(models.AnalysisRun).filter(models.AnalysisRun.active_analysis_id.isnot(None)).count() == 0


def test_failed_provider_attempt_still_consumes_allowance(environment, monkeypatch):
    client, factory, aid, *_ = environment
    calls = []
    async def failed(*_):
        calls.append(True)
        raise ai.ProviderUnavailable("Synthetic outage")
    monkeypatch.setattr(ai.GroqProvider, "analyze_async", failed)
    monkeypatch.setenv("AI_DAILY_ANALYSIS_LIMIT", "1")
    for _ in range(2):
        assert client.post(endpoint(aid), params={"force": True}).json()["status"] == "completed_fallback"
    assert len(calls) == 1
    with factory() as db:
        assert db.query(models.AIUsage).one().dispatched_at is not None


def test_consent_off_and_unconfigured_provider_do_not_reserve(environment, provider, monkeypatch):
    client, factory, aid, wid, *_ = environment
    client.patch(f"/workspaces/{wid}", json={"ai_consent": False}).raise_for_status()
    assert client.post(endpoint(aid)).json()["provider"] == "rule_based"
    client.patch(f"/workspaces/{wid}", json={"ai_consent": True}).raise_for_status()
    monkeypatch.delenv("GROQ_API_KEY")
    assert client.post(endpoint(aid)).json()["provider"] == "rule_based"
    with factory() as db:
        assert db.query(models.AIUsage).count() == 0
    monkeypatch.setenv("GROQ_API_KEY", "synthetic-restored-key")
    assert client.get(f"/resume/analysis/{aid}/explainable").json()["stale"] is True
    assert client.post(endpoint(aid)).json()["provider"] == "groq"
    assert len(provider) == 1


def test_same_inputs_cache_per_user_and_other_users_have_independent_allowance(environment, provider, monkeypatch):
    client, factory, aid, *_ = environment
    monkeypatch.setenv("AI_DAILY_ANALYSIS_LIMIT", "1")
    client.post(endpoint(aid)).raise_for_status()
    copy = duplicate_analysis(factory, aid)
    assert client.post(endpoint(copy)).json()["status"] == "completed_cached"
    other = duplicate_analysis(factory, aid, "candidate-b")
    assert client.post(endpoint(other), headers={"X-Test-User": "candidate-b"}).json()["provider"] == "groq"
    assert len(provider) == 2
    for path in (endpoint(other), f"/resume/analysis/{other}/explainable"):
        response = client.post(path) if path.endswith("/run") else client.get(path)
        assert response.status_code == 404


def test_concurrent_requests_share_one_active_run_and_transaction_is_not_held(environment, monkeypatch):
    client, factory, aid, wid, *_ = environment
    entered, release = threading.Event(), threading.Event()
    calls = []
    async def slow(self, job, resume):
        calls.append(True)
        with factory() as db:
            assert db.query(models.AIUsage).one().status == "dispatched"
        entered.set()
        await asyncio.to_thread(release.wait, 4)
        return ai.RuleBasedProvider().analyze(job, resume)
    monkeypatch.setattr(ai.GroqProvider, "analyze_async", slow)
    with ThreadPoolExecutor() as pool:
        first = pool.submit(client.post, endpoint(aid))
        assert entered.wait(3)
        try:
            duplicate = client.post(endpoint(aid), params={"force": True}).json()
            status = client.get(f"/resume/analysis/{aid}/explainable").json()
            assert duplicate["status"] == status["status"] == "processing"
            assert duplicate["run"]["id"] == status["run"]["id"]
            # A workspace update can commit while provider I/O is outstanding.
            client.patch(f"/workspaces/{wid}", json={"is_archived": True}).raise_for_status()
        finally:
            release.set()
        assert first.result(timeout=5).json()["status"] == "completed_ai"
    assert len(calls) == 1


def worker_attempt(arguments):
    """Spawned processes have no shared Python locks or ORM sessions."""
    url, schema, aid, barrier = arguments
    os.environ["GROQ_API_KEY"] = "synthetic-test-key"
    os.environ["AI_DAILY_ANALYSIS_LIMIT"] = "1"
    kwargs = {"connect_args": {"options": f"-csearch_path={schema}"}} if schema else {}
    engine = create_engine(url, **kwargs)
    barrier.wait(timeout=15)
    with sessionmaker(bind=engine)() as db:
        start = runs.reserve(db, aid, "candidate-a", force=True)
        result = bool(start.run_id and runs.dispatch(db, start.run_id, "candidate-a").external)
    engine.dispose()
    return result


@pytest.mark.parametrize("same_analysis", [True, False])
def test_multiple_processes_cannot_duplicate_or_overreserve(environment, same_analysis):
    _, factory, aid, _, url, schema = environment
    other = aid if same_analysis else duplicate_analysis(factory, aid)
    context = multiprocessing.get_context("spawn")
    with context.Manager() as manager:
        barrier = manager.Barrier(2)
        with context.Pool(2) as pool:
            results = pool.map(worker_attempt, [(url, schema, number, barrier) for number in (aid, other)])
    assert sum(results) == 1
    with factory() as db:
        assert db.query(models.AIUsage).count() == 1


def test_revoked_consent_before_dispatch_releases_reservation(environment):
    client, factory, aid, wid, *_ = environment
    with factory() as db:
        start = runs.reserve(db, aid, "candidate-a")
        client.patch(f"/workspaces/{wid}", json={"ai_consent": False}).raise_for_status()
        with pytest.raises(HTTPException) as error:
            runs.dispatch(db, start.run_id, "candidate-a")
        assert error.value.status_code == 409
        db.expire_all()
        assert db.get(models.AIUsage, start.run_id).status == "released"


@pytest.mark.parametrize("dispatched", [False, True])
def test_expired_lease_never_retries_and_keeps_dispatched_usage(environment, provider, dispatched):
    client, factory, aid, *_ = environment
    with factory() as db:
        start = runs.reserve(db, aid, "candidate-a")
        if dispatched:
            assert runs.dispatch(db, start.run_id, "candidate-a").external
        run = db.get(models.AnalysisRun, start.run_id)
        run.lease_expires_at = runs.utc_now() - timedelta(seconds=1)
        db.commit()
    for _ in range(2):
        status = client.get(f"/resume/analysis/{aid}/explainable").json()
        assert status["status"] == "failed"
        assert status["run"]["status"] == "expired"
    with factory() as db:
        usage = db.get(models.AIUsage, start.run_id)
        assert usage.status == ("dispatched" if dispatched else "released")
        late = ai.ProviderResult(ai.RuleBasedProvider().analyze(JOB, RESUME), "groq", "synthetic")
        assert runs.finish(db, start.run_id, "candidate-a", late)["result"] is None
    assert provider == []


@pytest.mark.parametrize("change", ["description", "title", "company", "consent", "resume", "model", "prompt", "scoring", "policy"])
def test_every_processing_input_invalidates_results(environment, provider, monkeypatch, change):
    client, factory, aid, wid, *_ = environment
    first = client.post(endpoint(aid)).json()
    if change == "description":
        client.patch(f"/workspaces/{wid}", json={"description": "We require Kubernetes expertise to run production distributed systems reliably."}).raise_for_status()
    elif change in {"title", "company"}:
        client.patch(f"/workspaces/{wid}", json={change: "Updated synthetic target"}).raise_for_status()
    elif change == "consent":
        client.patch(f"/workspaces/{wid}", json={"ai_consent": False}).raise_for_status()
    elif change == "resume":
        with factory() as db:
            db.get(models.Analysis, aid).resume.extracted_text += "\nBuilt Docker containers."
            db.commit()
    elif change == "model":
        monkeypatch.setenv("GROQ_MODEL", "synthetic-model-2")
    else:
        monkeypatch.setattr(ai, {"prompt": "PROMPT_VERSION", "scoring": "SCORING_VERSION", "policy": "PROCESSING_POLICY"}[change], "synthetic-version-2")
    current = client.get(f"/resume/analysis/{aid}/explainable").json()
    assert current["stale"] and current["status"] == "stale"
    assert current["result"] is None and current["scores"] is None
    refreshed = client.post(endpoint(aid)).json()
    assert refreshed["input_hash"] != first["input_hash"]
    assert not refreshed["stale"]
    if change == "description":
        assert [item["name"] for item in refreshed["result"]["requirements"]] == ["Kubernetes"]


@pytest.mark.parametrize("revoke", [False, True])
def test_result_finishing_after_input_or_consent_change_is_superseded(environment, monkeypatch, revoke):
    client, factory, aid, wid, *_ = environment
    entered, release = threading.Event(), threading.Event()
    async def slow(self, job, resume):
        entered.set(); await asyncio.to_thread(release.wait, 4)
        return ai.RuleBasedProvider().analyze(job, resume)
    monkeypatch.setattr(ai.GroqProvider, "analyze_async", slow)
    with ThreadPoolExecutor() as pool:
        first = pool.submit(client.post, endpoint(aid))
        assert entered.wait(3)
        try:
            patch = {"ai_consent": False} if revoke else {"description": "We require Kubernetes expertise to operate production distributed systems safely."}
            client.patch(f"/workspaces/{wid}", json=patch).raise_for_status()
        finally:
            release.set()
        response = first.result(timeout=5).json()
    assert response["result"] is None and response["status"] == "stale"
    assert response["run"]["status"] == "superseded"
    with factory() as db:
        assert db.query(models.AIUsage).one().status == "dispatched"


def test_saved_edits_and_completed_evidence_survive_refresh(environment, provider):
    client, factory, aid, wid, *_ = environment
    client.post(endpoint(aid)).raise_for_status()
    plan_body = {"analysis_id": aid, "hours_per_week": 7, "target_date": str(date.today() + timedelta(days=40)), "experience_level": "intermediate"}
    plan = client.post("/learning/plans", json=plan_body).json()
    task = plan["tasks"][0]
    completion = {"progress": 100, "evidence_url": "https://example.com/synthetic-proof", "reflection": "I built and tested a complete containerized application."}
    client.patch(f"/learning/tasks/{task['id']}", json=completion).raise_for_status()
    version = client.post(f"/resume-studio/analyses/{aid}/versions", json={}).json()
    version["content"]["basics"]["email"] = "edited@example.com"
    client.patch(f"/resume-studio/versions/{version['id']}", json={key: version[key] for key in ("name", "template", "content")}).raise_for_status()
    package = client.post(f"/product/workspaces/{wid}/package").json()
    package["content"]["follow_up"] = "My saved, personally edited follow-up."
    client.patch(f"/product/packages/{package['id']}", json={"content": package["content"]}).raise_for_status()
    client.patch(f"/workspaces/{wid}", json={"description": "We require Kubernetes and Docker expertise for production application delivery."}).raise_for_status()
    assert client.post("/learning/plans", json=plan_body).status_code == 409
    assert client.post(f"/resume-studio/analyses/{aid}/versions", json={}).status_code == 409
    assert client.get(f"/learning/plans/by-analysis/{aid}").json()["stale"]
    saved_package = client.get(f"/product/workspaces/{wid}/package").json()
    assert saved_package["stale"] and saved_package["content"]["follow_up"] == package["content"]["follow_up"]
    client.post(endpoint(aid)).raise_for_status()
    versions = client.get(f"/resume-studio/analyses/{aid}/versions").json()
    assert versions[0]["stale"] and versions[0]["content"]["basics"]["email"] == "edited@example.com"
    refreshed = client.post("/learning/plans", json=plan_body).json()
    completed = next(item for item in refreshed["tasks"] if item["id"] == task["id"])
    assert completed["status"] == "completed" and completed["reflection"] == completion["reflection"]
    assert not refreshed["stale"]
    new_version = client.post(f"/resume-studio/analyses/{aid}/versions", json={}).json()
    assert not new_version["stale"] and new_version["id"] != version["id"]


def test_recalculation_preserves_in_progress_notes(environment, provider):
    client, factory, aid, wid, *_ = environment
    client.post(endpoint(aid)).raise_for_status()
    body = {"analysis_id": aid, "hours_per_week": 7, "target_date": str(date.today() + timedelta(days=40)), "experience_level": "intermediate"}
    task = client.post("/learning/plans", json=body).json()["tasks"][0]
    client.patch(f"/learning/tasks/{task['id']}", json={"progress": 30, "reflection": "My personal learning notes are in progress."}).raise_for_status()
    client.patch(f"/workspaces/{wid}", json={"description": "We require Kubernetes expertise for reliable production application delivery."}).raise_for_status()
    client.post(endpoint(aid)).raise_for_status()
    tasks = client.post("/learning/plans", json=body).json()["tasks"]
    retained = next(item for item in tasks if item["id"] == task["id"])
    assert retained["progress"] == 30 and retained["reflection"] == "My personal learning notes are in progress."


def test_changed_result_on_same_input_rerun_marks_materials_older(environment, provider, monkeypatch):
    client, _, aid, wid, *_ = environment
    first = client.post(endpoint(aid)).json()
    plan = client.post("/learning/plans", json={"analysis_id": aid, "hours_per_week": 7,
        "target_date": str(date.today() + timedelta(days=40)), "experience_level": "intermediate"}).json()
    version = client.post(f"/resume-studio/analyses/{aid}/versions", json={}).json()
    package = client.post(f"/product/workspaces/{wid}/package").json()
    assert not plan["stale"] and not version["stale"] and not package["stale"]
    async def changed_result(self, job, resume):
        result = ai.RuleBasedProvider().analyze(job, resume)
        return result.model_copy(update={"summary": "A revised evidence interpretation for the same inputs."})
    monkeypatch.setattr(ai.GroqProvider, "analyze_async", changed_result)
    refreshed = client.post(endpoint(aid), params={"force": True}).json()
    assert refreshed["input_hash"] == first["input_hash"] and refreshed["result"] != first["result"]
    assert client.get(f"/learning/plans/by-analysis/{aid}").json()["stale"]
    assert client.get(f"/resume-studio/analyses/{aid}/versions").json()[0]["stale"]
    assert client.get(f"/product/workspaces/{wid}/package").json()["stale"]


def test_operation_deadline_cancels_provider_and_persists_fallback(environment, monkeypatch):
    client, factory, aid, *_ = environment
    entered, cancelled = [], []
    async def slow(*_):
        entered.append(time.monotonic())
        try:
            await asyncio.sleep(10)
        finally:
            cancelled.append(time.monotonic())
    monkeypatch.setattr(ai.GroqProvider, "analyze_async", slow)
    monkeypatch.setattr(runs, "OPERATION_TIMEOUT_SECONDS", 3.08)
    response = client.post(endpoint(aid))
    assert response.json()["status"] == "completed_fallback" and len(cancelled) == 1
    assert cancelled[0] - entered[0] < 0.5
    with factory() as db:
        assert db.query(models.AIUsage).one().status == "dispatched"


def test_cancellation_records_failed_attempt_and_never_retries(environment, monkeypatch):
    client, factory, aid, *_ = environment
    async def scenario():
        entered = asyncio.Event()
        async def slow(*_):
            entered.set(); await asyncio.sleep(10)
        monkeypatch.setattr(ai.GroqProvider, "analyze_async", slow)
        with factory() as db:
            task = asyncio.create_task(runs.execute(db, aid, "candidate-a"))
            await entered.wait()
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
    asyncio.run(scenario())
    status = client.get(f"/resume/analysis/{aid}/explainable").json()
    assert status["status"] == status["run"]["status"] == "failed"
    with factory() as db:
        assert db.query(models.AIUsage).one().status == "dispatched"


def test_trickling_body_has_total_deadline_and_closes_transport(environment, monkeypatch):
    client, factory, aid, *_ = environment
    opened, closed = [], []
    class Trickle(httpx.AsyncByteStream):
        async def __aiter__(self):
            opened.append(time.monotonic())
            for _ in range(50):
                await asyncio.sleep(0.03)
                yield b" "
        async def aclose(self):
            closed.append(time.monotonic())
    original = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, stream=Trickle()))
    monkeypatch.setattr(ai.httpx, "AsyncClient", lambda **kwargs: original(transport=transport, **kwargs))
    monkeypatch.setattr(ai, "PROVIDER_TIMEOUT_SECONDS", 0.08)
    response = client.post(endpoint(aid))
    assert response.json()["provider"] == "rule_based" and len(closed) == 1
    # Measure the streaming deadline, independently of cold database/thread
    # startup on Windows. Without a total deadline this body takes 1.5 seconds.
    assert closed[0] - opened[0] < 0.5


def test_overall_deadline_covers_slow_database_phase_without_late_dispatch(environment, provider, monkeypatch):
    _, factory, aid, *_ = environment
    original = runs.reserve
    def slow_reserve(*arguments):
        time.sleep(0.2)
        return original(*arguments)
    monkeypatch.setattr(runs, "reserve", slow_reserve)
    monkeypatch.setattr(runs, "OPERATION_TIMEOUT_SECONDS", 0.05)
    async def scenario():
        with factory() as db:
            started = time.monotonic()
            with pytest.raises(HTTPException) as error:
                await runs.execute(db, aid, "candidate-a")
            assert error.value.status_code == 503
            assert time.monotonic() - started < 0.15
        # The late DB worker owns its own session, and cannot dispatch AI work.
        await asyncio.sleep(0.3)
    asyncio.run(scenario())
    assert provider == []
    with factory() as db:
        assert db.query(models.AIUsage).one().status == "reserved"


@pytest.mark.parametrize("failure", ["http_error", "bad_json", "empty_choices", "oversized", "disconnect", "stalled_headers"])
def test_transport_failures_are_bounded_safe_and_charged_once(environment, monkeypatch, failure):
    client, factory, aid, *_ = environment
    requests = []
    class Disconnected(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'{"private":"synthetic-sensitive-provider-error"'
            raise httpx.ReadError("synthetic-sensitive-provider-error")
    async def handle(request):
        requests.append(request)
        if failure == "stalled_headers":
            await asyncio.sleep(2)
        if failure == "http_error":
            return httpx.Response(429, text="synthetic-sensitive-provider-error")
        if failure == "empty_choices":
            return httpx.Response(200, json={"choices": []})
        if failure == "oversized":
            return httpx.Response(200, content=b"x" * 128)
        if failure == "disconnect":
            return httpx.Response(200, stream=Disconnected())
        return httpx.Response(200, content=b"synthetic-sensitive-provider-error")
    original = httpx.AsyncClient
    transport = httpx.MockTransport(handle)
    monkeypatch.setattr(ai.httpx, "AsyncClient", lambda **kwargs: original(transport=transport, **kwargs))
    monkeypatch.setattr(ai, "PROVIDER_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setattr(ai, "MAX_PROVIDER_BYTES", 64)
    monkeypatch.setenv("AI_DAILY_ANALYSIS_LIMIT", "1")
    response = client.post(endpoint(aid))
    assert response.status_code == 200 and response.json()["status"] == "completed_fallback"
    assert "synthetic-sensitive-provider-error" not in response.text
    assert client.post(endpoint(aid), params={"force": True}).json()["provider"] == "rule_based"
    assert len(requests) == 1
    with factory() as db:
        assert db.query(models.AIUsage).one().status == "dispatched"


def test_privacy_export_and_deletion_include_new_records(environment, provider):
    client, factory, aid, *_ = environment
    client.post(endpoint(aid)).raise_for_status()
    exported = client.get("/product/privacy/export").json()
    assert len(exported["analysis_runs"]) == len(exported["ai_usage"]) == 1
    client.post("/product/privacy/delete-app-data", json={"confirmation": "DELETE MY SKILLSYNC DATA"}).raise_for_status()
    with factory() as db:
        assert db.query(models.AnalysisRun).count() == db.query(models.AIUsage).count() == 0
