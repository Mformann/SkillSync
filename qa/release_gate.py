"""Verify recorded first-deployment evidence; never treats missing hosted tests as passed.

Run from the repository root: backend/.venv/Scripts/python.exe qa/release_gate.py
This verifies evidence, not a replacement for running the suites described in CI.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / "qa"

def read(name):
    return json.loads((QA / name).read_text(encoding="utf-8"))

def tests(name):
    cases = ET.parse(QA / name).getroot().findall(".//testcase")
    counts = {"total": len(cases), "passed": 0, "failed": 0, "skipped": 0}
    for case in cases:
        state = "failed" if case.find("failure") is not None or case.find("error") is not None else "skipped" if case.find("skipped") is not None else "passed"
        counts[state] += 1
    assert counts["failed"] == 0 and counts["passed"] > 0, f"Unresolved failures: {name}"
    return counts

def main():
    summary = {"phase": 6, "generated_at": datetime.now(timezone.utc).isoformat(),
        "profile": "prepare for first deployment; no hosted writes or deployment authorized"}
    for suite in ("backend", "linux", "frontend"):
        summary[suite] = tests(f"phase-06-{suite}-tests.xml")
    summary["linux_authentication_final_fixtures"] = tests("phase-06-linux-auth-tests.xml")
    assert summary["backend"]["total"] >= 303 and summary["backend"]["skipped"] <= 1
    assert summary["linux"]["total"] >= 303 and summary["linux"]["skipped"] <= 1
    assert summary["frontend"]["passed"] >= 128
    npm = read("phase-06-frontend-dependency-audit.json")
    python = read("phase-06-backend-dependency-audit.json")
    assert npm["metadata"]["vulnerabilities"]["total"] == 0
    assert all(not item["vulns"] for item in python["dependencies"])
    summary["dependency_vulnerabilities"] = 0
    assert read("phase-06-secret-scan.json")["passed"]
    summary["configured_credentials_scan"] = "passed; see phase-06-secret-scan.json for scope"
    public = read("phase-06-public-browser-tests.json")
    assert public["passed"] == 6 and public["failed"] == 0
    summary["public_browser"] = public
    build = read("phase-06-build-checks.json")
    assert all(build[name] for name in ("typecheck", "lint", "beta_build"))
    summary["build_checks"] = build
    browser = read("phase-06-browser-results.json")
    assert len(browser) == 102
    for page in browser:
        assert not any(page.get(name) for name in ("overflow", "errors", "badResponses", "unlabeled", "smallButtons"))
        assert page["mainCount"] == page["axMainCount"] == 1
        assert not page["contrast"]["failures"]
    summary["browser"] = {"signed_in_page_checks": len(browser),
        "html_text_contrast_checks": sum(page["contrast"]["checked"] for page in browser)}
    for theme in ("light", "dark"):
        assert read(f"phase-06-keyboard-{theme}.json")["ok"]
    flow = read("phase-06-browser-flow.json")
    assert flow["ok"] and flow["analysisRunRequests"] == 1 and flow["totalRunRequests"] == 2 and not flow["errors"]
    summary["browser"]["candidate_journey"] = "passed; one initial run and one deliberate refresh"
    production = read("phase-06-production-smoke.json")
    assert production["passed"] and production["database"]["revision"] == "20261021_09"
    summary["production_container"] = production
    assert (QA / "phase-06-resume-print.pdf").stat().st_size > 1000
    summary["print"] = "one A4 page; rendered and visually reviewed; readable synthetic name/email/evidence"
    summary["ready_for_first_deployment"] = True
    summary["hosted_acceptance"] = {"status": "pending first deployment", "open_beta_to_testers": False,
        "checks": ["configure actual origins and auth redirects", "verify deployed migration 09 and private-role denial",
            "real signup/login/refresh/logout and email reset", "two-account candidate journey and consent-on AI",
            "deployed load/cold-start measurements", "audible screen-reader smoke"]}
    target = QA / "phase-06-verification-summary.json"
    target.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    files = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=ROOT, text=True).splitlines()
    include = ("backend/app/", "backend/alembic/", "backend/scripts/", "backend/tests/", "frontend/src/", "frontend/tests/", "frontend/e2e/")
    exact = {"backend/Dockerfile", "backend/requirements.txt", "backend/requirements.lock", "frontend/package.json",
        "frontend/package-lock.json", "frontend/vite.config.ts", "frontend/playwright.config.ts", ".github/workflows/ci.yml", "render.yaml", "vercel.json",
        "qa/production_smoke.py", "qa/hosted_smoke.py", "qa/release_gate.py", "qa/wait_for_api.py",
        "qa/local_qa_server.py", "qa/browser-audit.mjs", "qa/accessibility-checks.mjs", "qa/live_connectivity.py", ".gitattributes"}
    selected = sorted(set(path for path in files if path.startswith(include) or path in exact))
    manifest = {"generated_at": summary["generated_at"], "migration_head": "20261021_09",
        "base_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "working_tree_has_uncommitted_changes": bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip()),
        "frontend_release_build": "vite build --mode beta; actual deployed URL required", "source_sha256": {}, "evidence_sha256": {}}
    for path in selected:
        manifest["source_sha256"][path] = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
    for path in sorted(QA.glob("phase-06-*")):
        if path.is_file():
            manifest["evidence_sha256"][path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
    (QA / "beta-release-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: summary[key] for key in ("backend", "linux", "frontend", "browser", "dependency_vulnerabilities", "ready_for_first_deployment", "hosted_acceptance")}, indent=2))

if __name__ == "__main__":
    main()
