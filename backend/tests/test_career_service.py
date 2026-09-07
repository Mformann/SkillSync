from types import SimpleNamespace

from app.services.career_service import (
    generate_interview_questions,
    readiness_summary,
    score_practice_answer,
)


def explainable_fixture() -> dict:
    return {
        "requirements": [
            {"name": "React", "priority": "required"},
            {"name": "Docker", "priority": "required"},
        ],
        "matches": [
            {"requirement_name": "React", "status": "strong_match"},
            {"requirement_name": "Docker", "status": "missing_skill"},
        ],
    }


def test_questions_distinguish_verified_strengths_from_gaps() -> None:
    questions = generate_interview_questions(explainable_fixture(), "Frontend Engineer")
    gap = next(item for item in questions if item["requirement"] == "Docker")
    strength = next(item for item in questions if item["requirement"] == "React")
    assert "despite the current evidence gap" in gap["question"]
    assert "specific time" in strength["question"]
    assert "do not claim experience" in gap["focus"]


def test_practice_score_rewards_star_structure_and_evidence() -> None:
    short = score_practice_answer("I used React on a project and it went well enough.")
    structured = score_practice_answer(
        "Situation: users faced delays. Task: improve delivery. Action: I built and delivered "
        "a tested React workflow with the team. Result: we reduced the verified delay by 20 percent."
    )
    assert structured["overall"] > short["overall"]
    assert structured["structure"] == 100


def test_readiness_is_deterministic_and_explainable() -> None:
    analysis = SimpleNamespace(score_breakdown={"overall": 80})
    tasks = [SimpleNamespace(progress=100), SimpleNamespace(progress=50)]
    plan = SimpleNamespace(tasks=tasks)
    session = SimpleNamespace(scores={"q-1": {"overall": 70}})
    result = readiness_summary(analysis, plan, 2, [session], True)
    assert result["components"] == {
        "job_match": 80, "learning": 75, "portfolio": 50, "interview": 70, "materials": 100,
    }
    assert result["overall"] == 75
    assert result["formula_version"] == "career-readiness-v1"
