"""Opt-in, read-only first-deployment checks. Supply credentials via environment.

BETA_API_URL and BETA_FRONTEND_URL must be deployed HTTPS origins.
BETA_TEST_ACCESS_TOKEN is an optional real test-account token. It is never saved.
"""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
import httpx

def origin(name):
    value = os.environ.get(name, "").rstrip("/")
    parsed = urlsplit(value)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.path or parsed.query or parsed.fragment
            or parsed.hostname in ("localhost", "127.0.0.1", "::1")):
        raise SystemExit(f"Set {name} to its deployed HTTPS origin.")
    return value

def main():
    api, frontend = origin("BETA_API_URL"), origin("BETA_FRONTEND_URL")
    checks = {}
    with httpx.Client(timeout=30, follow_redirects=False) as client:
        for route in ("/health", "/health/ready"):
            checks[route] = client.get(api + route).status_code == 200
        for route in ("/docs", "/openapi.json"):
            checks[route + " disabled"] = client.get(api + route).status_code == 404
        checks["anonymous workspace denied"] = client.get(api + "/workspaces").status_code == 401
        cors = client.options(api + "/workspaces", headers={"Origin": frontend,
            "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"})
        checks["deployed frontend CORS"] = cors.headers.get("access-control-allow-origin") == frontend
        response = client.get(frontend + "/login")
        checks["frontend deep link"] = response.status_code == 200
        checks["frontend security headers"] = all(response.headers.get(name) for name in
            ("content-security-policy", "x-content-type-options", "referrer-policy"))
        token = os.environ.get("BETA_TEST_ACCESS_TOKEN")
        pending = ["signup/confirmation email", "session refresh/logout", "password-reset email and redirects",
            "two real accounts and consent-on provider flow", "host load/cold start", "audible screen-reader check"]
        if token:
            checks["real issued bearer token"] = client.get(api + "/auth/me",
                headers={"Authorization": "Bearer " + token}).status_code == 200
        else:
            pending.append("real issued bearer token: supply BETA_TEST_ACCESS_TOKEN")
    report = {"automated_passed": all(checks.values()), "checks": checks,
        "manual_acceptance_pending": pending, "ready_to_open_beta": False}
    target = Path(__file__).with_name("phase-06-hosted-smoke.json")
    target.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["automated_passed"] and token else 1

if __name__ == "__main__":
    raise SystemExit(main())
