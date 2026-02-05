from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
import os
from pathlib import Path

from .. import models
from ..auth_utils import get_current_user
from ..database import get_session
from ..schemas import ResumeUploadResponse, AnalysisResponse, GapReportResponse, RoadmapResponse
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


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
  file: UploadFile = File(...),
  job_role: str = Form(default=""),
  db: Session = Depends(get_session),
  current_user: models.User = Depends(get_current_user),
):
  file_extension = Path(file.filename).suffix
  if file_extension not in [".pdf", ".docx"]:
      raise HTTPException(status_code=400, detail="Invalid file type. Only PDF and DOCX are allowed.")

  file_path = Path(UPLOAD_DIR) / file.filename
  with open(file_path, "wb") as f:
      f.write(await file.read())

  content = await file.read()
  if not content:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

  text = parse_resume(content, file.content_type or "")
  found_skills, missing_skills = extract_skills(text)

  dashboard = build_dashboard_summary(found_skills)
  analysis = build_analysis_data(found_skills, missing_skills)
  gap_report = build_gap_report(found_skills, missing_skills)
  roadmap = build_roadmap(missing_skills)

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

  return ResumeUploadResponse(analysis_id=analysis_row.id, message="Resume uploaded and analyzed successfully.")


def _get_user_analysis(analysis_id: int, user: models.User, db: Session) -> models.Analysis:
  analysis = (
    db.query(models.Analysis)
    .filter(models.Analysis.id == analysis_id, models.Analysis.user_id == user.id)
    .first()
  )
  if not analysis:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
  return analysis


@router.get("/analysis/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(
  analysis_id: int,
  db: Session = Depends(get_session),
  current_user: models.User = Depends(get_current_user),
):
  analysis = _get_user_analysis(analysis_id, current_user, db)
  return AnalysisResponse(**analysis.analysis_data)


@router.get("/gap-report/{analysis_id}", response_model=GapReportResponse)
def get_gap_report(
  analysis_id: int,
  db: Session = Depends(get_session),
  current_user: models.User = Depends(get_current_user),
):
  analysis = _get_user_analysis(analysis_id, current_user, db)
  return GapReportResponse(**analysis.gap_report)


@router.get("/roadmap/{analysis_id}", response_model=RoadmapResponse)
def get_roadmap(
  analysis_id: int,
  db: Session = Depends(get_session),
  current_user: models.User = Depends(get_current_user),
):
  analysis = _get_user_analysis(analysis_id, current_user, db)
  return RoadmapResponse(**analysis.roadmap)

