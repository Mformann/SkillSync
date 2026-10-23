"""Bounded list queries. List responses never load document bodies for job cards."""
from fastapi import Response
from sqlalchemy import func
from sqlalchemy.orm import joinedload, load_only, selectinload

from .. import models as m

PAGE_SIZE = 50
MAX_PAGE_SIZE = 100


def page(query, model, response: Response, limit, before_id):
    if before_id is not None:
        query = query.filter(model.id < before_id)
    rows = query.order_by(model.id.desc()).limit(limit + 1).all()
    response.headers["X-Next-Cursor"] = str(rows[limit - 1].id) if len(rows) > limit else ""
    return rows[:limit]


def workspace_summaries(db, user_id, response, limit, before_id, include_archived=False):
    query = db.query(m.TargetJob.id, m.TargetJob.title, m.TargetJob.company,
        func.substr(m.TargetJob.description, 1, 240).label("description"), m.TargetJob.location,
        m.TargetJob.employment_type, m.TargetJob.is_archived, m.TargetJob.ai_consent,
        m.TargetJob.created_at, m.TargetJob.updated_at).filter(m.TargetJob.user_id == user_id)
    if not include_archived:
        query = query.filter(m.TargetJob.is_archived.is_(False))
    rows = page(query, m.TargetJob, response, limit, before_id)
    ids = [row.id for row in rows]
    if not ids:
        return []
    stats = db.query(m.Resume.target_job_id.label("workspace_id"), func.count(m.Resume.id).label("count"),
        func.max(m.Resume.id).label("latest_id")).filter(m.Resume.user_id == user_id,
        m.Resume.target_job_id.in_(ids)).group_by(m.Resume.target_job_id).subquery()
    resumes = {row.workspace_id: row for row in db.query(stats.c.workspace_id, stats.c.count,
        m.Resume.id, m.Resume.filename, m.Resume.size_bytes, m.Resume.created_at).join(m.Resume,
        m.Resume.id == stats.c.latest_id).all()}
    analyses = dict(db.query(m.Analysis.target_job_id, func.max(m.Analysis.id)).filter(
        m.Analysis.user_id == user_id, m.Analysis.target_job_id.in_(ids)).group_by(m.Analysis.target_job_id).all())
    result = []
    for row in rows:
        resume = resumes.get(row.id)
        result.append({**row._asdict(), "resume_count": resume.count if resume else 0,
            "resumes": [{"id": resume.id, "filename": resume.filename,
                         "size_bytes": resume.size_bytes, "created_at": resume.created_at}] if resume else [],
            "latest_analysis_id": analyses.get(row.id)})
    return result


def analysis_options():
    # These fields are needed to ground a truthful current score. Legacy sample
    # JSON other than its presence marker and stored score_breakdown are unused.
    return [load_only(m.Analysis.id, m.Analysis.user_id, m.Analysis.target_job_id,
        m.Analysis.resume_id, m.Analysis.created_at, m.Analysis.analyzed_at,
        m.Analysis.analysis_status, m.Analysis.input_hash, m.Analysis.explainable_data,
        m.Analysis.analysis_data, m.Analysis.resume_text, m.Analysis.resume_filename,
        m.Analysis.ai_provider, m.Analysis.ai_model, m.Analysis.job_role),
        joinedload(m.Analysis.target_job).load_only(m.TargetJob.title, m.TargetJob.company,
            m.TargetJob.description, m.TargetJob.ai_consent),
        joinedload(m.Analysis.resume).load_only(m.Resume.extracted_text)]


def latest_analyses(db, user_id, workspace_ids):
    ids = db.query(func.max(m.Analysis.id)).filter(m.Analysis.user_id == user_id,
        m.Analysis.target_job_id.in_(workspace_ids)).group_by(m.Analysis.target_job_id)
    return {item.target_job_id: item for item in db.query(m.Analysis).filter(m.Analysis.id.in_(ids)).options(
        *analysis_options(), selectinload(m.Analysis.learning_plan).selectinload(m.LearningPlan.tasks),
        selectinload(m.Analysis.resume_versions).load_only(m.ResumeVersion.id)).all()}
