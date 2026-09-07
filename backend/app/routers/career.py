from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..auth_utils import AuthenticatedUser, get_current_user
from ..database import get_session
from ..services.career_service import generate_interview_questions, readiness_summary, score_practice_answer

router = APIRouter()
APPLICATION_STATUSES = "^(preparing|applied|screening|interviewing|offer|rejected|withdrawn)$"


class ApplicationUpdate(BaseModel):
    status: str = Field(pattern=APPLICATION_STATUSES)
    job_url: str | None = Field(default=None, max_length=1000)
    next_action: str | None = Field(default=None, max_length=500)
    next_action_date: date | None = None
    notes: str | None = Field(default=None, max_length=5000)


class EvidenceCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    evidence_type: str = Field(pattern="^(project|case_study|certificate|demo|writing|other)$")
    url: str | None = Field(default=None, max_length=1000)
    description: str = Field(min_length=10, max_length=4000)
    skills: list[str] = Field(default_factory=list, max_length=20)


class AnswerUpdate(BaseModel):
    question_id: str = Field(min_length=1, max_length=80)
    answer: str = Field(min_length=20, max_length=8000)


def _workspace(workspace_id: int, user, db) -> models.TargetJob:
    item = db.query(models.TargetJob).filter(models.TargetJob.id == workspace_id, models.TargetJob.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Target job not found.")
    return item


def _application_out(item):
    if not item:
        return None
    return {
        "id": item.id, "status": item.status, "job_url": item.job_url, "applied_at": item.applied_at,
        "next_action": item.next_action, "next_action_date": item.next_action_date, "notes": item.notes,
        "updated_at": item.updated_at,
    }


def _evidence_out(item):
    return {
        "id": item.id, "title": item.title, "evidence_type": item.evidence_type, "url": item.url,
        "description": item.description, "skills": item.skills, "verified": item.verified, "created_at": item.created_at,
    }


def _session_out(item):
    return {
        "id": item.id, "analysis_id": item.analysis_id, "questions": item.questions,
        "answers": item.answers, "scores": item.scores, "status": item.status, "updated_at": item.updated_at,
    }


@router.get("/workspaces")
def career_workspaces(db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    workspaces = db.query(models.TargetJob).filter(
        models.TargetJob.user_id == current_user.id, models.TargetJob.is_archived.is_(False),
    ).order_by(models.TargetJob.updated_at.desc()).all()
    output = []
    for workspace in workspaces:
        analysis = max(workspace.analyses, key=lambda item: item.id, default=None)
        if not analysis:
            output.append({"workspace_id": workspace.id, "title": workspace.title, "company": workspace.company, "analysis_id": None, "application": _application_out(workspace.application), "readiness": None})
            continue
        output.append({
            "workspace_id": workspace.id, "title": workspace.title, "company": workspace.company,
            "analysis_id": analysis.id, "application": _application_out(workspace.application),
            "readiness": readiness_summary(
                analysis, analysis.learning_plan, len(workspace.portfolio_evidence),
                workspace.interview_sessions, bool(analysis.resume_versions),
            ),
        })
    return output


@router.get("/workspaces/{workspace_id}")
def career_workspace(workspace_id: int, db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    workspace = _workspace(workspace_id, current_user, db)
    analysis = max(workspace.analyses, key=lambda item: item.id, default=None)
    return {
        "workspace_id": workspace.id, "title": workspace.title, "company": workspace.company,
        "analysis_id": analysis.id if analysis else None, "application": _application_out(workspace.application),
        "evidence": [_evidence_out(item) for item in workspace.portfolio_evidence],
        "sessions": [_session_out(item) for item in sorted(workspace.interview_sessions, key=lambda row: row.id, reverse=True)],
        "readiness": readiness_summary(analysis, analysis.learning_plan, len(workspace.portfolio_evidence), workspace.interview_sessions, bool(analysis.resume_versions)) if analysis else None,
    }


@router.put("/workspaces/{workspace_id}/application")
def save_application(workspace_id: int, payload: ApplicationUpdate, db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    workspace = _workspace(workspace_id, current_user, db)
    item = workspace.application or models.JobApplication(user_id=current_user.id, target_job_id=workspace.id)
    previous = item.status
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    if previous != "applied" and payload.status == "applied":
        item.applied_at = datetime.now(timezone.utc)
    db.add(item)
    if previous != payload.status:
        db.add(models.ApplicationEvent(
            user_id=current_user.id, target_job_id=workspace.id, status=payload.status,
        ))
    db.commit()
    db.refresh(item)
    return _application_out(item)


@router.post("/workspaces/{workspace_id}/evidence", status_code=status.HTTP_201_CREATED)
def add_evidence(workspace_id: int, payload: EvidenceCreate, db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    workspace = _workspace(workspace_id, current_user, db)
    item = models.PortfolioEvidence(user_id=current_user.id, target_job_id=workspace.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _evidence_out(item)


@router.post("/workspaces/{workspace_id}/interview-sessions", status_code=status.HTTP_201_CREATED)
def create_interview(workspace_id: int, db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    workspace = _workspace(workspace_id, current_user, db)
    analysis = max(workspace.analyses, key=lambda item: item.id, default=None)
    if not analysis or not analysis.explainable_data:
        raise HTTPException(status_code=409, detail="Complete the job analysis before starting interview practice.")
    item = models.InterviewSession(
        user_id=current_user.id, target_job_id=workspace.id, analysis_id=analysis.id,
        questions=generate_interview_questions(analysis.explainable_data, workspace.title), answers={}, scores={},
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _session_out(item)


@router.patch("/interview-sessions/{session_id}/answer")
def save_answer(session_id: int, payload: AnswerUpdate, db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    item = db.query(models.InterviewSession).filter(models.InterviewSession.id == session_id, models.InterviewSession.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    if payload.question_id not in {question["id"] for question in item.questions}:
        raise HTTPException(status_code=422, detail="Question does not belong to this session.")
    answers, scores = dict(item.answers or {}), dict(item.scores or {})
    answers[payload.question_id] = payload.answer
    scores[payload.question_id] = score_practice_answer(payload.answer)
    item.answers, item.scores = answers, scores
    item.status = "completed" if len(answers) == len(item.questions) else "active"
    item.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return _session_out(item)
