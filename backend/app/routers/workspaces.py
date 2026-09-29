from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .. import models
from ..auth_utils import AuthenticatedUser, get_current_user
from ..database import get_session

router = APIRouter()


class WorkspaceCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    company: str | None = Field(default=None, max_length=160)
    description: str = Field(min_length=50, max_length=50_000)
    location: str | None = Field(default=None, max_length=160)
    employment_type: str | None = Field(default=None, max_length=80)
    ai_consent: bool = False


class WorkspaceUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=160)
    company: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, min_length=50, max_length=50_000)
    location: str | None = Field(default=None, max_length=160)
    employment_type: str | None = Field(default=None, max_length=80)
    is_archived: bool | None = None
    ai_consent: bool | None = None


class ResumeSummary(BaseModel):
    id: int
    filename: str
    size_bytes: int
    created_at: datetime


class WorkspaceOut(BaseModel):
    id: int
    title: str
    company: str | None
    description: str
    location: str | None
    employment_type: str | None
    is_archived: bool
    ai_consent: bool
    created_at: datetime
    updated_at: datetime
    resumes: list[ResumeSummary]
    latest_analysis_id: int | None


def serialize_workspace(workspace: models.TargetJob) -> WorkspaceOut:
    latest_analysis = max(workspace.analyses, key=lambda item: item.id, default=None)
    return WorkspaceOut(
        id=workspace.id,
        title=workspace.title,
        company=workspace.company,
        description=workspace.description,
        location=workspace.location,
        employment_type=workspace.employment_type,
        is_archived=workspace.is_archived,
        ai_consent=workspace.ai_consent,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
        resumes=[
            ResumeSummary(
                id=resume.id,
                filename=resume.filename,
                size_bytes=resume.size_bytes,
                created_at=resume.created_at,
            )
            for resume in sorted(workspace.resumes, key=lambda item: item.id, reverse=True)
        ],
        latest_analysis_id=latest_analysis.id if latest_analysis else None,
    )


def get_owned_workspace(
    workspace_id: int,
    user: AuthenticatedUser,
    db: Session,
) -> models.TargetJob:
    workspace = (
        db.query(models.TargetJob)
        .filter(models.TargetJob.id == workspace_id, models.TargetJob.user_id == user.id)
        .first()
    )
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    return workspace


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(
    include_archived: bool = False,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    query = db.query(models.TargetJob).filter(models.TargetJob.user_id == current_user.id)
    if not include_archived:
        query = query.filter(models.TargetJob.is_archived.is_(False))
    return [serialize_workspace(item) for item in query.order_by(desc(models.TargetJob.updated_at)).all()]


@router.post("", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    workspace = models.TargetJob(user_id=current_user.id, **payload.model_dump())
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return serialize_workspace(workspace)


@router.get("/{workspace_id}", response_model=WorkspaceOut)
def get_workspace(
    workspace_id: int,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    return serialize_workspace(get_owned_workspace(workspace_id, current_user, db))


@router.patch("/{workspace_id}", response_model=WorkspaceOut)
def update_workspace(
    workspace_id: int,
    payload: WorkspaceUpdate,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    workspace = get_owned_workspace(workspace_id, current_user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(workspace, key, value)
    db.commit()
    db.refresh(workspace)
    return serialize_workspace(workspace)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    workspace_id: int,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    workspace = get_owned_workspace(workspace_id, current_user, db)
    from .growth import delete_workspace_growth_data
    delete_workspace_growth_data(db, current_user.id, workspace.id)
    db.delete(workspace)
    db.commit()
