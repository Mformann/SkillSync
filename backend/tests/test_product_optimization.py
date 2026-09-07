from types import SimpleNamespace

from app.services.application_package_service import build_application_package, package_warnings


def analysis_fixture():
    return SimpleNamespace(
        target_job=SimpleNamespace(title="Frontend Engineer", company="Example Co"),
        explainable_data={
            "matches": [
                {
                    "requirement_name": "React", "status": "strong_match",
                    "evidence_quotes": ["Built accessible React interfaces."],
                },
                {
                    "requirement_name": "Kubernetes", "status": "missing_skill",
                    "evidence_quotes": [],
                },
            ]
        },
    )


def test_application_package_uses_supported_evidence_only() -> None:
    profile = SimpleNamespace(full_name="Alex Doe")
    content, sources, warnings = build_application_package(analysis_fixture(), profile, [])
    assert "Built accessible React interfaces." in content["cover_letter"]
    assert "Kubernetes" not in content["cover_letter"]
    assert sources["resume-1"]["requirement"] == "React"
    assert warnings == []


def test_application_package_flags_new_numbers() -> None:
    content, sources, _ = build_application_package(analysis_fixture())
    content["cover_letter"] += " I improved conversion by 45%."
    warnings = package_warnings(content, sources)
    assert warnings[0]["section"] == "cover_letter"
    assert "45%" in warnings[0]["message"]
