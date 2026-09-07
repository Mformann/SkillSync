from fastapi import APIRouter, Depends

from ..auth_utils import AuthenticatedUser, get_current_user

router = APIRouter()


@router.get("/me")
def get_me(current_user: AuthenticatedUser = Depends(get_current_user)) -> dict[str, str | None]:
    """Return the identity verified from the Supabase access token."""
    return {"id": current_user.id, "email": current_user.email}
