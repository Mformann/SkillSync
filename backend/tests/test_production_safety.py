import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.security import ProductionSafetyMiddleware


def test_error_is_safe_traceable_uncached_and_readable_by_trusted_frontend(caplog):
    app = create_app()

    @app.get("/test-crash")
    def crash():
        raise RuntimeError("private resume and secret database password")

    response = TestClient(app).get("/test-crash", headers={"Origin": "http://localhost:5173", "X-Request-ID": "safe-correlation-id"})
    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.json()["request_id"] == response.headers["x-request-id"] == "safe-correlation-id"
    assert "private resume" not in response.text + caplog.text
    assert "safe-correlation-id" in caplog.text


def test_rejected_upload_keeps_cors_and_security_headers(monkeypatch):
    monkeypatch.setenv("MAX_REQUEST_BYTES", "5")
    response = TestClient(create_app()).post("/workspaces", content=b"too long", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 413
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["cache-control"] == "no-store"


def test_error_does_not_allow_untrusted_origin():
    app = create_app()

    @app.get("/test-crash")
    def crash():
        raise ValueError("private")

    response = TestClient(app).get("/test-crash", headers={"Origin": "https://evil.example"})
    assert response.status_code == 500
    assert "access-control-allow-origin" not in response.headers


def test_slow_body_times_out_before_endpoint(monkeypatch):
    real_timeout = asyncio.timeout
    monkeypatch.setattr("app.security.asyncio.timeout", lambda _: real_timeout(0.001))
    called = False
    outgoing = []

    async def downstream(scope, receive, send):
        nonlocal called
        called = True

    async def receive():
        await asyncio.sleep(1)
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        outgoing.append(message)

    asyncio.run(ProductionSafetyMiddleware(downstream)({"type": "http", "method": "POST", "headers": []}, receive, send))
    assert not called
    assert outgoing[0]["status"] == 408
    assert json.loads(outgoing[1]["body"])["detail"] == "Upload timed out. Try again."


def test_stream_error_is_not_replaced_after_headers():
    outgoing = []

    async def downstream(scope, receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        raise RuntimeError("stream failed")

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        outgoing.append(message)

    with pytest.raises(RuntimeError, match="stream failed"):
        asyncio.run(ProductionSafetyMiddleware(downstream)({"type": "http", "headers": []}, receive, send))
    assert len(outgoing) == 1


def test_health_and_unauthorized_responses_are_not_cached():
    client = TestClient(create_app())
    for path in ("/health", "/workspaces"):
        response = client.get(path)
        assert response.headers["cache-control"] == "no-store"
