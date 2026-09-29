from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
import httpx
import jwt

from app.auth_utils import verify_access_token
from app.services.analysis_service import extract_skills
from app.services.ai_analysis_service import (
    AIAnalysis,
    Requirement,
    RequirementMatch,
    analysis_input_hash,
    calculate_scores,
    ground_analysis,
    run_hybrid_analysis,
    strict_schema,
)
from app.services.roadmap_service import build_plan_tasks


def test_extract_skills_is_case_insensitive() -> None:
    found, missing = extract_skills("Built APIs with Python, FastAPI, SQL and Docker.")
    assert {"python", "fastapi", "sql", "docker"}.issubset(found)
    assert "kubernetes" in missing


def test_supabase_token_identity(monkeypatch: pytest.MonkeyPatch) -> None:
    secret = "test-secret-that-is-at-least-32-bytes-long"
    monkeypatch.setenv("SUPABASE_URL", "https://audit-project.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    monkeypatch.delenv("SUPABASE_JWT_ISSUER", raising=False)
    monkeypatch.setattr("app.auth_utils.httpx.get", lambda *args, **kwargs: httpx.Response(200, json={"id": "user-123"}))
    payload = {
        "sub": "user-123",
        "email": "candidate@example.com",
        "aud": "authenticated",
        "iss": "https://audit-project.supabase.co/auth/v1",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    user = verify_access_token(token)
    assert user.id == "user-123"
    assert user.email == "candidate@example.com"


def test_invalid_token_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://audit-project.supabase.co")
    with pytest.raises(HTTPException) as error:
        verify_access_token("not-a-token")
    assert error.value.status_code == 401


def sample_analysis() -> AIAnalysis:
    return AIAnalysis(
        summary="Good baseline.",
        candidate_positioning="Relevant frontend experience.",
        requirements=[
            Requirement(name="React", category="technical_skill", priority="required", importance=5, rationale="Core stack."),
            Requirement(name="Docker", category="technical_skill", priority="preferred", importance=2, rationale="Deployment tooling."),
        ],
        matches=[
            RequirementMatch(
                requirement_name="React", status="strong_match",
                evidence_quotes=["Built React dashboards"], explanation="Direct evidence.",
                confidence=0.9, recommended_action="Quantify impact.",
            ),
            RequirementMatch(
                requirement_name="Docker", status="missing_skill",
                evidence_quotes=[], explanation="Not found.", confidence=0.8,
                recommended_action="Build a containerized project.",
            ),
        ],
        strengths=[],
        resume_risks=[],
    )


def test_scores_are_deterministic_and_weight_required_items() -> None:
    scores = calculate_scores(sample_analysis())
    assert scores["overall"] == 79
    assert scores["required"] == 100
    assert scores["preferred"] == 0
    assert scores["formula_version"] == "weighted-match-v1"


def test_unverifiable_model_quote_is_removed_and_match_downgraded() -> None:
    grounded = ground_analysis(sample_analysis(), "Experienced frontend developer.")
    react = grounded.matches[0]
    assert react.evidence_quotes == []
    assert react.status == "missing_evidence"


def test_fallback_is_explicit_when_groq_key_is_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    result = run_hybrid_analysis(
        "We require React, TypeScript, Docker and strong testing skills.",
        "Built React and TypeScript applications with Jest testing.",
    )
    assert result.provider == "rule_based"
    assert result.fallback_reason
    assert any(item.name == "React" for item in result.analysis.requirements)


def test_external_ai_requires_workspace_consent() -> None:
    result = run_hybrid_analysis(
        "We require React and Docker for this role.",
        "Built production React applications.",
        allow_external_ai=False,
    )
    assert result.provider == "rule_based"
    assert "not enabled" in (result.fallback_reason or "")


def test_cache_hash_changes_with_inputs() -> None:
    first = analysis_input_hash("React role", "React resume")
    assert first == analysis_input_hash("  React   role ", "React resume")
    assert first != analysis_input_hash("Python role", "React resume")


def test_strict_schema_closes_every_object() -> None:
    schema = strict_schema()
    assert schema["additionalProperties"] is False
    for property_name in ["requirements", "matches", "strengths", "resume_risks"]:
        assert schema["properties"][property_name]["items"]["additionalProperties"] is False


def test_roadmap_prioritizes_prerequisites_and_respects_deadline() -> None:
    explainable = {
        "requirements": [
            {"name": "Kubernetes", "category": "technical_skill", "priority": "required", "importance": 5},
            {"name": "Docker", "category": "technical_skill", "priority": "required", "importance": 4},
        ],
        "matches": [
            {"requirement_name": "Kubernetes", "status": "missing_skill", "recommended_action": "Learn orchestration."},
            {"requirement_name": "Docker", "status": "missing_skill", "recommended_action": "Learn containers."},
        ],
    }
    start = date(2026, 7, 29)
    target = date(2026, 8, 29)
    tasks = build_plan_tasks(explainable, 7, target, "intermediate", start)
    assert [task["skill"] for task in tasks] == ["Docker", "Kubernetes"]
    assert all(start < task["due_date"] <= target for task in tasks)
    assert tasks[1]["prerequisites"] == ["Docker"]


def test_roadmap_uses_ai_recommended_action_as_objective() -> None:
    explainable = {
        "requirements": [
            {"name": "React", "category": "technical_skill", "priority": "required", "importance": 5},
        ],
        "matches": [
            {"requirement_name": "React", "status": "poorly_demonstrated", "recommended_action": "Add a quantified React project."},
        ],
    }
    tasks = build_plan_tasks(
        explainable, 5, date.today() + timedelta(days=30), "beginner",
    )
    assert tasks[0]["objective"] == "Add a quantified React project."
    assert tasks[0]["resource"]["url"] == "https://react.dev/learn"
