from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..auth_utils import AuthenticatedUser, get_current_user
from ..database import get_session
from ..services.application_package_service import build_application_package, package_warnings

router = APIRouter()


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=160)
    headline: str | None = Field(default=None, max_length=240)
    location: str | None = Field(default=None, max_length=160)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=80)
    links: list[str] = Field(default_factory=list, max_length=10)
    role_preferences: list[str] = Field(default_factory=list, max_length=20)


class AchievementCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    statement: str = Field(min_length=10, max_length=2000)
    skills: list[str] = Field(default_factory=list, max_length=20)
    source_note: str = Field(min_length=3, max_length=500)
    source_url: str | None = Field(default=None, max_length=1000)


class PackageUpdate(BaseModel):
    content: dict[str, str]


class DeleteConfirmation(BaseModel):
    confirmation: str


def _profile_out(profile) -> dict:
    return {
        "id": profile.id, "full_name": profile.full_name, "headline": profile.headline,
        "location": profile.location, "email": profile.email, "phone": profile.phone,
        "links": profile.links, "role_preferences": profile.role_preferences,
        "achievements": [{
            "id": item.id, "title": item.title, "statement": item.statement, "skills": item.skills,
            "source_note": item.source_note, "source_url": item.source_url,
            "verification_status": item.verification_status,
        } for item in profile.achievements],
    }


def _package_out(item) -> dict:
    return {
        "id": item.id, "workspace_id": item.target_job_id, "analysis_id": item.analysis_id,
        "content": item.content, "source_map": item.source_map, "warnings": item.warnings,
        "updated_at": item.updated_at,
    }


@router.get("/vault")
def get_vault(db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    profile = db.query(models.CareerProfile).filter(models.CareerProfile.user_id == current_user.id).first()
    if not profile:
        profile = models.CareerProfile(user_id=current_user.id, email=current_user.email, links=[], role_preferences=[])
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return _profile_out(profile)


@router.put("/vault")
def save_vault(payload: ProfileUpdate, db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    profile = db.query(models.CareerProfile).filter(models.CareerProfile.user_id == current_user.id).first()
    if not profile:
        profile = models.CareerProfile(user_id=current_user.id)
        db.add(profile)
    for key, value in payload.model_dump().items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return _profile_out(profile)


@router.post("/vault/achievements", status_code=status.HTTP_201_CREATED)
def add_achievement(payload: AchievementCreate, db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    profile = db.query(models.CareerProfile).filter(models.CareerProfile.user_id == current_user.id).first()
    if not profile:
        profile = models.CareerProfile(user_id=current_user.id, links=[], role_preferences=[])
        db.add(profile)
        db.flush()
    item = models.CareerAchievement(profile_id=profile.id, user_id=current_user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(profile)
    return _profile_out(profile)


@router.delete("/vault/achievements/{achievement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_achievement(achievement_id: int, db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    item = db.query(models.CareerAchievement).filter(
        models.CareerAchievement.id == achievement_id, models.CareerAchievement.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Achievement not found.")
    db.delete(item)
    db.commit()


@router.post("/workspaces/{workspace_id}/package")
def create_package(workspace_id: int, db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    workspace = db.query(models.TargetJob).filter(
        models.TargetJob.id == workspace_id, models.TargetJob.user_id == current_user.id,
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Target job not found.")
    analysis = max(workspace.analyses, key=lambda row: row.id, default=None)
    if not analysis or not analysis.explainable_data:
        raise HTTPException(status_code=409, detail="Complete the explainable analysis first.")
    profile = db.query(models.CareerProfile).filter(models.CareerProfile.user_id == current_user.id).first()
    content, sources, warnings = build_application_package(
        analysis, profile, list(profile.achievements) if profile else [],
    )
    item = db.query(models.ApplicationPackage).filter(
        models.ApplicationPackage.target_job_id == workspace.id,
        models.ApplicationPackage.user_id == current_user.id,
    ).first()
    if not item:
        item = models.ApplicationPackage(
            user_id=current_user.id, target_job_id=workspace.id, analysis_id=analysis.id,
        )
        db.add(item)
    item.analysis_id, item.content, item.source_map, item.warnings = analysis.id, content, sources, warnings
    item.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return _package_out(item)


@router.get("/workspaces/{workspace_id}/package")
def get_package(workspace_id: int, db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    item = db.query(models.ApplicationPackage).filter(
        models.ApplicationPackage.target_job_id == workspace_id,
        models.ApplicationPackage.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Application package not generated.")
    return _package_out(item)


@router.patch("/packages/{package_id}")
def update_package(package_id: int, payload: PackageUpdate, db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    item = db.query(models.ApplicationPackage).filter(
        models.ApplicationPackage.id == package_id, models.ApplicationPackage.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Application package not found.")
    allowed = {"cover_letter", "recruiter_outreach", "follow_up"}
    if set(payload.content) != allowed:
        raise HTTPException(status_code=422, detail="Application package sections are invalid.")
    item.content = payload.content
    item.warnings = package_warnings(payload.content, item.source_map)
    item.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return _package_out(item)


@router.get("/analytics")
def outcome_analytics(db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    events = db.query(models.ApplicationEvent).filter(models.ApplicationEvent.user_id == current_user.id).all()
    latest = {}
    for event in sorted(events, key=lambda row: row.occurred_at):
        latest[event.target_job_id] = event.status
    stages = {"applied": 0, "screening": 0, "interviewing": 0, "offer": 0}
    ranks = {"preparing": 0, "applied": 1, "screening": 2, "interviewing": 3, "offer": 4, "rejected": 1, "withdrawn": 1}
    for stage in latest.values():
        for key, threshold in (("applied", 1), ("screening", 2), ("interviewing", 3), ("offer", 4)):
            if ranks.get(stage, 0) >= threshold:
                stages[key] += 1
    applied = stages["applied"]
    return {
        "unique_applications": applied, "stages": stages,
        "screening_rate": round(stages["screening"] / applied * 100) if applied else 0,
        "interview_rate": round(stages["interviewing"] / applied * 100) if applied else 0,
        "offer_rate": round(stages["offer"] / applied * 100) if applied else 0,
        "note": "Observed outcomes only. These rates are not hiring predictions.",
    }


@router.get("/privacy/export")
def export_user_data(db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    from .growth import export_growth_data
    workspaces = db.query(models.TargetJob).filter(models.TargetJob.user_id == current_user.id).all()
    profile = db.query(models.CareerProfile).filter(models.CareerProfile.user_id == current_user.id).first()
    return {
        "exported_at": datetime.now(timezone.utc), "user_id": current_user.id,
        "career_growth": export_growth_data(db, current_user.id),
        "career_profile": _profile_out(profile) if profile else None,
        "target_jobs": [{
            "id": item.id, "title": item.title, "company": item.company, "description": item.description,
            "location": item.location, "employment_type": item.employment_type, "created_at": item.created_at,
        } for item in workspaces],
        "applications": [_application_export(item) for item in db.query(models.JobApplication).filter(models.JobApplication.user_id == current_user.id).all()],
        "portfolio_evidence": [{
            "title": item.title, "type": item.evidence_type, "url": item.url,
            "description": item.description, "skills": item.skills,
        } for item in db.query(models.PortfolioEvidence).filter(models.PortfolioEvidence.user_id == current_user.id).all()],
        "resumes": [{
            "id": item.id, "target_job_id": item.target_job_id, "filename": item.filename,
            "content_type": item.content_type, "extracted_text": item.extracted_text, "created_at": item.created_at,
        } for item in db.query(models.Resume).filter(models.Resume.user_id == current_user.id).all()],
        "analyses": [{
            "id": item.id, "target_job_id": item.target_job_id, "resume_id": item.resume_id,
            "status": item.analysis_status, "provider": item.ai_provider, "model": item.ai_model,
            "explainable_data": item.explainable_data, "score_breakdown": item.score_breakdown,
            "created_at": item.created_at, "analyzed_at": item.analyzed_at,
        } for item in db.query(models.Analysis).filter(models.Analysis.user_id == current_user.id).all()],
        "learning_plans": [{
            "id": item.id, "target_job_id": item.target_job_id, "analysis_id": item.analysis_id,
            "hours_per_week": item.hours_per_week, "target_date": item.target_date,
            "experience_level": item.experience_level, "status": item.status,
            "tasks": [{
                "skill": task.skill, "title": task.title, "progress": task.progress,
                "status": task.status, "due_date": task.due_date, "evidence_url": task.evidence_url,
                "reflection": task.reflection, "assessment_score": task.assessment_score,
            } for task in item.tasks],
        } for item in db.query(models.LearningPlan).filter(models.LearningPlan.user_id == current_user.id).all()],
        "resume_versions": [{
            "id": item.id, "analysis_id": item.analysis_id, "name": item.name,
            "template": item.template, "content": item.content, "warnings": item.warnings,
        } for item in db.query(models.ResumeVersion).filter(models.ResumeVersion.user_id == current_user.id).all()],
        "interview_sessions": [{
            "id": item.id, "target_job_id": item.target_job_id, "analysis_id": item.analysis_id,
            "questions": item.questions, "answers": item.answers, "scores": item.scores,
        } for item in db.query(models.InterviewSession).filter(models.InterviewSession.user_id == current_user.id).all()],
        "application_packages": [{
            "target_job_id": item.target_job_id, "analysis_id": item.analysis_id,
            "content": item.content, "source_map": item.source_map, "warnings": item.warnings,
        } for item in db.query(models.ApplicationPackage).filter(models.ApplicationPackage.user_id == current_user.id).all()],
        "application_events": [{
            "target_job_id": item.target_job_id, "status": item.status, "occurred_at": item.occurred_at,
        } for item in db.query(models.ApplicationEvent).filter(models.ApplicationEvent.user_id == current_user.id).all()],
    }


def _application_export(item) -> dict:
    return {
        "target_job_id": item.target_job_id, "status": item.status, "job_url": item.job_url,
        "applied_at": item.applied_at, "next_action": item.next_action,
        "next_action_date": item.next_action_date, "notes": item.notes,
    }


@router.post("/privacy/delete-app-data")
def delete_app_data(payload: DeleteConfirmation, db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    if payload.confirmation != "DELETE MY SKILLSYNC DATA":
        raise HTTPException(status_code=422, detail="Confirmation phrase does not match.")
    user_id = current_user.id
    from .growth import delete_growth_data
    delete_growth_data(db, user_id)
    plan_ids = [row.id for row in db.query(models.LearningPlan.id).filter(models.LearningPlan.user_id == user_id)]
    if plan_ids:
        db.query(models.LearningTask).filter(models.LearningTask.plan_id.in_(plan_ids)).delete(synchronize_session=False)
    for model in (
        models.ApplicationEvent, models.ApplicationPackage, models.InterviewSession,
        models.PortfolioEvidence, models.JobApplication, models.ResumeVersion,
        models.LearningPlan, models.Analysis, models.Resume, models.TargetJob,
        models.CareerAchievement, models.CareerProfile,
    ):
        db.query(model).filter(model.user_id == user_id).delete(synchronize_session=False)
    db.commit()
    return {"deleted": True, "scope": "SkillSync application data", "identity_account_deleted": False}
