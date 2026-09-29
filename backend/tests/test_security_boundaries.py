import json

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.responses import JSONResponse

from app.auth_utils import AuthenticatedUser, get_current_user, verify_access_token
from app.database import Base, get_session
from app.main import create_app
from app.security import ProductionSafetyMiddleware


@pytest.mark.parametrize("algorithm", [None, 42, [], {}])
def test_malformed_algorithm_is_unauthorized(monkeypatch, algorithm):
    monkeypatch.setenv("SUPABASE_URL", "https://test-project.supabase.co")
    header = jwt.utils.base64url_encode(json.dumps({"alg": algorithm}).encode()).decode()
    with pytest.raises(HTTPException) as error:
        verify_access_token(f"{header}.e30.c2lnbmF0dXJl")
    assert error.value.status_code == 401


def test_malformed_project_configuration_is_service_error(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://[invalid")
    with pytest.raises(HTTPException) as error:
        verify_access_token("anything")
    assert error.value.status_code == 503


@pytest.mark.parametrize("declared_length", [None, b"3", b"100", b"invalid", b"-1"])
def test_request_limit_cannot_be_bypassed_by_chunking_or_false_length(monkeypatch, declared_length):
    import asyncio

    monkeypatch.setenv("MAX_REQUEST_BYTES", "5")
    called = False

    async def downstream(scope, receive, send):
        nonlocal called
        called = True
        await JSONResponse({"ok": True})(scope, receive, send)

    incoming = iter([
        {"type": "http.request", "body": b"123", "more_body": True},
        {"type": "http.request", "body": b"456", "more_body": False},
    ])
    outgoing = []

    async def receive():
        return next(incoming, {"type": "http.disconnect"})

    async def send(message):
        outgoing.append(message)

    scope = {"type": "http", "method": "POST", "headers": [(b"content-length", declared_length)] if declared_length else []}
    asyncio.run(ProductionSafetyMiddleware(downstream)(scope, receive, send))
    assert not called
    assert outgoing[0]["status"] == 413
    assert dict(outgoing[0]["headers"])[b"x-content-type-options"] == b"nosniff"


def test_workspace_ownership_isolated_between_two_users():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    app = create_app()
    identity = {"id": "user-a"}

    def database():
        with factory() as db:
            yield db

    app.dependency_overrides[get_session] = database
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=identity["id"])
    client = TestClient(app)
    payload = {"title": "Frontend engineer", "description": "Build accessible React applications with TypeScript and automated tests."}
    first = client.post("/workspaces", json=payload)
    assert first.status_code == 201
    workspace_id = first.json()["id"]
    identity["id"] = "user-b"
    assert client.get("/workspaces").json() == []
    assert client.get(f"/workspaces/{workspace_id}").status_code == 404
    assert client.patch(f"/workspaces/{workspace_id}", json={"title": "Hijacked"}).status_code == 404
    assert client.delete(f"/workspaces/{workspace_id}").status_code == 404
    identity["id"] = "user-a"
    own = client.get(f"/workspaces/{workspace_id}")
    assert own.status_code == 200
    assert own.json()["title"] == payload["title"]
    engine.dispose()


@pytest.mark.parametrize("origin, expected", [("http://localhost:5173", 200), ("http://127.0.0.1:5173", 200), ("https://untrusted.example", 400)])
def test_local_cors_allows_frontend_origins_without_wildcard(monkeypatch, origin, expected):
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    response = TestClient(create_app()).options("/auth/me", headers={"Origin": origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"})
    assert response.status_code == expected
    if expected == 200:
        assert response.headers["access-control-allow-origin"] == origin
    else:
        assert "access-control-allow-origin" not in response.headers
