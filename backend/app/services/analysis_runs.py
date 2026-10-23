"""Database-coordinated analysis runs. No transaction spans a provider request."""
import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
import hashlib
import os
import time
import uuid

from fastapi import HTTPException
from sqlalchemy import or_, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from .. import models
from . import ai_analysis_service as ai
from .ai_analysis_service import (
    GroqProvider, ProviderResult, ProviderUnavailable,
    RuleBasedProvider, analysis_input_hash, calculate_scores,
)

OPERATION_TIMEOUT_SECONDS = 25.0
RUN_LEASE_SECONDS = 40
ACTIVE_STATES = ("reserved", "running")


def utc_now():
    return datetime.now(timezone.utc)


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def lock_account(db: Session, user_id: str):
    """Insert/upsert and row lock work across API processes, including new users.

    SQLite's upsert takes its database write lock; PostgreSQL locks this user's
    row. Every accounting mutation uses this order, followed by workspace locks.
    """
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        db.execute(text("SET LOCAL lock_timeout = '2000ms'"))
        db.execute(text("SET LOCAL statement_timeout = '2000ms'"))
        insert = pg_insert
    elif dialect == "sqlite":
        db.execute(text("PRAGMA busy_timeout = 2000"))
        insert = sqlite_insert
    else:
        raise RuntimeError("AI accounting supports PostgreSQL and SQLite only.")
    db.execute(insert(models.AIUsageAccount).values(user_id=user_id).on_conflict_do_nothing())
    db.query(models.AIUsageAccount).filter_by(user_id=user_id).with_for_update().one()


def inputs(analysis):
    workspace, resume = analysis.target_job, analysis.resume
    return (workspace.description if workspace else ""), (
        resume.extracted_text if resume else (analysis.resume_text or "")
    )


def fingerprint(analysis):
    job, resume = inputs(analysis)
    provider = GroqProvider()
    consent = bool(analysis.target_job and analysis.target_job.ai_consent)
    policy = "consent-off" if not consent else ("external-enabled" if provider.api_key else "provider-unconfigured")
    workspace = analysis.target_job
    context = json.dumps({"mode": policy, "title": workspace.title if workspace else None,
                          "company": workspace.company if workspace else None}, sort_keys=True)
    return analysis_input_hash(job, resume, provider.model, policy=context)


def result_is_stale(analysis):
    return not analysis.input_hash or analysis.input_hash != fingerprint(analysis)


def material_fingerprint(analysis):
    """Inputs to derived material include the result, even on a same-input rerun."""
    payload = json.dumps({"input_hash": analysis.input_hash, "result": analysis.explainable_data,
                          "provider": analysis.ai_provider, "model": analysis.ai_model},
                         sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def derived_is_stale(analysis, source_input_hash):
    return bool(not source_input_hash or source_input_hash != material_fingerprint(analysis) or result_is_stale(analysis))


def require_current_result(analysis):
    from .analysis_views import current_view
    if current_view(analysis).result is None:
        raise HTTPException(409, "Run an up-to-date job analysis before generating new material. Your saved work is preserved.")


def expire_runs(db, user_id, now):
    runs = db.query(models.AnalysisRun).filter(
        models.AnalysisRun.user_id == user_id,
        models.AnalysisRun.status.in_(ACTIVE_STATES),
        models.AnalysisRun.lease_expires_at <= now,
    ).all()
    for run in runs:
        run.status, run.active_analysis_id, run.finished_at = "expired", None, now
        run.error_code = "worker_lease_expired"
        usage = db.get(models.AIUsage, run.id)
        if usage and usage.status == "reserved":
            usage.status, usage.released_at = "released", now
        analysis = db.get(models.Analysis, run.analysis_id) if run.analysis_id else None
        if analysis:
            analysis.analysis_status = "failed"
            analysis.analysis_error = "The previous run was interrupted. Retry explicitly to start a new run."
    db.flush()


def owned_analysis(db, analysis_id, user_id):
    analysis = db.query(models.Analysis).filter_by(id=analysis_id, user_id=user_id).first()
    if analysis is None:
        raise HTTPException(404, "Analysis not found")
    return analysis


def serialize(analysis, run=None):
    from .analysis_views import current_view
    view = current_view(analysis)
    workspace = analysis.target_job
    stale = result_is_stale(analysis)
    active = bool(run and run.status in ACTIVE_STATES)
    status = "processing" if active else view.status
    return {
        "analysis_id": analysis.id, "workspace_id": analysis.target_job_id,
        "status": status or "pending", "stale": stale,
        "provider": analysis.ai_provider, "model": analysis.ai_model,
        "prompt_version": analysis.prompt_version, "input_hash": analysis.input_hash,
        "fallback_reason": analysis.analysis_error,
        "scores": view.scores,
        "result": view.result.model_dump(mode="json") if view.result else None,
        "projection_version": view.metadata()["projection_version"],
        "notice": view.metadata()["notice"],
        "context": {
            "job_title": workspace.title if workspace else analysis.job_role,
            "company": workspace.company if workspace else None,
            "resume_filename": analysis.resume.filename if analysis.resume else analysis.resume_filename,
        },
        "run": ({"id": run.id, "status": run.status,
                 "lease_expires_at": aware(run.lease_expires_at).isoformat(),
                 "error_code": run.error_code} if run else None),
        "retry_after_seconds": 1 if active else None,
    }


def read_analysis(db, analysis_id, user_id):
    db.rollback()
    lock_account(db, user_id)
    expire_runs(db, user_id, utc_now())
    analysis = owned_analysis(db, analysis_id, user_id)
    run = db.query(models.AnalysisRun).filter_by(analysis_id=analysis.id, user_id=user_id).order_by(
        models.AnalysisRun.created_at.desc()).first()
    result = serialize(analysis, run)
    db.commit()
    return result


@dataclass(frozen=True)
class Start:
    response: dict | None = None
    run_id: str | None = None


def reserve(db, analysis_id, user_id, force=False):
    db.rollback()
    lock_account(db, user_id)
    now = utc_now()
    expire_runs(db, user_id, now)
    analysis = owned_analysis(db, analysis_id, user_id)
    # Serialize workspace edits/consent changes with reservation and dispatch.
    if analysis.target_job_id:
        db.query(models.TargetJob).filter_by(id=analysis.target_job_id).with_for_update().one()
    active = db.query(models.AnalysisRun).filter_by(active_analysis_id=analysis.id).first()
    if active:
        response = serialize(analysis, active)
        db.commit()
        return Start(response=response)
    job, resume = inputs(analysis)
    if not job or not resume:
        raise HTTPException(422, "This older analysis is missing a linked job description or resume. Create a new target workspace.")
    input_hash = fingerprint(analysis)
    from .analysis_views import current_view
    if analysis.input_hash == input_hash and current_view(analysis).result is not None and not force:
        response = serialize(analysis)
        db.commit()
        return Start(response=response)
    if not force:
        candidates = db.query(models.Analysis).filter(
            models.Analysis.user_id == user_id, models.Analysis.input_hash == input_hash,
            models.Analysis.explainable_data.isnot(None), models.Analysis.id != analysis.id,
        ).order_by(models.Analysis.id.desc()).all()
        cached = next((item for item in candidates if current_view(item).result is not None), None)
        if cached:
            for field in ("ai_provider", "ai_model", "prompt_version", "explainable_data", "score_breakdown", "analysis_error"):
                setattr(analysis, field, getattr(cached, field))
            analysis.input_hash, analysis.analysis_status, analysis.analyzed_at = input_hash, "completed_cached", now
            response = serialize(analysis)
            db.commit()
            return Start(response=response)
    run = models.AnalysisRun(
        id=str(uuid.uuid4()), user_id=user_id, analysis_id=analysis.id, active_analysis_id=analysis.id,
        input_hash=input_hash, model=GroqProvider().model, prompt_version=ai.PROMPT_VERSION,
        status="reserved", created_at=now, lease_expires_at=now + timedelta(seconds=RUN_LEASE_SECONDS),
    )
    db.add(run)
    db.flush()
    provider = GroqProvider()
    if analysis.target_job.ai_consent and provider.api_key:
        limit = max(1, int(os.getenv("AI_DAILY_ANALYSIS_LIMIT", "5")))
        since = now - timedelta(hours=24)
        used = db.query(models.AIUsage).filter(
            models.AIUsage.user_id == user_id,
            or_(models.AIUsage.status == "reserved", models.AIUsage.dispatched_at >= since),
        ).count()
        if used < limit:
            db.add(models.AIUsage(run_id=run.id, user_id=user_id, status="reserved", reserved_at=now))
    analysis.analysis_status, analysis.analysis_error = "processing", None
    run_id = run.id
    db.commit()  # Durable reservation before any provider work.
    return Start(run_id=run_id)


@dataclass(frozen=True)
class Dispatch:
    job: str
    resume: str
    external: bool
    reason: str | None
    model: str


def dispatch(db, run_id, user_id):
    db.rollback()
    lock_account(db, user_id)
    now = utc_now()
    expire_runs(db, user_id, now)
    run = db.get(models.AnalysisRun, run_id)
    if not run or run.user_id != user_id or run.status != "reserved":
        raise HTTPException(409, "This analysis run is no longer active. Reload its status.")
    analysis = owned_analysis(db, run.analysis_id, user_id)
    if analysis.target_job_id:
        db.query(models.TargetJob).filter_by(id=analysis.target_job_id).with_for_update().one()
    usage = db.get(models.AIUsage, run.id)
    if fingerprint(analysis) != run.input_hash:
        _settle(db, run, "superseded", "inputs_changed", now)
        analysis.analysis_status = "stale"
        db.commit()
        raise HTTPException(409, "The inputs or consent changed. Reload and run the current analysis.")
    consent = bool(analysis.target_job and analysis.target_job.ai_consent)
    external = bool(consent and GroqProvider().api_key and usage and usage.status == "reserved")
    reason = None
    if external:
        usage.status, usage.dispatched_at = "dispatched", now
    elif not consent:
        reason = "External AI processing was not enabled for this workspace."
    elif not GroqProvider().api_key:
        reason = "The AI provider is not configured. A local comparison was used."
    else:
        reason = "Your AI analysis allowance for the last 24 hours has been reached. A local comparison was used."
    run.status = "running"
    job, resume = inputs(analysis)
    result = Dispatch(job, resume, external, reason, run.model)
    db.commit()  # No database locks/transaction across network I/O.
    return result


def _settle(db, run, state, error_code, now):
    run.status, run.error_code = state, error_code
    run.finished_at, run.active_analysis_id = now, None
    usage = db.get(models.AIUsage, run.id)
    if usage and usage.status == "reserved":
        usage.status, usage.released_at = "released", now


def finish(db, run_id, user_id, result=None, error_code=None):
    db.rollback()
    lock_account(db, user_id)
    now = utc_now()
    expire_runs(db, user_id, now)
    run = db.get(models.AnalysisRun, run_id)
    if not run or run.user_id != user_id or run.analysis_id is None:
        raise HTTPException(404, "Analysis not found")
    analysis = owned_analysis(db, run.analysis_id, user_id)
    if run.status not in ACTIVE_STATES:
        response = serialize(analysis, run)
        db.commit()
        return response
    if analysis.target_job_id:
        db.query(models.TargetJob).filter_by(id=analysis.target_job_id).with_for_update().one()
    if fingerprint(analysis) != run.input_hash:
        _settle(db, run, "superseded", "inputs_changed", now)
        analysis.analysis_status = "stale"
        analysis.analysis_error = "Inputs or consent changed during this run. Run the current analysis."
    elif error_code:
        _settle(db, run, "failed", error_code, now)
        analysis.analysis_status = "failed"
        analysis.analysis_error = "Analysis was interrupted. Retry explicitly to start a new run."
    else:
        _settle(db, run, "completed", None, now)
        analysis.analysis_status = "completed_ai" if result.provider == "groq" else "completed_fallback"
        analysis.ai_provider, analysis.ai_model = result.provider, result.model
        analysis.input_hash, analysis.prompt_version = run.input_hash, run.prompt_version
        analysis.analyzed_at = now
        analysis.explainable_data = result.analysis.model_dump(mode="json")
        analysis.score_breakdown = calculate_scores(result.analysis)
        analysis.analysis_error = result.fallback_reason
    response = serialize(analysis, run)
    db.commit()
    return response


def _isolated_db_call(bind, function, *arguments):
    # A timed-out request must never close a session still used by its database
    # worker. Each short phase owns its session and releases it independently.
    with Session(bind=bind, autoflush=False) as session:
        return function(session, *arguments)


async def execute(db, analysis_id, user_id, force=False):
    started = time.monotonic()
    bind = db.get_bind()
    db.rollback()
    run_id = None
    async def database_call(function, *arguments):
        return await asyncio.to_thread(_isolated_db_call, bind, function, *arguments)
    async def interrupted(code):
        remaining = OPERATION_TIMEOUT_SECONDS - (time.monotonic() - started)
        if run_id and remaining > 0:
            try:
                await asyncio.wait_for(asyncio.shield(database_call(finish, run_id, user_id, None, code)), min(2, remaining))
            except (Exception, asyncio.CancelledError):
                # A database outage is recovered by the durable lease. Never
                # dispatch an untracked retry while settlement is unavailable.
                pass
    try:
        async with asyncio.timeout(OPERATION_TIMEOUT_SECONDS):
            start = await database_call(reserve, analysis_id, user_id, force)
            if start.response is not None:
                return start.response
            run_id = start.run_id
            attempt = await database_call(dispatch, run_id, user_id)
            provider = GroqProvider()
            provider.model = attempt.model
            if attempt.external:
                try:
                    remaining = max(0.001, OPERATION_TIMEOUT_SECONDS - (time.monotonic() - started) - 3)
                    async with asyncio.timeout(remaining):
                        analysis = await provider.analyze_async(attempt.job, attempt.resume)
                    result = ProviderResult(analysis, provider.name, provider.model)
                except (ProviderUnavailable, TimeoutError):
                    fallback = RuleBasedProvider()
                    result = ProviderResult(fallback.analyze(attempt.job, attempt.resume), fallback.name, fallback.model,
                                            "The AI provider was unavailable or exceeded its time limit. A local comparison was used.")
            else:
                fallback = RuleBasedProvider()
                result = ProviderResult(fallback.analyze(attempt.job, attempt.resume), fallback.name, fallback.model, attempt.reason)
            return await database_call(finish, run_id, user_id, result)
    except TimeoutError as exc:
        # Any already-running DB phase owns its session and can finish safely.
        # No further provider dispatch follows this response. GET discovers a
        # committed result or expires the lease; it never resubmits the work.
        raise HTTPException(503, "Analysis reached its time limit. Reload its status before retrying.") from exc
    except asyncio.CancelledError:
        await interrupted("request_cancelled")
        raise
    except HTTPException:
        raise
    except Exception as exc:
        await interrupted("analysis_failed")
        raise HTTPException(503, "Analysis could not be completed. Reload its status before retrying.") from exc
