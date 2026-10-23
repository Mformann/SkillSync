from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models
from ..auth_utils import AuthenticatedUser, get_current_user
from ..database import get_session
from ..services.analysis_runs import lock_account
from ..workspace_validation import WorkspaceCreate, WorkspaceUpdate
from ..services.list_queries import workspace_summaries, PAGE_SIZE, MAX_PAGE_SIZE

router = APIRouter()


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


class WorkspaceListOut(WorkspaceOut):
    resume_count: int


def serialize_workspace(workspace: models.TargetJob, db: Session) -> WorkspaceOut:
    latest_id = db.query(func.max(models.Analysis.id)).filter_by(target_job_id=workspace.id, user_id=workspace.user_id).scalar()
    resumes = db.query(models.Resume.id, models.Resume.filename, models.Resume.size_bytes, models.Resume.created_at).filter_by(
        target_job_id=workspace.id, user_id=workspace.user_id).order_by(models.Resume.id.desc()).all()
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
            for resume in resumes
        ],
        latest_analysis_id=latest_id,
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


@router.get("", response_model=list[WorkspaceListOut])
def list_workspaces(
    response: Response,
    include_archived: bool = False,
    limit: int = Query(default=PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    before_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    return workspace_summaries(db, current_user.id, response, limit, before_id, include_archived)


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
    return serialize_workspace(workspace, db)


@router.get("/{workspace_id}", response_model=WorkspaceOut)
def get_workspace(
    workspace_id: int,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    return serialize_workspace(get_owned_workspace(workspace_id, current_user, db), db)


@router.patch("/{workspace_id}", response_model=WorkspaceOut)
def update_workspace(
    workspace_id: int,
    payload: WorkspaceUpdate,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    lock_account(db, current_user.id)
    workspace = get_owned_workspace(workspace_id, current_user, db)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(workspace, key, value)
    db.commit()
    db.refresh(workspace)
    return serialize_workspace(workspace, db)


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
