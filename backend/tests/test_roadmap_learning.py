from datetime import date, timedelta
from app.services.roadmap_service import (
    _practical_test_for,
    _youtube_resources_for,
    build_plan_tasks,
    plan_progress,
)


def test_youtube_resources_known_and_fallback():
    react_yt = _youtube_resources_for("React")
    assert len(react_yt) >= 2
    assert any("freeCodeCamp" in item["channel"] or "Traversy" in item["channel"] for item in react_yt)
    assert any("youtube.com" in item["url"] for item in react_yt)

    custom_yt = _youtube_resources_for("SomeRareSpecializedTool")
    assert len(custom_yt) >= 2
    assert any("youtube.com/results?search_query=" in item["url"] for item in custom_yt)


def test_practical_test_generator():
    react_test = _practical_test_for("React")
    assert "micro_challenge" in react_test
    assert "project_deliverable" in react_test
    assert len(react_test["checklist"]) >= 3

    generic_test = _practical_test_for("Rust", "Systems Engineer")
    assert "Rust" in generic_test["micro_challenge"]
    assert "Systems Engineer" in generic_test["project_deliverable"]
    assert len(generic_test["checklist"]) >= 3


def test_build_plan_tasks_includes_youtube_and_practical_test():
    explainable_data = {
        "requirements": [
            {"name": "Docker", "category": "technical_skill", "priority": "required", "importance": 4, "rationale": "Containers required"},
            {"name": "TypeScript", "category": "technical_skill", "priority": "preferred", "importance": 3, "rationale": "Types needed"},
        ],
        "matches": [
            {"requirement_name": "Docker", "status": "missing_skill", "evidence_quotes": [], "recommended_action": "Learn Docker", "confidence": 0.8},
            {"requirement_name": "TypeScript", "status": "partial_match", "evidence_quotes": ["Used TS in one script"], "recommended_action": "Practice TS", "confidence": 0.7},
        ],
    }

    target = date.today() + timedelta(days=30)
    tasks = build_plan_tasks(explainable_data, hours_per_week=10, target_date=target, experience_level="intermediate")

    assert len(tasks) == 2
    for t in tasks:
        assert "youtube" in t["resource"]
        assert len(t["resource"]["youtube"]) >= 2
        assert "practical_test" in t["resource"]
        assert "checklist" in t["resource"]["practical_test"]
        assert t["project_brief"] == t["resource"]["practical_test"]["project_deliverable"]

