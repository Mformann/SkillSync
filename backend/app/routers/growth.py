from datetime import date, datetime, timedelta, timezone
from typing import Literal
import secrets

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, StrictInt, field_validator
from sqlalchemy.orm import Session

from .. import growth_models as gm, models
from ..auth_utils import AuthenticatedUser, get_current_user
from ..database import get_session
from ..services.growth_service import (QUESTION_BANK, calendar_export, grade_questions,
                                       interview_feedback, make_questions, schedule_plan, token_hash)
from ..services.job_discovery_service import discover_jobs, import_job, rank_jobs
from .workspaces import get_owned_workspace

router = APIRouter()


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def owned(db, model, item_id, user):
    item = db.query(model).filter(model.id == item_id, model.user_id == user.id).with_for_update().first()
    if not item:
        raise HTTPException(404, "Record not found.")
    return item


def preferences_record(db, user):
    record = db.query(gm.GrowthPreferences).filter(gm.GrowthPreferences.user_id == user.id).with_for_update().first()
    if not record:
        record = gm.GrowthPreferences(user_id=user.id, preferences={})
        db.add(record)
        db.flush()
    return record


def assessment_out(item):
    return {"id": item.id, "skill": item.skill, "score": item.score, "created_at": item.created_at,
            "submitted_at": item.submitted_at, "verification_status": "knowledge_assessed" if item.score is not None else "not_assessed",
            "scope": "Unproctored knowledge check; not a certification or proof of project authorship.",
            "questions": [{"id": q["id"], "prompt": q["prompt"], "options": q["options"]} for q in item.questions]}


@router.get("/assessments")
def assessments(db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    items = db.query(gm.SkillAssessment).filter(gm.SkillAssessment.user_id == user.id).order_by(gm.SkillAssessment.id.desc()).limit(100).all()
    return {"supported_skills": list(QUESTION_BANK), "attempts": [assessment_out(a) for a in items]}


class AssessmentStart(Input):
    skill: str = Field(min_length=1, max_length=160)


@router.post("/assessments", status_code=201)
def start_assessment(payload: AssessmentStart, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    skill = next((s for s in QUESTION_BANK if s.casefold() == payload.skill.casefold()), None)
    if not skill:
        raise HTTPException(422, "This skill has no curated assessment yet. Its progress remains self-reported.")
    count = db.query(gm.SkillAssessment).filter(gm.SkillAssessment.user_id == user.id,
        gm.SkillAssessment.created_at >= datetime.now(timezone.utc) - timedelta(days=1)).count()
    if count >= 20:
        raise HTTPException(429, "Assessment limit reached. Try again tomorrow.")
    item = gm.SkillAssessment(user_id=user.id, skill=skill, questions=make_questions(skill), answers={})
    db.add(item)
    db.commit()
    return assessment_out(item)


class AssessmentSubmit(Input):
    answers: dict[str, StrictInt] = Field(max_length=20)


@router.post("/assessments/{attempt_id}/submit")
def submit_assessment(attempt_id: int, payload: AssessmentSubmit, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    item = owned(db, gm.SkillAssessment, attempt_id, user)
    if item.submitted_at:
        raise HTTPException(409, "This attempt is already submitted. Start a new assessment to retest.")
    try:
        score, results = grade_questions(item.questions, payload.answers)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    item.answers, item.score, item.submitted_at = payload.answers, score, datetime.now(timezone.utc)
    db.commit()
    previous = db.query(gm.SkillAssessment).filter(gm.SkillAssessment.user_id == user.id, gm.SkillAssessment.skill == item.skill,
        gm.SkillAssessment.id < item.id, gm.SkillAssessment.submitted_at.is_not(None)).order_by(gm.SkillAssessment.id.desc()).first()
    return {**assessment_out(item), "results": results, "previous_score": previous.score if previous else None,
            "improvement": score - previous.score if previous else None, "passed": score >= 80}


class Replan(Input):
    hours_per_week: float = Field(ge=1, le=40, allow_inf_nan=False)
    target_date: date
    study_days: list[int] = Field(min_length=1, max_length=7)

    @field_validator("study_days")
    @classmethod
    def valid_days(cls, values):
        if any(day < 0 or day > 6 for day in values) or len(set(values)) != len(values):
            raise ValueError("Study days must be unique weekday numbers from 0 to 6.")
        return values


@router.get("/plans/{plan_id}/schedule")
def saved_schedule(plan_id: int, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    plan = owned(db, models.LearningPlan, plan_id, user)
    record = db.query(gm.GrowthPreferences).filter(gm.GrowthPreferences.user_id == user.id).first()
    stored = (record.preferences if record else {}).get("schedules", {}).get(str(plan.id))
    return {"schedule": stored, "study_days": (stored or {}).get("study_days", [0, 2, 4])}


@router.post("/plans/{plan_id}/replan")
def replan(plan_id: int, payload: Replan, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    plan = owned(db, models.LearningPlan, plan_id, user)
    if payload.target_date > date.today() + timedelta(days=730):
        raise HTTPException(422, "Choose a deadline within two years.")
    try:
        schedule = schedule_plan(plan.tasks, payload.hours_per_week, payload.target_date, payload.study_days)
        schedule["study_days"] = payload.study_days
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    plan.hours_per_week, plan.target_date = payload.hours_per_week, payload.target_date
    record = preferences_record(db, user)
    record.preferences = {**record.preferences, "study_days": payload.study_days,
                          "schedules": {**record.preferences.get("schedules", {}), str(plan.id): schedule}}
    db.commit()
    return {"plan_id": plan.id, **schedule}


def inbox_items(db, user):
    record = db.query(gm.GrowthPreferences).filter(gm.GrowthPreferences.user_id == user.id).first()
    dismissed = set((record.preferences if record else {}).get("dismissed_reminders", []))
    items = [{"id": f"manual:{r.id}", "title": r.title, "due_date": r.due_date.isoformat(),
              "workspace_id": r.target_job_id, "kind": "reminder", "path": "/career/growth?tab=contacts"}
             for r in db.query(gm.CareerReminder).filter(gm.CareerReminder.user_id == user.id, gm.CareerReminder.completed.is_(False)).all()]
    plans = db.query(models.LearningPlan).filter(models.LearningPlan.user_id == user.id, models.LearningPlan.status == "active").all()
    for plan in plans:
        items += [{"id": f"task:{t.id}:{t.due_date}", "title": t.title, "due_date": t.due_date.isoformat(),
                   "workspace_id": plan.target_job_id, "kind": "learning", "path": f"/roadmap/{plan.analysis_id}"}
                  for t in plan.tasks if t.progress < 100]
    items += [{"id": f"application:{a.id}:{a.next_action_date}", "title": a.next_action or "Follow up on application",
               "due_date": a.next_action_date.isoformat(), "workspace_id": a.target_job_id,
               "kind": "application", "path": "/career"}
              for a in db.query(models.JobApplication).filter(models.JobApplication.user_id == user.id,
                  models.JobApplication.next_action_date.is_not(None)).all()]
    return sorted([i for i in items if i["id"] not in dismissed], key=lambda i: i["due_date"])


@router.get("/reminders")
def reminders(db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    return {"items": inbox_items(db, user), "today": date.today().isoformat(), "delivery": "in_app_and_calendar"}


class ReminderCreate(Input):
    title: str = Field(min_length=2, max_length=300)
    due_date: date
    workspace_id: int | None = None


@router.post("/reminders", status_code=201)
def create_reminder(payload: ReminderCreate, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    if payload.workspace_id:
        get_owned_workspace(payload.workspace_id, user, db)
    if db.query(gm.CareerReminder).filter(gm.CareerReminder.user_id == user.id).count() >= 1000:
        raise HTTPException(429, "Reminder storage limit reached.")
    item = gm.CareerReminder(user_id=user.id, title=payload.title, due_date=payload.due_date, target_job_id=payload.workspace_id)
    db.add(item)
    db.commit()
    return {"id": item.id}


@router.post("/reminders/{reminder_id}/dismiss")
def dismiss_reminder(reminder_id: str, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    if reminder_id not in {i["id"] for i in inbox_items(db, user)}:
        raise HTTPException(404, "Reminder not found.")
    if reminder_id.startswith("manual:"):
        owned(db, gm.CareerReminder, int(reminder_id.split(":")[1]), user).completed = True
    else:
        record = preferences_record(db, user)
        dismissed = record.preferences.get("dismissed_reminders", [])
        record.preferences = {**record.preferences, "dismissed_reminders": (dismissed + [reminder_id])[-2000:]}
    db.commit()
    return {"dismissed": True, "learning_progress_changed": False}


@router.get("/calendar")
def calendar(db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    return Response(calendar_export(inbox_items(db, user)), media_type="text/calendar",
                    headers={"Content-Disposition": 'attachment; filename="skillsync-calendar.ics"', "Cache-Control": "no-store"})


class ContactCreate(Input):
    workspace_id: int
    name: str = Field(min_length=2, max_length=160)
    contact_type: Literal["recruiter", "hiring_manager", "referral", "mentor", "other"] = "recruiter"
    email: str | None = Field(default=None, max_length=320)
    url: HttpUrl | None = None
    notes: str = Field(default="", max_length=4000)
    communication_history: str = Field(default="", max_length=6000)


@router.get("/contacts")
def contacts(db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    return [{"id": r.id, "workspace_id": r.target_job_id, **r.details} for r in db.query(gm.CareerContact).filter(gm.CareerContact.user_id == user.id).order_by(gm.CareerContact.id.desc()).all()]


@router.post("/contacts", status_code=201)
def create_contact(payload: ContactCreate, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    get_owned_workspace(payload.workspace_id, user, db)
    if db.query(gm.CareerContact).filter(gm.CareerContact.user_id == user.id).count() >= 1000:
        raise HTTPException(429, "Contact storage limit reached.")
    item = gm.CareerContact(user_id=user.id, target_job_id=payload.workspace_id, details=payload.model_dump(mode="json", exclude={"workspace_id"}))
    db.add(item)
    db.commit()
    return {"id": item.id}


@router.put("/contacts/{contact_id}")
def update_contact(contact_id: int, payload: ContactCreate, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    item = owned(db, gm.CareerContact, contact_id, user)
    get_owned_workspace(payload.workspace_id, user, db)
    item.target_job_id, item.details = payload.workspace_id, payload.model_dump(mode="json", exclude={"workspace_id"})
    db.commit()
    return {"id": item.id}


@router.delete("/contacts/{contact_id}", status_code=204)
def delete_contact(contact_id: int, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    db.delete(owned(db, gm.CareerContact, contact_id, user))
    db.commit()


class JobLink(Input):
    url: str = Field(min_length=10, max_length=1500)


@router.post("/jobs/preview")
def job_preview(payload: JobLink, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return import_job(payload.url)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except (httpx.HTTPError, KeyError, TypeError, AttributeError) as exc:
        raise HTTPException(502, "The job source is unavailable or the listing has expired. Paste the description manually.") from exc


class JobSave(Input):
    title: str = Field(min_length=2, max_length=160)
    company: str = Field(max_length=160)
    description: str = Field(min_length=50, max_length=50_000)
    location: str = Field(default="", max_length=160)
    employment_type: str = Field(default="", max_length=80)
    url: HttpUrl


@router.post("/jobs/save", status_code=201)
def save_job(payload: JobSave, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    existing = db.query(models.JobApplication).filter(models.JobApplication.user_id == user.id, models.JobApplication.job_url == str(payload.url)).first()
    if existing:
        return {"workspace_id": existing.target_job_id, "already_saved": True}
    item = models.TargetJob(user_id=user.id, **payload.model_dump(exclude={"url"}))
    db.add(item)
    db.flush()
    db.add(models.JobApplication(user_id=user.id, target_job_id=item.id, job_url=str(payload.url)))
    db.commit()
    return {"workspace_id": item.id, "already_saved": False}


class JobPreferences(Input):
    roles: list[str] = Field(default_factory=list, max_length=10)
    locations: list[str] = Field(default_factory=list, max_length=10)
    remote_only: bool = False
    minimum_salary: int | None = Field(default=None, ge=0, le=100_000_000)
    currency: Literal["USD", "INR", "EUR", "GBP", "CAD", "AUD"] = "INR"

    @field_validator("roles", "locations")
    @classmethod
    def short_values(cls, values):
        if any(not value.strip() or len(value) > 160 for value in values):
            raise ValueError("Each preference must be 1–160 characters.")
        return list(dict.fromkeys(value.strip() for value in values))


@router.get("/preferences")
def get_preferences(db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    record = db.query(gm.GrowthPreferences).filter(gm.GrowthPreferences.user_id == user.id).first()
    return (record.preferences if record else {}).get("jobs", JobPreferences().model_dump())


@router.put("/preferences")
def put_preferences(payload: JobPreferences, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    record = preferences_record(db, user)
    record.preferences = {**record.preferences, "jobs": payload.model_dump()}
    db.commit()
    return payload


@router.get("/jobs")
def jobs(db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    preferences = get_preferences(db, user)
    # Use the latest submitted assessment, not the best historical score.
    latest = {}
    for a in db.query(gm.SkillAssessment).filter(gm.SkillAssessment.user_id == user.id, gm.SkillAssessment.submitted_at.is_not(None)).order_by(gm.SkillAssessment.id.desc()):
        latest.setdefault(a.skill.casefold(), a.score)
    source = discover_jobs()
    return {**source, "jobs": rank_jobs(source["jobs"], preferences, {s for s, score in latest.items() if score >= 80})}


class InterviewTurn(Input):
    question_id: str = Field(min_length=1, max_length=100)
    answer: str = Field(min_length=20, max_length=8000)
    ai_consent: bool = False


@router.post("/interviews/{session_id}/turn")
def interview_turn(session_id: int, payload: InterviewTurn, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    item = owned(db, models.InterviewSession, session_id, user)
    question = next((q for q in item.questions if q["id"] == payload.question_id), None)
    if not question:
        raise HTTPException(422, "Choose a question in this session.")
    if payload.question_id in (item.answers or {}):
        raise HTTPException(409, "This turn is already answered. Continue with its follow-up question.")
    if len(item.questions) >= 30:
        raise HTTPException(429, "This practice session has reached its turn limit. Start a new session.")
    record = preferences_record(db, user)
    daily = record.preferences.get("practice_daily", {})
    today = date.today().isoformat()
    used = daily.get("count", 0) if daily.get("date") == today else 0
    if used >= 40:
        raise HTTPException(429, "Daily practice limit reached. Try again tomorrow.")
    record.preferences = {**record.preferences, "practice_daily": {"date": today, "count": used + 1}}
    workspace = get_owned_workspace(item.target_job_id, user, db)
    history = [{"question": q["question"], "answer": (item.answers or {}).get(q["id"], "")}
               for q in item.questions if q["id"] in (item.answers or {})]
    result = interview_feedback(question["question"], payload.answer, workspace.title, history, payload.ai_consent)
    followup = {"id": f"follow-{secrets.token_hex(6)}", "question": result["follow_up"],
                "requirement": question.get("requirement", ""), "parent_id": question["id"], "focus": "Explain your decision and supportable evidence."}
    item.answers = {**(item.answers or {}), question["id"]: payload.answer}
    # Legacy readiness calculations cannot represent unavailable semantic scoring.
    stored = {k: v for k, v in result.items() if k != "overall" or v is not None}
    item.scores = {**(item.scores or {}), question["id"]: stored}
    item.questions = [*item.questions, followup]
    db.commit()
    return {"feedback": result, "follow_up": followup, "session_id": item.id}


class PassportCreate(Input):
    evidence_ids: list[int] = Field(default_factory=list, max_length=40)
    assessment_ids: list[int] = Field(default_factory=list, max_length=40)
    expires_in_days: int = Field(default=7, ge=1, le=30)
    sharing_consent: bool = False


@router.get("/passport/options")
def passport_options(db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    return {"evidence": [{"id": e.id, "title": e.title, "description": e.description, "url": e.url, "skills": e.skills,
                           "verification_status": "self_reported"} for e in db.query(models.PortfolioEvidence).filter(models.PortfolioEvidence.user_id == user.id).all()],
            "assessments": [assessment_out(a) for a in db.query(gm.SkillAssessment).filter(gm.SkillAssessment.user_id == user.id, gm.SkillAssessment.submitted_at.is_not(None)).order_by(gm.SkillAssessment.id.desc()).limit(100)]}


@router.get("/passport/shares")
def shares(db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    return [{"id": s.id, "created_at": s.created_at, "expires_at": s.expires_at, "revoked": s.revoked,
             "snapshot": s.snapshot} for s in db.query(gm.PassportShare).filter(gm.PassportShare.user_id == user.id).order_by(gm.PassportShare.id.desc()).all()]


@router.post("/passport/shares", status_code=201)
def create_share(payload: PassportCreate, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    if not payload.sharing_consent:
        raise HTTPException(422, "Confirm sharing consent. Anyone with the link can see the selected snapshot.")
    evidence = db.query(models.PortfolioEvidence).filter(models.PortfolioEvidence.user_id == user.id, models.PortfolioEvidence.id.in_(payload.evidence_ids)).all()
    attempts = db.query(gm.SkillAssessment).filter(gm.SkillAssessment.user_id == user.id, gm.SkillAssessment.id.in_(payload.assessment_ids), gm.SkillAssessment.submitted_at.is_not(None)).all()
    if {e.id for e in evidence} != set(payload.evidence_ids) or {a.id for a in attempts} != set(payload.assessment_ids):
        raise HTTPException(404, "Selected evidence or assessment not found.")
    if not evidence and not attempts:
        raise HTTPException(422, "Select at least one evidence item or completed assessment.")
    if db.query(gm.PassportShare).filter(gm.PassportShare.user_id == user.id).count() >= 100:
        raise HTTPException(429, "Share storage limit reached. Revoke old links and contact support to clear history.")
    profile = db.query(models.CareerProfile).filter(models.CareerProfile.user_id == user.id).first()
    snapshot = {"name": profile.full_name if profile else "SkillSync candidate", "headline": profile.headline if profile else None,
                "evidence": [{"id": e.id, "title": e.title, "description": e.description, "url": e.url,
                              "skills": e.skills, "verification_status": "self_reported"} for e in evidence],
                "assessments": [{"skill": a.skill, "score": a.score, "assessed_at": a.submitted_at.isoformat(),
                                 "verification_status": "knowledge_assessed", "scope": "Unproctored knowledge check, not a certification."} for a in attempts],
                "published_at": datetime.now(timezone.utc).isoformat(),
                "disclaimer": "Self-reported projects are not automatically verified. Knowledge checks are unproctored. Account-based reviews do not verify reviewer identity or expertise."}
    token = secrets.token_urlsafe(32)
    item = gm.PassportShare(user_id=user.id, token_hash=token_hash(token), snapshot=snapshot,
                            expires_at=datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days))
    db.add(item)
    db.commit()
    return {"id": item.id, "path": f"/passport/{token}", "expires_at": item.expires_at, "snapshot": snapshot}


@router.delete("/passport/shares/{share_id}", status_code=204)
def revoke_share(share_id: int, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    owned(db, gm.PassportShare, share_id, user).revoked = True
    db.commit()


def active_share(token, db):
    if not 30 <= len(token) <= 100:
        raise HTTPException(404, "Passport link is unavailable or expired.")
    item = db.query(gm.PassportShare).filter(gm.PassportShare.token_hash == token_hash(token), gm.PassportShare.revoked.is_(False),
        gm.PassportShare.expires_at > datetime.now(timezone.utc)).first()
    if not item:
        raise HTTPException(404, "Passport link is unavailable or expired.")
    return item


@router.get("/public/passport/{token}")
def public_passport(token: str, response: Response, db: Session = Depends(get_session)):
    item = active_share(token, db)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers["Referrer-Policy"] = "no-referrer"
    reviews = db.query(gm.PassportReview).filter(gm.PassportReview.share_id == item.id).all()
    return {**item.snapshot, "expires_at": item.expires_at, "reviews": [{"evidence_id": r.evidence_id, **r.review} for r in reviews]}


class ReviewCreate(Input):
    evidence_id: int
    reviewer_name: str = Field(min_length=2, max_length=160)
    relationship: str = Field(min_length=2, max_length=160)
    clarity: int = Field(ge=1, le=5)
    relevance: int = Field(ge=1, le=5)
    reproducibility: int = Field(ge=1, le=5)
    comments: str = Field(min_length=20, max_length=2000)
    reviewed_evidence: bool = False


@router.post("/public/passport/{token}/reviews", status_code=201)
def review_passport(token: str, payload: ReviewCreate, db: Session = Depends(get_session), user: AuthenticatedUser = Depends(get_current_user)):
    share = active_share(token, db)
    if share.user_id == user.id:
        raise HTTPException(403, "You cannot independently review your own passport.")
    if not payload.reviewed_evidence or payload.evidence_id not in {e["id"] for e in share.snapshot["evidence"]}:
        raise HTTPException(422, "Select published evidence and confirm you reviewed it.")
    item = db.query(gm.PassportReview).filter(gm.PassportReview.share_id == share.id, gm.PassportReview.user_id == user.id,
        gm.PassportReview.evidence_id == payload.evidence_id).first()
    if not item:
        if db.query(gm.PassportReview).filter(gm.PassportReview.share_id == share.id).count() >= 100:
            raise HTTPException(429, "This passport has reached its review limit.")
        item = gm.PassportReview(user_id=user.id, share_id=share.id, evidence_id=payload.evidence_id)
        db.add(item)
    item.review = {**payload.model_dump(exclude={"evidence_id", "reviewed_evidence"}), "status": "account_based_review",
                   "reviewed_at": datetime.now(timezone.utc).isoformat()}
    db.commit()
    return {"reviewed": True, "status": "account_based_review", "identity_verified": False}


def export_growth_data(db, user_id):
    data = {}
    for model in gm.GROWTH_TABLES:
        data[model.__tablename__] = [{column.name: getattr(row, column.name) for column in model.__table__.columns
                                    if column.name not in {"token_hash", "questions"}}
                                   for row in db.query(model).filter(model.user_id == user_id).all()]
    return data


def delete_growth_data(db, user_id):
    share_ids = [s.id for s in db.query(gm.PassportShare.id).filter(gm.PassportShare.user_id == user_id)]
    if share_ids:
        db.query(gm.PassportReview).filter(gm.PassportReview.share_id.in_(share_ids)).delete(synchronize_session=False)
    for model in reversed(gm.GROWTH_TABLES):
        db.query(model).filter(model.user_id == user_id).delete(synchronize_session=False)


def delete_workspace_growth_data(db, user_id, workspace_id):
    for model in (gm.CareerContact, gm.CareerReminder):
        db.query(model).filter(model.user_id == user_id, model.target_job_id == workspace_id).delete(synchronize_session=False)
    plan_ids = {str(p.id) for p in db.query(models.LearningPlan.id).filter(models.LearningPlan.user_id == user_id, models.LearningPlan.target_job_id == workspace_id)}
    record = db.query(gm.GrowthPreferences).filter(gm.GrowthPreferences.user_id == user_id).with_for_update().first()
    if record:
        record.preferences = {**record.preferences, "schedules": {key: value for key, value in record.preferences.get("schedules", {}).items() if key not in plan_ids}}
    evidence_ids = {e.id for e in db.query(models.PortfolioEvidence.id).filter(models.PortfolioEvidence.user_id == user_id, models.PortfolioEvidence.target_job_id == workspace_id)}
    for share in db.query(gm.PassportShare).filter(gm.PassportShare.user_id == user_id, gm.PassportShare.revoked.is_(False)):
        if any(e["id"] in evidence_ids for e in share.snapshot.get("evidence", [])):
            share.revoked = True
