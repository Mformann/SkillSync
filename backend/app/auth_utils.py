import os
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str | None = None


def get_current_user(token: str = Depends(oauth2_scheme)) -> AuthenticatedUser:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured.",
        )

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated"),
        )
        user_id = payload.get("sub")
        if not isinstance(user_id, str) or not user_id:
            raise JWTError("Token is missing a subject.")
        email = payload.get("email")
        return AuthenticatedUser(id=user_id, email=email if isinstance(email, str) else None)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
