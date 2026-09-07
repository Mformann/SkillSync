from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..auth_utils import AuthenticatedUser, get_current_user
from ..database import get_session
from ..services.roadmap_service import (
    _practical_test_for,
    _youtube_resources_for,
    build_plan_tasks,
    plan_progress,
    readiness_label,
)

router = APIRouter()


class PlanCreate(BaseModel):
    analysis_id: int
    hours_per_week: float = Field(ge=1, le=40)
    target_date: date
    experience_level: str = Field(pattern="^(beginner|intermediate|advanced)$")


class TaskUpdate(BaseModel):
    progress: int | None = Field(default=None, ge=0, le=100)
    evidence_url: str | None = Field(default=None, max_length=1000)
    reflection: str | None = Field(default=None, max_length=4000)
    assessment_score: int | None = Field(default=None, ge=0, le=100)


def _task_out(task: models.LearningTask) -> dict:
    res = dict(task.resource) if isinstance(task.resource, dict) else {}
    if "youtube" not in res or not res["youtube"]:
        res["youtube"] = _youtube_resources_for(task.skill)
    if "practical_test" not in res or not res["practical_test"]:
        res["practical_test"] = _practical_test_for(task.skill)

    return {
        "id": task.id,
        "skill": task.skill,
        "title": task.title,
        "category": task.category,
        "order_index": task.order_index,
        "priority_score": task.priority_score,
        "estimated_hours": task.estimated_hours,
        "status": task.status,
        "progress": task.progress,
        "due_date": task.due_date,
        "prerequisites": task.prerequisites,
        "resource": res,
        "practical_test": res.get("practical_test"),
        "objective": task.objective,
        "project_brief": task.project_brief,
        "assessment_criteria": task.assessment_criteria,
        "evidence_url": task.evidence_url,
        "reflection": task.reflection,
        "assessment_score": task.assessment_score,
        "completed_at": task.completed_at,
    }


def _plan_out(plan: models.LearningPlan) -> dict:
    tasks = list(plan.tasks)
    completed = sum(1 for task in tasks if task.status == "completed")
    return {
        "id": plan.id,
        "analysis_id": plan.analysis_id,
        "workspace_id": plan.target_job_id,
        "hours_per_week": plan.hours_per_week,
        "target_date": plan.target_date,
        "experience_level": plan.experience_level,
        "status": plan.status,
        "total_estimated_hours": plan.total_estimated_hours,
        "overall_progress": plan_progress(tasks),
        "readiness": readiness_label(tasks, plan.target_date),
        "completed_tasks": completed,
        "total_tasks": len(tasks),
        "tasks": [_task_out(task) for task in tasks],
    }


def _owned_plan(plan_id: int, user: AuthenticatedUser, db: Session) -> models.LearningPlan:
    plan = db.query(models.LearningPlan).filter(
        models.LearningPlan.id == plan_id,
        models.LearningPlan.user_id == user.id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Learning plan not found.")
    return plan


@router.post("/plans", status_code=status.HTTP_201_CREATED)
def create_or_recalculate_plan(
    payload: PlanCreate,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if payload.target_date <= date.today():
        raise HTTPException(status_code=422, detail="Target date must be in the future.")
    if (payload.target_date - date.today()).days > 365:
        raise HTTPException(status_code=422, detail="Target date must be within one year.")
    analysis = db.query(models.Analysis).filter(
        models.Analysis.id == payload.analysis_id,
        models.Analysis.user_id == current_user.id,
    ).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    if not analysis.explainable_data:
        raise HTTPException(status_code=409, detail="Run the explainable job analysis before creating a roadmap.")
    if not analysis.target_job_id:
        raise HTTPException(status_code=422, detail="This analysis is not linked to a target-job workspace.")

    generated = build_plan_tasks(
        analysis.explainable_data,
        payload.hours_per_week,
        payload.target_date,
        payload.experience_level,
    )
    if not generated:
        raise HTTPException(status_code=422, detail="No actionable gaps were found for this analysis.")

    plan = db.query(models.LearningPlan).filter(
        models.LearningPlan.analysis_id == analysis.id,
        models.LearningPlan.user_id == current_user.id,
    ).first()
    if not plan:
        plan = models.LearningPlan(
            user_id=current_user.id,
            target_job_id=analysis.target_job_id,
            analysis_id=analysis.id,
            hours_per_week=payload.hours_per_week,
            target_date=payload.target_date,
            experience_level=payload.experience_level,
            total_estimated_hours=sum(item["estimated_hours"] for item in generated),
        )
        db.add(plan)
        db.flush()
    else:
        for task in list(plan.tasks):
            if task.status != "completed":
                db.delete(task)
        db.flush()

    plan.hours_per_week = payload.hours_per_week
    plan.target_date = payload.target_date
    plan.experience_level = payload.experience_level
    plan.total_estimated_hours = sum(item["estimated_hours"] for item in generated)
    plan.status = "active"

    existing_skills = {
        task.skill.casefold() for task in plan.tasks if task.status == "completed"
    }
    for item in generated:
        if item["skill"].casefold() in existing_skills:
            continue
        db.add(models.LearningTask(plan_id=plan.id, **item))
    db.commit()
    db.refresh(plan)
    return _plan_out(plan)


@router.get("/plans/by-analysis/{analysis_id}")
def get_plan_for_analysis(
    analysis_id: int,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    plan = db.query(models.LearningPlan).filter(
        models.LearningPlan.analysis_id == analysis_id,
        models.LearningPlan.user_id == current_user.id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="No learning plan exists for this analysis.")
    return _plan_out(plan)


@router.get("/plans/latest")
def get_latest_plan(
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    plan = (
        db.query(models.LearningPlan)
        .filter(models.LearningPlan.user_id == current_user.id)
        .order_by(models.LearningPlan.updated_at.desc())
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="No learning plan exists yet.")
    return _plan_out(plan)


@router.patch("/tasks/{task_id}")
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    task = (
        db.query(models.LearningTask)
        .join(models.LearningPlan)
        .filter(models.LearningTask.id == task_id, models.LearningPlan.user_id == current_user.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Learning task not found.")
    values = payload.model_dump(exclude_unset=True)
    for field in ["evidence_url", "reflection", "assessment_score"]:
        if field in values:
            setattr(task, field, values[field] or None)
    if payload.progress is not None:
        if payload.progress == 100:
            evidence = (values.get("evidence_url", task.evidence_url) or "").strip()
            reflection = (values.get("reflection", task.reflection) or "").strip()
            if not evidence or len(reflection) < 20:
                raise HTTPException(
                    status_code=422,
                    detail="Completion requires an evidence link and a reflection of at least 20 characters.",
                )
            task.status = "completed"
            task.completed_at = datetime.now(timezone.utc)
        else:
            task.status = "in_progress" if payload.progress > 0 else "pending"
            task.completed_at = None
        task.progress = payload.progress
    db.commit()
    db.refresh(task)
    return {"task": _task_out(task), "plan": _plan_out(task.plan)}
