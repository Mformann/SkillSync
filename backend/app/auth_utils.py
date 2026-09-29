import os
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import urlsplit

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer(auto_error=False, description="Supabase user access token")


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str | None = None


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _auth_configuration() -> tuple[str, str, str]:
    project_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    try:
        parts = urlsplit(project_url)
        local = parts.hostname in {"localhost", "127.0.0.1", "::1"}
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Authentication is not configured.") from exc
    if (
        not parts.hostname
        or parts.username
        or parts.password
        or parts.query
        or parts.fragment
        or parts.path
        or (parts.scheme != "https" and not (local and parts.scheme == "http"))
    ):
        raise HTTPException(status_code=503, detail="Authentication is not configured.")
    issuer = os.getenv("SUPABASE_JWT_ISSUER", f"{project_url}/auth/v1").strip()
    audience = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated").strip()
    if not issuer or not audience:
        raise HTTPException(status_code=503, detail="Authentication is not configured.")
    return project_url, issuer, audience


@lru_cache(maxsize=4)
def _jwks_client(project_url: str) -> jwt.PyJWKClient:
    # Cache the set briefly, not individual keys indefinitely: revoked keys expire.
    return jwt.PyJWKClient(
        f"{project_url}/auth/v1/.well-known/jwks.json",
        cache_keys=False,
        lifespan=600,
        timeout=5,
    )


def _verify_legacy_token(token: str, issuer: str, audience: str, project_url: str) -> dict:
    public_key = (
        os.getenv("SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    ).strip()
    if not public_key:
        raise HTTPException(status_code=503, detail="Authentication is not configured.")
    # Pre-check mandatory claims, then let Auth verify the legacy shared-secret signature.
    payload = jwt.decode(
        token,
        algorithms=["HS256"],
        issuer=issuer,
        audience=audience,
        options={
            "verify_signature": False,
            "verify_exp": True,
            "verify_nbf": True,
            "verify_iat": True,
            "verify_iss": True,
            "verify_aud": True,
            "require": ["exp", "iss", "aud", "sub"],
        },
    )
    try:
        response = httpx.get(
            f"{project_url}/auth/v1/user",
            headers={"apikey": public_key, "Authorization": f"Bearer {token}"},
            timeout=5,
            follow_redirects=False,
        )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Authentication service is unavailable. Try again.") from exc
    if response.status_code in {400, 401, 403}:
        raise _unauthorized()
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Authentication service is unavailable. Try again.")
    try:
        identity = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Authentication service is unavailable. Try again.") from exc
    if not isinstance(identity, dict) or identity.get("id") != payload.get("sub"):
        raise _unauthorized()
    return payload


def verify_access_token(token: str) -> AuthenticatedUser:
    project_url, issuer, audience = _auth_configuration()
    if not token or len(token) > 16_384:
        raise _unauthorized()
    try:
        algorithm = jwt.get_unverified_header(token).get("alg")
        if not isinstance(algorithm, str):
            raise _unauthorized()
        if algorithm in {"ES256", "RS256"}:
            signing_key = _jwks_client(project_url).get_signing_key_from_jwt(token)
            if signing_key.algorithm_name != algorithm:
                raise _unauthorized()
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[algorithm],
                issuer=issuer,
                audience=audience,
                options={"require": ["exp", "iss", "aud", "sub"]},
            )
        elif algorithm == "HS256":
            payload = _verify_legacy_token(token, issuer, audience, project_url)
        else:
            raise _unauthorized()
        user_id = payload.get("sub")
        if not isinstance(user_id, str) or not user_id.strip():
            raise _unauthorized()
        email = payload.get("email")
        return AuthenticatedUser(id=user_id, email=email if isinstance(email, str) else None)
    except jwt.PyJWKClientConnectionError as exc:
        raise HTTPException(status_code=503, detail="Authentication service is unavailable. Try again.") from exc
    except (jwt.PyJWTError, ValueError, TypeError, OverflowError) as exc:
        raise _unauthorized() from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise _unauthorized()
    return verify_access_token(credentials.credentials)
