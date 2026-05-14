from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
import os
import uuid
from pathlib import Path
from typing import List, Optional, Any

from .. import models
from ..auth_utils import get_current_user
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

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- Helper Function ---
def _get_user_analysis(analysis_id: int, user: Any, db: Session) -> models.Analysis:
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
    db: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
):
    file_extension = Path(file.filename).suffix.lower()

    if file_extension not in [".pdf", ".docx"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only PDF and DOCX are allowed."
        )

    # Ensure upload directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    safe_name = f"{uuid.uuid4()}{file_extension}"
    file_path = Path(UPLOAD_DIR) / safe_name

    # Read file content once
    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file"
        )

    # Note: File is processed in-memory. We do not save to disk for serverless compatibility.

    # Process resume via services
    text = parse_resume(content, file.content_type or "")
    found_skills, missing_skills = extract_skills(text)

    dashboard = build_dashboard_summary(found_skills)
    analysis = build_analysis_data(found_skills, missing_skills)
    gap_report = build_gap_report(found_skills, missing_skills)
    roadmap = build_roadmap(missing_skills)

    # Create Database Entry
    analysis_row = models.Analysis(
        user_id=current_user.id,
        job_role=job_role or None,
        resume_filename=file.filename,
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
        message="Resume uploaded and analyzed successfully."
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
        if a.analysis_data and isinstance(a.analysis_data, dict):
            overview = a.analysis_data.get("overview", {})
            score = overview.get("overallScore", 0)
            
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