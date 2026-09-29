import json
from datetime import datetime, timedelta, timezone

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import auth_utils
from app.main import create_app

PROJECT = "https://audit-project.supabase.co"
USER_ID = "867b8593-afc7-45eb-9b19-c501026d278b"


@pytest.fixture(autouse=True)
def configuration(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", PROJECT)
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_audit")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    monkeypatch.delenv("SUPABASE_JWT_ISSUER", raising=False)
    cached_client = auth_utils._jwks_client
    cached_client.cache_clear()
    yield
    cached_client.cache_clear()


def claims(**changes):
    now = datetime.now(timezone.utc)
    return {"sub": USER_ID, "email": "audit@example.com", "aud": "authenticated", "iss": f"{PROJECT}/auth/v1", "iat": now, "exp": now + timedelta(minutes=5), **changes}


@pytest.fixture(params=["ES256", "RS256"])
def signing(request, monkeypatch):
    algorithm = request.param
    if algorithm == "ES256":
        private_key = ec.generate_private_key(ec.SECP256R1())
        public_jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private_key.public_key()))
    else:
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key()))
    public_jwk.update({"kid": "audit-key", "alg": algorithm, "use": "sig"})
    client = jwt.PyJWKClient(f"{PROJECT}/auth/v1/.well-known/jwks.json")
    monkeypatch.setattr(client, "fetch_data", lambda: {"keys": [public_jwk]})
    monkeypatch.setattr(auth_utils, "_jwks_client", lambda project_url: client)
    return lambda payload: jwt.encode(payload, private_key, algorithm=algorithm, headers={"kid": "audit-key"})


def test_asymmetric_identity_and_bearer_route(signing):
    token = signing(claims())
    identity = auth_utils.verify_access_token(token)
    assert identity.id == USER_ID
    response = TestClient(create_app()).get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {"id": USER_ID, "email": "audit@example.com"}


@pytest.mark.parametrize("change", [
    {"iss": "https://another-project.supabase.co/auth/v1"},
    {"aud": "another-audience"},
    {"exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
    {"sub": ""},
    {"nbf": datetime.now(timezone.utc) + timedelta(hours=1)},
])
def test_invalid_claims_are_rejected(signing, change):
    with pytest.raises(HTTPException) as caught:
        auth_utils.verify_access_token(signing(claims(**change)))
    assert caught.value.status_code == 401
    assert caught.value.detail == "Could not validate credentials."


@pytest.mark.parametrize("required", ["iss", "aud", "exp", "sub"])
def test_required_claims_cannot_be_omitted(signing, required):
    payload = claims()
    del payload[required]
    with pytest.raises(HTTPException) as caught:
        auth_utils.verify_access_token(signing(payload))
    assert caught.value.status_code == 401


def test_forged_signature_is_rejected(signing):
    token = signing(claims())
    header, payload, signature = token.split(".")
    altered = f"{header}.{payload}.{'A' * len(signature)}"
    with pytest.raises(HTTPException) as caught:
        auth_utils.verify_access_token(altered)
    assert caught.value.status_code == 401


def test_jwks_outage_is_not_reported_as_invalid_session(monkeypatch):
    class UnavailableKeys:
        def get_signing_key_from_jwt(self, token):
            raise jwt.PyJWKClientConnectionError("temporary network failure")
    monkeypatch.setattr(auth_utils, "_jwks_client", lambda project_url: UnavailableKeys())
    private_key = ec.generate_private_key(ec.SECP256R1())
    token = jwt.encode(claims(), private_key, algorithm="ES256", headers={"kid": "audit-key"})
    with pytest.raises(HTTPException) as caught:
        auth_utils.verify_access_token(token)
    assert caught.value.status_code == 503
    assert "temporary network failure" not in caught.value.detail


def test_disallowed_algorithm_does_not_contact_auth(monkeypatch):
    called = []
    monkeypatch.setattr(auth_utils.httpx, "get", lambda *args, **kwargs: called.append(True))
    token = jwt.encode(claims(), "isolated-audit-secret-48-bytes-minimum-for-hs384-tests", algorithm="HS384")
    with pytest.raises(HTTPException) as caught:
        auth_utils.verify_access_token(token)
    assert caught.value.status_code == 401
    assert not called


def test_legacy_signature_is_checked_by_supabase(monkeypatch):
    captured = {}
    def auth_user(url, **kwargs):
        captured.update({"url": url, **kwargs})
        return httpx.Response(200, json={"id": USER_ID})
    monkeypatch.setattr(auth_utils.httpx, "get", auth_user)
    token = jwt.encode(claims(), "isolated-audit-secret-at-least-32-bytes", algorithm="HS256")
    assert auth_utils.verify_access_token(token).id == USER_ID
    assert captured["url"] == f"{PROJECT}/auth/v1/user"
    assert captured["headers"]["Authorization"] == f"Bearer {token}"
    assert captured["follow_redirects"] is False


@pytest.mark.parametrize("status_code", [401, 403, 429, 500])
def test_legacy_auth_failures_fail_closed(monkeypatch, status_code):
    monkeypatch.setattr(auth_utils.httpx, "get", lambda *args, **kwargs: httpx.Response(status_code))
    token = jwt.encode(claims(), "isolated-audit-secret-at-least-32-bytes", algorithm="HS256")
    with pytest.raises(HTTPException) as caught:
        auth_utils.verify_access_token(token)
    assert caught.value.status_code == (401 if status_code in {401, 403} else 503)


def test_legacy_identity_must_match_subject(monkeypatch):
    monkeypatch.setattr(auth_utils.httpx, "get", lambda *args, **kwargs: httpx.Response(200, json={"id": "another-user"}))
    token = jwt.encode(claims(), "isolated-audit-secret-at-least-32-bytes", algorithm="HS256")
    with pytest.raises(HTTPException) as caught:
        auth_utils.verify_access_token(token)
    assert caught.value.status_code == 401


@pytest.mark.parametrize("claim", ["exp", "iat", "nbf"])
def test_nonfinite_legacy_claim_is_unauthorized_before_remote_verification(monkeypatch, claim):
    called = []
    monkeypatch.setattr(auth_utils.httpx, "get", lambda *args, **kwargs: called.append(True))
    token = jwt.encode(claims(**{claim: float("inf")}), "isolated-audit-secret-at-least-32-bytes", algorithm="HS256")
    with pytest.raises(HTTPException) as caught:
        auth_utils.verify_access_token(token)
    assert caught.value.status_code == 401
    assert not called


def test_configuration_failure_is_clear(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    response = TestClient(create_app()).get("/auth/me", headers={"Authorization": "Bearer token"})
    assert response.status_code == 503
    assert response.json()["detail"] == "Authentication is not configured."


def test_all_application_endpoints_require_bearer():
    app = create_app()
    for path, operations in app.openapi()["paths"].items():
        for method, operation in operations.items():
            # The only intentional public data route requires an unguessable,
            # expiring, revocable passport capability. Writes still need auth.
            public_read = method == "get" and path == "/growth/public/passport/{token}"
            if method in {"get", "post", "put", "patch", "delete"} and path != "/health" and not public_read:
                assert operation.get("security"), f"Unprotected endpoint: {method} {path}"
    client = TestClient(app)
    assert client.get("/auth/me").status_code == 401
    assert client.get("/resume/all").status_code == 401
    assert client.get("/dashboard/summary").status_code == 401
    response = client.post("/analysis/skill-gap-analysis", json={"skills": ["React"], "job_requirements": ["React", "Python"]})
    assert response.status_code == 401


def test_protected_skill_gap_still_works(signing):
    response = TestClient(create_app()).post("/analysis/skill-gap-analysis", json={"skills": ["React"], "job_requirements": ["React", "Python"]}, headers={"Authorization": f"Bearer {signing(claims())}"})
    assert response.status_code == 200
    assert response.json()["missing_skills"] == ["Python"]
