import os
from urllib.parse import urlsplit


LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def is_production() -> bool:
    return os.getenv("ENVIRONMENT", "development").strip().casefold() == "production"


def api_docs_enabled() -> bool:
    configured = os.getenv("ENABLE_API_DOCS")
    if configured is None:
        return not is_production()
    normalized = configured.strip().casefold()
    if normalized not in {"true", "false"}:
        raise RuntimeError("ENABLE_API_DOCS must be either true or false.")
    return normalized == "true"


def cors_origins() -> list[str]:
    configured = os.getenv("CORS_ORIGINS")
    if configured is None:
        if is_production():
            raise RuntimeError("CORS_ORIGINS is required in production.")
        configured = "http://localhost:5173,http://127.0.0.1:5173"

    origins: list[str] = []
    for candidate in configured.split(","):
        origin = candidate.strip().rstrip("/")
        if not origin:
            continue
        if origin == "*":
            raise RuntimeError("CORS_ORIGINS cannot contain a wildcard.")
        try:
            parts = urlsplit(origin)
        except ValueError as exc:
            raise RuntimeError(f"Invalid CORS origin: {origin}") from exc
        local = parts.hostname in LOCAL_HOSTS
        valid_scheme = parts.scheme == "https" or (
            parts.scheme == "http" and local and not is_production()
        )
        if (
            not parts.hostname
            or not valid_scheme
            or parts.username
            or parts.password
            or parts.path
            or parts.query
            or parts.fragment
        ):
            raise RuntimeError(f"Invalid CORS origin: {origin}")
        if origin not in origins:
            origins.append(origin)

    if not origins:
        raise RuntimeError("CORS_ORIGINS must contain at least one trusted origin.")
    return origins


def validate_runtime_configuration() -> None:
    # Parse shared settings during startup so a bad deployment fails before it
    # begins accepting requests.
    cors_origins()
    api_docs_enabled()
    try:
        max_request_bytes = int(
            os.getenv("MAX_REQUEST_BYTES", str(12 * 1024 * 1024))
        )
    except ValueError as exc:
        raise RuntimeError("MAX_REQUEST_BYTES must be a positive integer.") from exc
    if max_request_bytes < 1:
        raise RuntimeError("MAX_REQUEST_BYTES must be a positive integer.")

    if not is_production():
        return

    database_url = os.getenv("DATABASE_URL", "").strip().casefold()
    if not database_url.startswith(
        ("postgres://", "postgresql://", "postgresql+psycopg://")
    ):
        raise RuntimeError("Production requires a persistent PostgreSQL DATABASE_URL.")

    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    try:
        parts = urlsplit(supabase_url)
    except ValueError as exc:
        raise RuntimeError("SUPABASE_URL must be a valid HTTPS project origin.") from exc
    if (
        parts.scheme != "https"
        or not parts.hostname
        or parts.username
        or parts.password
        or parts.path
        or parts.query
        or parts.fragment
    ):
        raise RuntimeError("SUPABASE_URL must be a valid HTTPS project origin.")
