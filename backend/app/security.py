import os
import uuid
import asyncio
import logging
from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger(__name__)


class ProductionSafetyMiddleware:
    """Bound request bodies before multipart parsing, including chunked uploads."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        supplied_id = headers.get("X-Request-ID", "")
        request_id = supplied_id if 0 < len(supplied_id) <= 128 and supplied_id.isprintable() else str(uuid.uuid4())
        max_bytes = max(1, int(os.getenv("MAX_REQUEST_BYTES", str(12 * 1024 * 1024))))
        response_started = False

        async def secured_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
                response_headers = MutableHeaders(scope=message)
                # API responses include private resumes, tokens and capability links.
                response_headers["Cache-Control"] = "no-store"
                response_headers["X-Request-ID"] = request_id
                response_headers["X-Content-Type-Options"] = "nosniff"
                response_headers["X-Frame-Options"] = "DENY"
                if response_headers.get("Referrer-Policy") != "no-referrer":
                    response_headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
                response_headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
                if os.getenv("ENVIRONMENT", "development").casefold() == "production":
                    response_headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            await send(message)

        async def reject() -> None:
            response = JSONResponse(status_code=413, content={"detail": "Request body is too large.", "request_id": request_id})
            await response(scope, receive, secured_send)

        content_length = headers.get("content-length")
        try:
            if content_length is not None and not 0 <= int(content_length) <= max_bytes:
                await reject()
                return
        except ValueError:
            await reject()
            return

        # Buffer at most the configured limit; do not trust Content-Length.
        # This prevents an oversized multipart body being spooled before the
        # endpoint's per-file limit gets a chance to run.
        body = bytearray()
        received_bytes = 0
        try:
            # A single total deadline prevents slow uploads occupying memory forever.
            async with asyncio.timeout(15):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    received_bytes += len(message.get("body", b""))
                    if received_bytes > max_bytes:
                        await reject()
                        return
                    body.extend(message.get("body", b""))
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            await JSONResponse(status_code=408, content={"detail": "Upload timed out. Try again.", "request_id": request_id})(scope, receive, secured_send)
            return

        replayed = False

        async def replay() -> Message:
            nonlocal replayed
            if replayed:
                return await receive()
            replayed = True
            message: Message = {"type": "http.request", "body": bytes(body), "more_body": False}
            body.clear()
            return message

        try:
            await self.app(scope, replay, secured_send)
        except Exception as exc:
            # Log only the correlation ID: exception strings can contain SQL values
            # or provider credentials. Never expose them to browsers or shared logs.
            logger.error("Unhandled API error (%s); request_id=%s", type(exc).__name__, request_id)
            if response_started:
                raise
            await JSONResponse(status_code=500, content={
                "detail": "Something went wrong. Please try again.", "request_id": request_id,
            })(scope, receive, secured_send)
