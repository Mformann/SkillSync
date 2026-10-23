from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models
from ..auth_utils import AuthenticatedUser, get_current_user
from ..database import get_session
from ..schemas import DashboardSummary
from ..services.analysis_views import dashboard_summary
from ..services.list_queries import analysis_options
from sqlalchemy.orm import selectinload

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_session), current_user: AuthenticatedUser = Depends(get_current_user)):
    analyses = db.query(models.Analysis).filter(models.Analysis.user_id == current_user.id).order_by(
        models.Analysis.id.desc()).options(*analysis_options(),
        selectinload(models.Analysis.learning_plan).selectinload(models.LearningPlan.tasks)).yield_per(100)
    return dashboard_summary(analyses)
