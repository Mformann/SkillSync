from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from sqlalchemy.exc import SQLAlchemyError
from pathlib import Path
from typing import Any
from starlette.concurrency import run_in_threadpool

from .. import models
from ..auth_utils import AuthenticatedUser, get_current_user
from ..database import get_session
from ..schemas import (
    ResumeUploadResponse, 
    AnalysisResponse, 
    GapReportResponse, 
    RoadmapResponse
)
from ..services.document_parser import parse_resume
from ..services.analysis_views import analysis_report, gap_report, history_item, roadmap_report
from ..workspace_validation import validate_upload_fields
from ..services.analysis_runs import execute, lock_account, read_analysis
from ..services.document_parser import ResumeParseError
from ..services.list_queries import analysis_options, page, PAGE_SIZE, MAX_PAGE_SIZE

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
    request: Request,
    file: UploadFile = File(...),
    job_role: str | None = Form(default=None),
    workspace_id: int | None = Form(default=None),
    job_description: str | None = Form(default=None),
    company: str | None = Form(default=None),
    ai_consent: bool | None = Form(default=None),
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
    form = await request.form()
    fields = {name: value for name, source, value in (
        ("title", "job_role", job_role), ("description", "job_description", job_description),
        ("company", "company", company), ("ai_consent", "ai_consent", ai_consent),
    ) if source in form}
    validated = validate_upload_fields(fields, updating=workspace_id is not None)
    try:
        text = (await run_in_threadpool(parse_resume, content, ALLOWED_CONTENT_TYPES[file_extension])).strip()
    except ResumeParseError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc),
                            headers={"Retry-After": "2"} if exc.code == "busy" else None) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="The resume could not be parsed. Try exporting it again as PDF or DOCX.",
        ) from exc
    if len(text) < 40:
        raise HTTPException(
            status_code=422,
            detail="Very little readable text was found. Use selectable text in a PDF or DOCX, including table cells. Scanned images and embedded files cannot be read.",
        )

    # Parsing and field validation finish before any writes. Saved-job edits
    # and the new resume/analysis then commit together or roll back together.
    db.rollback()
    try:
        if workspace_id is not None:
            lock_account(db, current_user.id)
            workspace = db.query(models.TargetJob).filter_by(id=workspace_id, user_id=current_user.id).first()
            if workspace is None:
                raise HTTPException(404, "Workspace not found.")
            for key, value in validated.model_dump(exclude_unset=True).items():
                setattr(workspace, key, value)
        else:
            workspace = models.TargetJob(user_id=current_user.id, **validated.model_dump())
            db.add(workspace)
        db.flush()
        resume_row = models.Resume(user_id=current_user.id, target_job_id=workspace.id,
            filename=filename, content_type=ALLOWED_CONTENT_TYPES[file_extension],
            size_bytes=len(content), extracted_text=text)
        db.add(resume_row)
        db.flush()
        analysis_row = models.Analysis(user_id=current_user.id, target_job_id=workspace.id,
            resume_id=resume_row.id, job_role=workspace.title, resume_filename=filename,
            resume_text=text, analysis_status="pending")
        db.add(analysis_row)
        db.commit()
        db.refresh(analysis_row)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(503, "The resume could not be saved. Please try again.") from exc

    return ResumeUploadResponse(
        analysis_id=analysis_row.id,
        workspace_id=workspace.id,
        resume_id=resume_row.id,
        message="Workspace created and resume processed successfully."
    )

@router.get("/all")
def get_all_resumes(
    response: Response,
    limit: int = Query(default=PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    before_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
):
    """Fetches all resumes uploaded by the logged-in user for the Dashboard."""
    query = (
        db.query(models.Analysis)
        .filter(models.Analysis.user_id == current_user.id)
        .options(*analysis_options())
    )
    analyses = page(query, models.Analysis, response, limit, before_id)
    
    return [history_item(analysis) for analysis in analyses]

# =========================================================
# 2. "LATEST" ENDPOINTS (MUST BE BEFORE ID ENDPOINTS)
# =========================================================

@router.post("/analysis/{analysis_id}/run")
async def run_explainable_analysis(
    analysis_id: int,
    force: bool = False,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    return await execute(db, analysis_id, current_user.id, force)


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
    return read_analysis(db, analysis.id, current_user.id)


@router.get("/analysis/{analysis_id}/explainable")
def get_explainable_analysis(
    analysis_id: int,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    return read_analysis(db, analysis_id, current_user.id)

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
    return AnalysisResponse(**analysis_report(analysis))

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
    return GapReportResponse(**gap_report(analysis))

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
    return RoadmapResponse(**roadmap_report(analysis))

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
    return AnalysisResponse(**analysis_report(analysis))

@router.get("/gap-report/{analysis_id}", response_model=GapReportResponse)
def get_gap_report(
    analysis_id: int,
    db: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
):
    analysis = _get_user_analysis(analysis_id, current_user, db)
    return GapReportResponse(**gap_report(analysis))

@router.get("/roadmap/{analysis_id}", response_model=RoadmapResponse)
def get_roadmap(
    analysis_id: int,
    db: Session = Depends(get_session),
    current_user: Any = Depends(get_current_user),
):
    analysis = _get_user_analysis(analysis_id, current_user, db)
    return RoadmapResponse(**roadmap_report(analysis))
