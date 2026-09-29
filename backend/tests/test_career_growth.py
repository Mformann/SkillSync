from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from pathlib import Path
import importlib.util

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import growth_models as gm, models
from app.auth_utils import AuthenticatedUser, get_current_user
from app.database import Base, get_session
from app.main import create_app
from app.services.growth_service import calendar_export, schedule_plan
from app.services.job_discovery_service import job_locator, normalize_job, rank_jobs, safe_public_url


@pytest.fixture
def environment():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    app = create_app()
    identity = {"id": "candidate-a"}
    def database():
        with factory() as db:
            yield db
    app.dependency_overrides[get_session] = database
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=identity["id"])
    yield TestClient(app), factory, identity
    engine.dispose()


def workspace(client):
    response = client.post("/workspaces", json={"title": "Frontend engineer", "description": "Build accessible React applications with TypeScript and automated tests."})
    assert response.status_code == 201
    return response.json()["id"]


def completed_assessment(client, factory, correct=True):
    start = client.post("/growth/assessments", json={"skill": "React"})
    assert start.status_code == 201
    item = start.json()
    with factory() as db:
        attempt = db.get(gm.SkillAssessment, item["id"])
        answers = {q["id"]: q["correct"] if correct else (q["correct"] + 1) % len(q["options"]) for q in attempt.questions}
    return item, client.post(f"/growth/assessments/{item['id']}/submit", json={"answers": answers})


def test_assessment_keys_private_grading_immutable_and_retest(environment):
    client, factory, _ = environment
    first, result = completed_assessment(client, factory, False)
    assert all(set(q) == {"id", "prompt", "options"} for q in first["questions"])
    assert result.status_code == 200 and result.json()["score"] == 0
    assert client.post(f"/growth/assessments/{first['id']}/submit", json={"answers": {}}).status_code == 409
    _, retest = completed_assessment(client, factory)
    assert retest.json()["score"] == 100
    assert retest.json()["previous_score"] == 0 and retest.json()["improvement"] == 100
    assert retest.json()["verification_status"] == "knowledge_assessed"


def test_assessment_rejects_tampering_incomplete_and_cross_user(environment):
    client, _, identity = environment
    attempt = client.post("/growth/assessments", json={"skill": "SQL"}).json()
    path = f"/growth/assessments/{attempt['id']}/submit"
    assert client.post(path, json={"answers": {}, "score": 100}).status_code == 422
    assert client.post(path, json={"answers": {}}).status_code == 422
    assert client.post(path, json={"answers": {q["id"]: True for q in attempt["questions"]}}).status_code == 422
    identity["id"] = "candidate-b"
    assert client.post(path, json={"answers": {}}).status_code == 404
    assert client.get("/growth/assessments").json()["attempts"] == []
    assert client.post("/growth/assessments", json={"skill": "Not curated"}).status_code == 422


def test_assessment_quota(environment):
    client, factory, _ = environment
    with factory() as db:
        db.add_all([gm.SkillAssessment(user_id="candidate-a", skill="React", questions=[], answers={}) for _ in range(20)])
        db.commit()
    assert client.post("/growth/assessments", json={"skill": "React"}).status_code == 429


def test_schedule_preserves_completed_work_and_never_compresses_effort():
    today = date(2026, 9, 17)
    completed = SimpleNamespace(id=1, progress=100, due_date=today - timedelta(days=1), title="Done", skill="SQL", order_index=1, priority_score=5, estimated_hours=8)
    task = SimpleNamespace(id=2, progress=50, due_date=today, title="Practice", skill="React", order_index=2, priority_score=5, estimated_hours=8)
    result = schedule_plan([completed, task], 1, today + timedelta(days=1), [3], today)
    assert result["remaining_hours"] == 4 and result["available_hours"] == 1
    assert result["at_risk"] and task.due_date > today + timedelta(days=1)
    assert sum(s["minutes"] for s in result["sessions"]) == 240
    assert completed.due_date == today - timedelta(days=1) and completed.progress == 100 and task.progress == 50
    assert all(date.fromisoformat(s["date"]).weekday() == 3 for s in result["sessions"])


def test_plan_replanning_ownership_and_calendar_inbox(environment):
    client, factory, identity = environment
    wid = workspace(client)
    with factory() as db:
        analysis = models.Analysis(user_id=identity["id"], target_job_id=wid)
        db.add(analysis); db.flush()
        plan = models.LearningPlan(user_id=identity["id"], target_job_id=wid, analysis_id=analysis.id, hours_per_week=5, target_date=date.today() + timedelta(days=30))
        db.add(plan); db.flush()
        task = models.LearningTask(plan_id=plan.id, skill="React", title="Build a React project", category="technical_skill", order_index=1, priority_score=5, estimated_hours=4, due_date=date.today(), objective="Practise", project_brief="Build", assessment_criteria="Test", progress=50)
        db.add(task); db.commit(); pid, tid = plan.id, task.id
    payload = {"hours_per_week": 1, "target_date": (date.today() + timedelta(days=1)).isoformat(), "study_days": [date.today().weekday()]}
    response = client.post(f"/growth/plans/{pid}/replan", json=payload)
    assert response.status_code == 200 and response.json()["at_risk"]
    assert client.post(f"/growth/plans/{pid}/replan", json={**payload, "study_days": []}).status_code == 422
    identity["id"] = "candidate-b"
    assert client.post(f"/growth/plans/{pid}/replan", json=payload).status_code == 404
    identity["id"] = "candidate-a"
    inbox = client.get("/growth/reminders").json()["items"]
    assert len(inbox) == 1
    assert client.post(f"/growth/reminders/{inbox[0]['id']}/dismiss").status_code == 200
    with factory() as db:
        assert db.get(models.LearningTask, tid).progress == 50
    assert client.get("/growth/reminders").json()["items"] == []


def test_contacts_and_reminders_are_private_and_editable(environment):
    client, _, identity = environment
    wid = workspace(client)
    payload = {"workspace_id": wid, "name": "Recruiter name", "contact_type": "referral", "notes": "Private discussion"}
    contact = client.post("/growth/contacts", json=payload)
    assert contact.status_code == 201
    cid = contact.json()["id"]
    assert client.put(f"/growth/contacts/{cid}", json={**payload, "communication_history": "2026-09-17: discussed referral"}).status_code == 200
    reminder = client.post("/growth/reminders", json={"workspace_id": wid, "title": "Follow up", "due_date": date.today().isoformat()})
    assert reminder.status_code == 201
    assert "BEGIN:VEVENT" in client.get("/growth/calendar").text
    identity["id"] = "candidate-b"
    assert client.get("/growth/contacts").json() == [] and client.get("/growth/reminders").json()["items"] == []
    assert client.put(f"/growth/contacts/{cid}", json=payload).status_code == 404
    assert client.delete(f"/growth/contacts/{cid}").status_code == 404
    assert client.post("/growth/contacts", json=payload).status_code == 404
    identity["id"] = "candidate-a"
    assert client.delete(f"/growth/contacts/{cid}").status_code == 204


def create_passport(client, factory):
    wid = workspace(client)
    with factory() as db:
        profile = models.CareerProfile(user_id="candidate-a", full_name="Candidate", email="private@example.com", phone="PRIVATE PHONE")
        evidence = models.PortfolioEvidence(user_id="candidate-a", target_job_id=wid, title="Selected project", evidence_type="project", description="Public selected description", skills=["React"], url="https://example.com/project")
        private = models.PortfolioEvidence(user_id="candidate-a", target_job_id=wid, title="PRIVATE UNSELECTED", evidence_type="project", description="Secret description", skills=[])
        db.add_all([profile, evidence, private]); db.commit(); eid = evidence.id
    created = client.post("/growth/passport/shares", json={"evidence_ids": [eid], "sharing_consent": True})
    assert created.status_code == 201
    return created.json(), eid


def test_passport_minimizes_data_expires_and_revokes(environment):
    client, factory, _ = environment
    share, _ = create_passport(client, factory)
    token = share["path"].split("/")[-1]
    public = client.get(f"/growth/public/passport/{token}")
    assert public.status_code == 200
    assert all(secret not in public.text for secret in ("private@example.com", "PRIVATE PHONE", "PRIVATE UNSELECTED", "user_id", "token_hash"))
    assert public.headers["cache-control"] == "no-store" and public.headers["referrer-policy"] == "no-referrer"
    with factory() as db:
        saved = db.get(gm.PassportShare, share["id"])
        assert saved.token_hash != token and len(saved.token_hash) == 64
        saved.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1); db.commit()
    assert client.get(f"/growth/public/passport/{token}").status_code == 404
    with factory() as db:
        db.get(gm.PassportShare, share["id"]).expires_at = datetime.now(timezone.utc) + timedelta(days=1); db.commit()
    assert client.delete(f"/growth/passport/shares/{share['id']}").status_code == 204
    assert client.get(f"/growth/public/passport/{token}").status_code == 404


def test_passport_review_cannot_self_attest_or_access_other_evidence(environment):
    client, factory, identity = environment
    share, eid = create_passport(client, factory)
    token = share["path"].split("/")[-1]
    payload = {"evidence_id": eid, "reviewer_name": "Reviewer", "relationship": "Former teammate", "clarity": 4, "relevance": 4, "reproducibility": 3, "comments": "I reviewed the demo and its setup instructions.", "reviewed_evidence": True}
    path = f"/growth/public/passport/{token}/reviews"
    assert client.post(path, json=payload).status_code == 403
    identity["id"] = "reviewer-b"
    assert client.post(path, json={**payload, "evidence_id": eid + 999}).status_code == 422
    assert client.post(path, json=payload).status_code == 201
    assert client.post(path, json={**payload, "comments": "Updated review of the supporting evidence."}).status_code == 201
    public = client.get(f"/growth/public/passport/{token}").json()
    assert len(public["reviews"]) == 1 and public["reviews"][0]["status"] == "account_based_review"
    assert client.delete(f"/growth/passport/shares/{share['id']}").status_code == 404


def test_passport_requires_consent_and_owned_selections(environment):
    client, factory, identity = environment
    share, eid = create_passport(client, factory)
    assert client.post("/growth/passport/shares", json={"evidence_ids": [eid]}).status_code == 422
    identity["id"] = "candidate-b"
    assert client.post("/growth/passport/shares", json={"evidence_ids": [eid], "sharing_consent": True}).status_code == 404
    assert client.get("/growth/passport/shares").json() == []


def test_growth_data_export_delete_revokes_shared_data_and_cross_reviews(environment):
    client, factory, identity = environment
    share, _ = create_passport(client, factory)
    completed_assessment(client, factory)
    export = client.get("/product/privacy/export").json()
    assert "career_growth" in export and "token_hash" not in str(export["career_growth"])
    response = client.post("/product/privacy/delete-app-data", json={"confirmation": "DELETE MY SKILLSYNC DATA"})
    assert response.status_code == 200
    token = share["path"].split("/")[-1]
    assert client.get(f"/growth/public/passport/{token}").status_code == 404
    assert client.get("/growth/assessments").json()["attempts"] == []


@pytest.mark.parametrize("url", ["http://localhost:8000/private", "https://127.0.0.1/internal", "https://jobs.lever.co.evil.test/company/id", "https://jobs.lever.co@evil.test/company/id", "https://jobs.lever.co:444/company/id", "https://boards.greenhouse.io/../jobs/1", "https://jobs.lever.co/company/%2e%2e", "https://[::1]/secret"])
def test_job_locator_rejects_ssrf_targets(url):
    with pytest.raises(ValueError):
        job_locator(url)


@pytest.mark.parametrize("url, expected", [("https://job-boards.greenhouse.io/acme/jobs/123", ("greenhouse", "acme", "123", False)), ("https://jobs.lever.co/acme/abc-123", ("lever", "acme", "abc-123", False)), ("https://jobs.eu.lever.co/acme/abc-123", ("lever", "acme", "abc-123", True))])
def test_job_locator_uses_supported_official_hosts(url, expected):
    assert job_locator(url) == expected


def test_job_import_preview_safe_and_manual_save_deduplicates(environment, monkeypatch):
    client, _, identity = environment
    calls = []
    def fetch(url):
        calls.append(url)
        return {"id": 123, "title": "Frontend engineer", "location": {"name": "Remote"}, "absolute_url": "https://job-boards.greenhouse.io/acme/jobs/123", "content": "<p>Build accessible React applications with automated tests and TypeScript.</p><script>SECRET SCRIPT</script>"}
    monkeypatch.setattr("app.services.job_discovery_service.fetch_json", fetch)
    preview = client.post("/growth/jobs/preview", json={"url": "https://job-boards.greenhouse.io/acme/jobs/123"})
    assert preview.status_code == 200 and "SECRET SCRIPT" not in preview.text
    assert calls == ["https://boards-api.greenhouse.io/v1/boards/acme/jobs/123"]
    assert client.post("/growth/jobs/preview", json={"url": "http://localhost/private"}).status_code == 422
    assert len(calls) == 1
    payload = {k: preview.json()[k] for k in ("title", "company", "description", "location", "employment_type", "url")}
    first = client.post("/growth/jobs/save", json=payload)
    second = client.post("/growth/jobs/save", json=payload)
    assert first.status_code == 201 and second.json()["already_saved"]
    assert first.json()["workspace_id"] == second.json()["workspace_id"]
    identity["id"] = "candidate-b"
    third = client.post("/growth/jobs/save", json=payload)
    assert not third.json()["already_saved"]


def test_job_matching_and_salary_are_honest():
    job = normalize_job("lever", "acme", {"id": "1", "text": "Frontend engineer", "categories": {"location": "Remote"}, "descriptionPlain": "Use React and SQL.", "hostedUrl": "https://jobs.lever.co/acme/1", "salaryRange": {"min": 50, "max": 100, "currency": "USD", "interval": "year"}})
    preferences = {"roles": ["frontend"], "remote_only": True, "locations": [], "minimum_salary": 1000000, "currency": "INR"}
    result = rank_jobs([job], preferences, {"react"})
    assert result[0]["alignment"] == 50 and result[0]["missing_skills"] == ["SQL"]
    assert result[0]["salary_needs_review"]
    assert rank_jobs([job], {**preferences, "currency": "USD"}, {"react"}) == []
    assert safe_public_url("javascript:alert(1)") is None


def test_empty_feed_setup_is_explicit(environment, monkeypatch):
    client, _, _ = environment
    monkeypatch.delenv("JOB_FEED_GREENHOUSE_BOARDS", raising=False)
    monkeypatch.delenv("JOB_FEED_LEVER_COMPANIES", raising=False)
    response = client.get("/growth/jobs")
    assert response.status_code == 200 and not response.json()["configured"] and response.json()["jobs"] == []


def test_calendar_cannot_inject_new_events():
    exported = calendar_export([{"id": "a", "title": "Follow up\r\nEND:VEVENT\nBEGIN:VEVENT", "due_date": "2026-09-17"}])
    assert exported.count("\r\nBEGIN:VEVENT\r\n") == 1
    assert "SUMMARY:Follow up\\nEND:VEVENT\\nBEGIN:VEVENT" in exported


def test_interview_contextual_turn_is_saved_without_fake_scores(environment, monkeypatch):
    client, factory, identity = environment
    wid = workspace(client)
    with factory() as db:
        analysis = models.Analysis(user_id=identity["id"], target_job_id=wid, explainable_data={"requirements": [{"name": "React", "priority": "required"}], "matches": [{"requirement_name": "React", "status": "missing_skill"}]})
        db.add(analysis); db.commit()
    session = client.post(f"/career/workspaces/{wid}/interview-sessions").json()
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    payload = {"question_id": session["questions"][0]["id"], "answer": "I would build a small accessible React application and test its interactions."}
    path = f"/growth/interviews/{session['id']}/turn"
    result = client.post(path, json=payload)
    assert result.status_code == 200 and result.json()["feedback"]["overall"] is None
    assert result.json()["feedback"]["mode"] == "guided_practice"
    assert result.json()["follow_up"]["parent_id"] == payload["question_id"]
    assert client.post(path, json=payload).status_code == 409
    saved = client.get(f"/career/workspaces/{wid}").json()["sessions"][0]
    assert saved["answers"][payload["question_id"]] == payload["answer"]
    identity["id"] = "candidate-b"
    assert client.post(path, json=payload).status_code == 404


def test_deleting_workspace_cleans_contacts_reminders_and_shared_evidence(environment):
    client, factory, _ = environment
    share, eid = create_passport(client, factory)
    with factory() as db:
        wid = db.get(models.PortfolioEvidence, eid).target_job_id
    client.post("/growth/contacts", json={"workspace_id": wid, "name": "Recruiter"})
    client.post("/growth/reminders", json={"workspace_id": wid, "title": "Follow up", "due_date": date.today().isoformat()})
    assert client.delete(f"/workspaces/{wid}").status_code == 204
    assert client.get("/growth/contacts").json() == [] and client.get("/growth/reminders").json()["items"] == []
    token = share["path"].split("/")[-1]
    assert client.get(f"/growth/public/passport/{token}").status_code == 404


def test_growth_migration_creates_tables_and_supports_existing_dev_schema(monkeypatch):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import inspect
    path = Path(__file__).resolve().parents[1] / "alembic/versions/deaf9f5a764b_career_growth_assessments_planning_.py"
    spec = importlib.util.spec_from_file_location("career_growth_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    models.TargetJob.__table__.create(engine)
    with engine.begin() as connection:
        monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(connection)))
        migration.upgrade()
        migration.upgrade()
        assert {m.__tablename__ for m in gm.GROWTH_TABLES} <= set(inspect(connection).get_table_names())
        assert any(i["column_names"] == ["user_id"] for i in inspect(connection).get_indexes("skill_assessments"))
        migration.downgrade()
        assert "skill_assessments" not in inspect(connection).get_table_names()
    engine.dispose()


def test_guided_interview_does_not_lower_existing_scored_practice():
    from app.services.career_service import readiness_summary
    analysis = SimpleNamespace(score_breakdown={"overall": 50})
    sessions = [SimpleNamespace(scores={"ai": {"overall": 90}, "guided": {"mode": "guided_practice"}})]
    assert readiness_summary(analysis, None, 0, sessions, False)["components"]["interview"] == 90


def test_feed_errors_are_reported_without_fake_jobs(environment, monkeypatch):
    from app.services import job_discovery_service as service
    client, _, _ = environment
    monkeypatch.setenv("JOB_FEED_GREENHOUSE_BOARDS", "test-empty-feed")
    monkeypatch.delenv("JOB_FEED_LEVER_COMPANIES", raising=False)
    service._feed_cache.clear()
    monkeypatch.setattr(service, "fetch_json", lambda _: (_ for _ in ()).throw(ValueError("unavailable")))
    result = client.get("/growth/jobs").json()
    assert result["configured"] and result["jobs"] == [] and len(result["errors"]) == 1


def test_interview_provider_requires_consent_and_validates_output(monkeypatch):
    import httpx
    from app.services.growth_service import interview_feedback
    monkeypatch.setenv("GROQ_API_KEY", "test-not-a-real-key")
    called = []
    def post(url, **kwargs):
        called.append(kwargs)
        return httpx.Response(200, request=httpx.Request("POST", url), json={"choices": [{"message": {"content": '{"relevance":80,"reasoning":70,"evidence":60,"feedback":["Explain your trade-offs."],"follow_up":"How did you validate that design decision?"}'}}]})
    monkeypatch.setattr("app.services.growth_service.httpx.post", post)
    assert interview_feedback("Question", "Answer", "Role", [], False)["overall"] is None and not called
    result = interview_feedback("Question", "Answer", "Role", [], True)
    assert result["mode"] == "ai_coaching" and result["overall"] == 70 and len(called) == 1
    monkeypatch.setattr("app.services.growth_service.httpx.post", lambda *a, **kw: httpx.Response(200, request=httpx.Request("POST", "https://test.example"), json={"choices": [{"message": {"content": '{"relevance":999}'}}]}))
    assert interview_feedback("Question", "Answer", "Role", [], True)["mode"] == "guided_practice"
