import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..auth_utils import AuthenticatedUser, get_current_user
from ..database import get_session
from ..services.resume_studio_service import build_grounded_draft, claim_warnings, export_docx

router = APIRouter()


class VersionCreate(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    template: str = Field(default="classic", pattern="^(classic|modern)$")


class VersionUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    template: str = Field(pattern="^(classic|modern)$")
    content: dict


def _out(version: models.ResumeVersion) -> dict:
    return {
        "id": version.id, "analysis_id": version.analysis_id, "workspace_id": version.target_job_id,
        "name": version.name, "template": version.template, "content": version.content,
        "warnings": version.warnings, "created_at": version.created_at, "updated_at": version.updated_at,
    }


def _owned(version_id: int, user: AuthenticatedUser, db: Session) -> models.ResumeVersion:
    version = db.query(models.ResumeVersion).filter(
        models.ResumeVersion.id == version_id, models.ResumeVersion.user_id == user.id,
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Resume version not found.")
    return version


@router.post("/analyses/{analysis_id}/versions", status_code=status.HTTP_201_CREATED)
def create_version(
    analysis_id: int,
    payload: VersionCreate,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    analysis = db.query(models.Analysis).filter(
        models.Analysis.id == analysis_id, models.Analysis.user_id == current_user.id,
    ).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    if not analysis.explainable_data or not analysis.target_job_id:
        raise HTTPException(status_code=409, detail="Run the explainable analysis before tailoring a resume.")
    content, source_map = build_grounded_draft(analysis)
    count = db.query(models.ResumeVersion).filter(models.ResumeVersion.analysis_id == analysis.id).count()
    version = models.ResumeVersion(
        user_id=current_user.id, analysis_id=analysis.id, target_job_id=analysis.target_job_id,
        name=payload.name or f"{analysis.target_job.title} resume v{count + 1}",
        template=payload.template, content=content, source_map=source_map,
        warnings=claim_warnings(content, source_map, analysis.ai_provider != "groq"),
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return _out(version)


@router.get("/analyses/{analysis_id}/versions")
def list_versions(
    analysis_id: int,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    owned = db.query(models.Analysis.id).filter(
        models.Analysis.id == analysis_id, models.Analysis.user_id == current_user.id,
    ).first()
    if not owned:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    versions = db.query(models.ResumeVersion).filter(
        models.ResumeVersion.analysis_id == analysis_id,
        models.ResumeVersion.user_id == current_user.id,
    ).order_by(models.ResumeVersion.updated_at.desc()).all()
    return [_out(item) for item in versions]


@router.patch("/versions/{version_id}")
def update_version(
    version_id: int,
    payload: VersionUpdate,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    version = _owned(version_id, current_user, db)
    version.name = payload.name
    version.template = payload.template
    version.content = payload.content
    version.warnings = claim_warnings(payload.content, version.source_map)
    version.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(version)
    return _out(version)


@router.get("/versions/{version_id}/docx")
def download_docx(
    version_id: int,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    version = _owned(version_id, current_user, db)
    filename = re.sub(r"[^A-Za-z0-9._-]+", "-", version.name).strip("-") or "tailored-resume"
    return StreamingResponse(
        export_docx(version.content, version.template),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}.docx"'},
    )
