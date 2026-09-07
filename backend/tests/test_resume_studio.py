from types import SimpleNamespace

from app.services.resume_studio_service import build_grounded_draft, claim_warnings, export_docx


def analysis_fixture():
    return SimpleNamespace(
        explainable_data={
            "matches": [
                {
                    "requirement_name": "React",
                    "status": "strong_match",
                    "evidence_quotes": ["Built React dashboards for internal teams."],
                },
                {
                    "requirement_name": "Kubernetes",
                    "status": "missing_skill",
                    "evidence_quotes": [],
                },
            ]
        },
        target_job=SimpleNamespace(title="Frontend Engineer"),
        job_role="Frontend Engineer",
        resume_text="Alex Doe\nalex@example.com\nBuilt React dashboards for internal teams.",
        resume=None,
    )


def test_draft_uses_only_supported_evidence() -> None:
    content, sources = build_grounded_draft(analysis_fixture())
    assert content["skills"] == ["React"]
    assert content["evidence"][0]["text"] == "Built React dashboards for internal teams."
    assert "Kubernetes" not in content["summary"]
    assert sources["evidence-1"]["quote"] in analysis_fixture().resume_text


def test_warning_flags_new_metric_not_in_source() -> None:
    content, sources = build_grounded_draft(analysis_fixture())
    content["evidence"][0]["text"] += " Improved speed by 40%."
    warnings = claim_warnings(content, sources)
    assert any(item["code"] == "unsupported_metric" for item in warnings)


def test_docx_export_is_a_valid_zip_document() -> None:
    content, _ = build_grounded_draft(analysis_fixture())
    output = export_docx(content, "classic")
    assert output.read(2) == b"PK"
