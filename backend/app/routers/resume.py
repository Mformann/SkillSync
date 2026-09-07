from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pathlib import Path
from typing import Any
from datetime import datetime, timedelta, timezone
import os

from .. import models
from ..auth_utils import AuthenticatedUser, get_current_user
from ..database import get_session
from ..schemas import (
    ResumeUploadResponse, 
    AnalysisResponse, 
    GapReportResponse, 
    RoadmapResponse
)
from ..services.analysis_service import (
    parse_resume,
    extract_skills,
    build_dashboard_summary,
    build_analysis_data,
    build_gap_report,
    build_roadmap,
)
from ..services.ai_analysis_service import (
    PROMPT_VERSION,
    GroqProvider,
    analysis_input_hash,
    calculate_scores,
    run_hybrid_analysis,
)

router = APIRouter()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

# --- Helper Function ---
def _get_user_analysis(analysis_id: int, user: AuthenticatedUser, db: Session) -> models.Analysis:
    analysis = (
        db.query(models.Analysis)
        .filter(models.Analysis.id == analysis_id, models.Analysis.user_id == user.id)
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
    return analysis

# =========================================================
# 1. UPLOAD & DASHBOARD ENDPOINTS
# =========================================================

@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    job_role: str = Form(""),
    workspace_id: int | None = Form(default=None),
    job_description: str | None = Form(default=None),
    company: str | None = Form(default=None),
    ai_consent: bool = Form(default=False),
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    filename = Path(file.filename or "resume").name
    file_extension = Path(filename).suffix.lower()

    if file_extension not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only PDF and DOCX are allowed."
        )

    content = await file.read(MAX_UPLOAD_BYTES + 1)

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file"
        )
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Resume must be 10 MB or smaller.",
        )
    if file_extension == ".pdf" and not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")
    if file_extension == ".docx" and not content.startswith(b"PK"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid DOCX file.")

    if workspace_id is not None:
        workspace = (
            db.query(models.TargetJob)
            .filter(
                models.TargetJob.id == workspace_id,
                models.TargetJob.user_id == current_user.id,
            )
            .first()
        )
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found.")
    else:
        description = (job_description or "").strip()
        if len(description) < 50:
            raise HTTPException(
                status_code=422,
                detail="A job description of at least 50 characters is required.",
            )
        workspace = models.TargetJob(
            user_id=current_user.id,
            title=(job_role or "Target role").strip(),
            company=(company or "").strip() or None,
            description=description,
            ai_consent=ai_consent,
        )
        db.add(workspace)
        db.flush()

    try:
        text = parse_resume(content, ALLOWED_CONTENT_TYPES[file_extension]).strip()
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="The resume could not be parsed. Try exporting it again as PDF or DOCX.",
        ) from exc
    if len(text) < 40:
        raise HTTPException(
            status_code=422,
            detail="Very little readable text was found in this resume.",
        )

    resume_row = models.Resume(
        user_id=current_user.id,
        target_job_id=workspace.id,
        filename=filename,
        content_type=ALLOWED_CONTENT_TYPES[file_extension],
        size_bytes=len(content),
        extracted_text=text,
    )
    db.add(resume_row)
    db.flush()

    found_skills, missing_skills = extract_skills(text)

    dashboard = build_dashboard_summary(found_skills)
    analysis = build_analysis_data(found_skills, missing_skills)
    gap_report = build_gap_report(found_skills, missing_skills)
    roadmap = build_roadmap(missing_skills)

    # Create Database Entry
    analysis_row = models.Analysis(
        user_id=current_user.id,
        target_job_id=workspace.id,
        resume_id=resume_row.id,
        job_role=workspace.title,
        resume_filename=filename,
        resume_text=text,
        skills={"found": found_skills, "missing": missing_skills},
        dashboard_summary=dashboard,
        analysis_data=analysis,
        gap_report=gap_report,
        roadmap=roadmap,
    )

    db.add(analysis_row)
    db.commit()
    db.refresh(analysis_row)

    return ResumeUploadResponse(
        analysis_id=analysis_row.id,
        workspace_id=workspace.id,
        resume_id=resume_row.id,
        message="Workspace created and resume processed successfully."
    )

@router.get("/all")
def get_all_resumes(
    db: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
):
    """Fetches all resumes uploaded by the logged-in user for the Dashboard."""
    analyses = (
        db.query(models.Analysis)
        .filter(models.Analysis.user_id == current_user.id)
        .order_by(desc(models.Analysis.created_at))
        .all()
    )
    
    results = []
    for a in analyses:
        # Extract the score safely from the JSON data if it exists
        score = 0
        if a.score_breakdown and isinstance(a.score_breakdown, dict):
            score = a.score_breakdown.get("overall", 0)
        if a.analysis_data and isinstance(a.analysis_data, dict):
            overview = a.analysis_data.get("overview", {})
            score = score or overview.get("overallScore", 0)
            
        results.append({
            "id": a.id,
            "filename": a.resume_filename,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "score": score,
            "status": "analyzed"
        })
        
    return results

# =========================================================
# 2. "LATEST" ENDPOINTS (MUST BE BEFORE ID ENDPOINTS)
# =========================================================

def _serialize_explainable(analysis: models.Analysis) -> dict:
    workspace = analysis.target_job
    context = {
        "job_title": workspace.title if workspace else analysis.job_role,
        "company": workspace.company if workspace else None,
        "resume_filename": (
            analysis.resume.filename if analysis.resume else analysis.resume_filename
        ),
    }
    if not analysis.explainable_data:
        return {
            "analysis_id": analysis.id,
            "workspace_id": analysis.target_job_id,
            "status": analysis.analysis_status or "pending",
            "provider": analysis.ai_provider,
            "model": analysis.ai_model,
            "prompt_version": analysis.prompt_version,
            "fallback_reason": analysis.analysis_error,
            "scores": analysis.score_breakdown,
            "result": None,
            "context": context,
        }
    return {
        "analysis_id": analysis.id,
        "workspace_id": analysis.target_job_id,
        "status": analysis.analysis_status,
        "provider": analysis.ai_provider,
        "model": analysis.ai_model,
        "prompt_version": analysis.prompt_version,
        "fallback_reason": analysis.analysis_error,
        "scores": analysis.score_breakdown,
        "result": analysis.explainable_data,
        "context": context,
    }


@router.post("/analysis/{analysis_id}/run")
def run_explainable_analysis(
    analysis_id: int,
    force: bool = False,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    analysis = _get_user_analysis(analysis_id, current_user, db)
    if analysis.explainable_data and not force:
        return _serialize_explainable(analysis)

    workspace = analysis.target_job
    resume = analysis.resume
    job_description = workspace.description if workspace else ""
    resume_text = resume.extracted_text if resume else (analysis.resume_text or "")
    if not job_description or not resume_text:
        raise HTTPException(
            status_code=422,
            detail="This older analysis is missing a linked job description or resume. Create a new target workspace.",
        )

    configured_model = GroqProvider().model
    input_hash = analysis_input_hash(job_description, resume_text, configured_model)
    cached = (
        db.query(models.Analysis)
        .filter(
            models.Analysis.user_id == current_user.id,
            models.Analysis.input_hash == input_hash,
            models.Analysis.explainable_data.isnot(None),
            models.Analysis.id != analysis.id,
        )
        .order_by(desc(models.Analysis.id))
        .first()
    )
    if cached and not force:
        analysis.analysis_status = "completed_cached"
        analysis.ai_provider = cached.ai_provider
        analysis.ai_model = cached.ai_model
        analysis.input_hash = input_hash
        analysis.prompt_version = cached.prompt_version
        analysis.analyzed_at = datetime.now(timezone.utc)
        analysis.explainable_data = cached.explainable_data
        analysis.score_breakdown = cached.score_breakdown
        analysis.analysis_error = cached.analysis_error
        db.commit()
        db.refresh(analysis)
        return _serialize_explainable(analysis)

    analysis.analysis_status = "processing"
    analysis.analysis_error = None
    db.commit()
    try:
        daily_limit = max(1, int(os.getenv("AI_DAILY_ANALYSIS_LIMIT", "5")))
        window_start = datetime.now(timezone.utc) - timedelta(hours=24)
        recent_ai_runs = (
            db.query(models.Analysis)
            .filter(
                models.Analysis.user_id == current_user.id,
                models.Analysis.ai_provider == "groq",
                models.Analysis.analysis_status == "completed_ai",
                models.Analysis.analyzed_at >= window_start,
            )
            .count()
        )
        consented = bool(workspace.ai_consent)
        within_limit = recent_ai_runs < daily_limit
        unavailable_reason = None
        if not consented:
            unavailable_reason = "External AI processing was not enabled for this workspace."
        elif not within_limit:
            unavailable_reason = f"The free-tier safety limit of {daily_limit} AI analyses per 24 hours was reached."
        provider_result = run_hybrid_analysis(
            job_description,
            resume_text,
            allow_external_ai=consented and within_limit,
            unavailable_reason=unavailable_reason,
        )
        scores = calculate_scores(provider_result.analysis)
        analysis.analysis_status = (
            "completed_ai" if provider_result.provider == "groq" else "completed_fallback"
        )
        analysis.ai_provider = provider_result.provider
        analysis.ai_model = provider_result.model
        analysis.input_hash = input_hash
        analysis.prompt_version = PROMPT_VERSION
        analysis.analyzed_at = datetime.now(timezone.utc)
        analysis.explainable_data = provider_result.analysis.model_dump(mode="json")
        analysis.score_breakdown = scores
        analysis.analysis_error = provider_result.fallback_reason
        db.commit()
        db.refresh(analysis)
        return _serialize_explainable(analysis)
    except Exception as exc:
        analysis.analysis_status = "failed"
        analysis.analysis_error = "Analysis failed. Please retry."
        db.commit()
        raise HTTPException(status_code=503, detail="Analysis could not be completed.") from exc


@router.get("/analysis/latest/explainable")
def get_latest_explainable_analysis(
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    analysis = (
        db.query(models.Analysis)
        .filter(models.Analysis.user_id == current_user.id)
        .order_by(desc(models.Analysis.id))
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this user.")
    return _serialize_explainable(analysis)


@router.get("/analysis/{analysis_id}/explainable")
def get_explainable_analysis(
    analysis_id: int,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    return _serialize_explainable(_get_user_analysis(analysis_id, current_user, db))

@router.get("/analysis/latest", response_model=AnalysisResponse)
def get_latest_analysis(
    db: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
):
    analysis = (
        db.query(models.Analysis)
        .filter(models.Analysis.user_id == current_user.id)
        .order_by(desc(models.Analysis.id))
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this user")
    return AnalysisResponse(**analysis.analysis_data)

@router.get("/gap-report/latest", response_model=GapReportResponse)
def get_latest_gap_report(
    db: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
):
    analysis = (
        db.query(models.Analysis)
        .filter(models.Analysis.user_id == current_user.id)
        .order_by(desc(models.Analysis.id))
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="No gap report found")
    return GapReportResponse(**analysis.gap_report)

@router.get("/roadmap/latest", response_model=RoadmapResponse)
def get_latest_roadmap(
    db: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
):
    analysis = (
        db.query(models.Analysis)
        .filter(models.Analysis.user_id == current_user.id)
        .order_by(desc(models.Analysis.id))
        .first()
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="No roadmap found")
    return RoadmapResponse(**analysis.roadmap)

# =========================================================
# 3. SPECIFIC ID ENDPOINTS (MUST BE LAST)
# =========================================================

@router.get("/analysis/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
):
    analysis = _get_user_analysis(analysis_id, current_user, db)
    return AnalysisResponse(**analysis.analysis_data)

@router.get("/gap-report/{analysis_id}", response_model=GapReportResponse)
def get_gap_report(
    analysis_id: int,
    db: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
):
    analysis = _get_user_analysis(analysis_id, current_user, db)
    return GapReportResponse(**analysis.gap_report)

@router.get("/roadmap/{analysis_id}", response_model=RoadmapResponse)
def get_roadmap(
    analysis_id: int,
    db: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
):
    analysis = _get_user_analysis(analysis_id, current_user, db)
    return RoadmapResponse(**analysis.roadmap)
