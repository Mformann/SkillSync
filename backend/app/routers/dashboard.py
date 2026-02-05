from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models
from ..auth_utils import get_current_user
from ..database import get_session
from ..schemas import DashboardSummary
from ..services.analysis_service import build_dashboard_summary, extract_skills

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
  db: Session = Depends(get_session),
  current_user: models.User = Depends(get_current_user),
):
  """
  Returns a summary based on the most recent analysis for the user,
  or a generic baseline if none exists yet.
  """
  analysis = (
    db.query(models.Analysis)
    .filter(models.Analysis.user_id == current_user.id)
    .order_by(models.Analysis.created_at.desc())
    .first()
  )

  if analysis and analysis.dashboard_summary:
    data = analysis.dashboard_summary
  elif analysis and analysis.resume_text:
    found, _ = extract_skills(analysis.resume_text)
    data = build_dashboard_summary(found)
  else:
    data = build_dashboard_summary([])

  # Adapt to schema keys
  return DashboardSummary(
    stats=data["stats"],
    progress_data=data["progressData"],
    recent_activity=data["recentActivity"],
    weekly_goals=data["weeklyGoals"],
    achievements=data["achievements"],
  )

