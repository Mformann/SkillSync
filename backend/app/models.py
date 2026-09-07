from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TargetJob(Base):
    __tablename__ = "target_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    title = Column(String(160), nullable=False)
    company = Column(String(160), nullable=True)
    description = Column(Text, nullable=False)
    location = Column(String(160), nullable=True)
    employment_type = Column(String(80), nullable=True)
    ai_consent = Column(Boolean, nullable=False, default=False)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    resumes = relationship("Resume", back_populates="target_job", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="target_job")
    learning_plans = relationship("LearningPlan", back_populates="target_job", cascade="all, delete-orphan")
    resume_versions = relationship("ResumeVersion", back_populates="target_job", cascade="all, delete-orphan")
    application = relationship("JobApplication", back_populates="target_job", uselist=False, cascade="all, delete-orphan")
    portfolio_evidence = relationship("PortfolioEvidence", back_populates="target_job", cascade="all, delete-orphan")
    interview_sessions = relationship("InterviewSession", back_populates="target_job", cascade="all, delete-orphan")


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    target_job_id = Column(Integer, ForeignKey("target_jobs.id", ondelete="CASCADE"), index=True)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(120), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    extracted_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    target_job = relationship("TargetJob", back_populates="resumes")
    analyses = relationship("Analysis", back_populates="resume")


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    target_job_id = Column(Integer, ForeignKey("target_jobs.id", ondelete="SET NULL"), index=True)
    resume_id = Column(Integer, ForeignKey("resumes.id", ondelete="SET NULL"), index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    job_role = Column(String, nullable=True)
    resume_filename = Column(String, nullable=True)
    resume_text = Column(Text, nullable=True)
    skills = Column(JSON, nullable=True)
    dashboard_summary = Column(JSON, nullable=True)
    analysis_data = Column(JSON, nullable=True)
    gap_report = Column(JSON, nullable=True)
    roadmap = Column(JSON, nullable=True)
    analysis_status = Column(String(40), nullable=False, default="pending")
    ai_provider = Column(String(40), nullable=True)
    ai_model = Column(String(120), nullable=True)
    input_hash = Column(String(64), index=True, nullable=True)
    prompt_version = Column(String(40), nullable=True)
    analyzed_at = Column(DateTime(timezone=True), nullable=True)
    explainable_data = Column(JSON, nullable=True)
    score_breakdown = Column(JSON, nullable=True)
    analysis_error = Column(Text, nullable=True)

    target_job = relationship("TargetJob", back_populates="analyses")
    resume = relationship("Resume", back_populates="analyses")
    learning_plan = relationship("LearningPlan", back_populates="analysis", uselist=False)
    resume_versions = relationship("ResumeVersion", back_populates="analysis", cascade="all, delete-orphan")


class LearningPlan(Base):
    __tablename__ = "learning_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    target_job_id = Column(Integer, ForeignKey("target_jobs.id", ondelete="CASCADE"), index=True, nullable=False)
    analysis_id = Column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    hours_per_week = Column(Float, nullable=False)
    target_date = Column(Date, nullable=False)
    experience_level = Column(String(40), nullable=False, default="intermediate")
    status = Column(String(40), nullable=False, default="active")
    total_estimated_hours = Column(Float, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    target_job = relationship("TargetJob", back_populates="learning_plans")
    analysis = relationship("Analysis", back_populates="learning_plan")
    tasks = relationship(
        "LearningTask",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="LearningTask.order_index",
    )


class LearningTask(Base):
    __tablename__ = "learning_tasks"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("learning_plans.id", ondelete="CASCADE"), index=True, nullable=False)
    skill = Column(String(160), nullable=False)
    title = Column(String(255), nullable=False)
    category = Column(String(80), nullable=False)
    order_index = Column(Integer, nullable=False)
    priority_score = Column(Float, nullable=False)
    estimated_hours = Column(Float, nullable=False)
    status = Column(String(40), nullable=False, default="pending")
    progress = Column(Integer, nullable=False, default=0)
    due_date = Column(Date, nullable=False)
    prerequisites = Column(JSON, nullable=False, default=list)
    resource = Column(JSON, nullable=False, default=dict)
    objective = Column(Text, nullable=False)
    project_brief = Column(Text, nullable=False)
    assessment_criteria = Column(Text, nullable=False)
    evidence_url = Column(String(1000), nullable=True)
    reflection = Column(Text, nullable=True)
    assessment_score = Column(Integer, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    plan = relationship("LearningPlan", back_populates="tasks")


class ResumeVersion(Base):
    __tablename__ = "resume_versions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    analysis_id = Column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), index=True, nullable=False)
    target_job_id = Column(Integer, ForeignKey("target_jobs.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(160), nullable=False)
    template = Column(String(40), nullable=False, default="classic")
    content = Column(JSON, nullable=False, default=dict)
    source_map = Column(JSON, nullable=False, default=dict)
    warnings = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    analysis = relationship("Analysis", back_populates="resume_versions")
    target_job = relationship("TargetJob", back_populates="resume_versions")


class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    target_job_id = Column(Integer, ForeignKey("target_jobs.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    status = Column(String(40), nullable=False, default="preparing")
    job_url = Column(String(1000), nullable=True)
    applied_at = Column(DateTime(timezone=True), nullable=True)
    next_action = Column(String(500), nullable=True)
    next_action_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    target_job = relationship("TargetJob", back_populates="application")


class PortfolioEvidence(Base):
    __tablename__ = "portfolio_evidence"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    target_job_id = Column(Integer, ForeignKey("target_jobs.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String(200), nullable=False)
    evidence_type = Column(String(40), nullable=False)
    url = Column(String(1000), nullable=True)
    description = Column(Text, nullable=False)
    skills = Column(JSON, nullable=False, default=list)
    verified = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    target_job = relationship("TargetJob", back_populates="portfolio_evidence")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    target_job_id = Column(Integer, ForeignKey("target_jobs.id", ondelete="CASCADE"), index=True, nullable=False)
    analysis_id = Column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), index=True, nullable=False)
    questions = Column(JSON, nullable=False, default=list)
    answers = Column(JSON, nullable=False, default=dict)
    scores = Column(JSON, nullable=False, default=dict)
    status = Column(String(40), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    target_job = relationship("TargetJob", back_populates="interview_sessions")


class CareerProfile(Base):
    __tablename__ = "career_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String(160), nullable=True)
    headline = Column(String(240), nullable=True)
    location = Column(String(160), nullable=True)
    email = Column(String(320), nullable=True)
    phone = Column(String(80), nullable=True)
    links = Column(JSON, nullable=False, default=list)
    role_preferences = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    achievements = relationship("CareerAchievement", back_populates="profile", cascade="all, delete-orphan")


class CareerAchievement(Base):
    __tablename__ = "career_achievements"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("career_profiles.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(String, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    statement = Column(Text, nullable=False)
    skills = Column(JSON, nullable=False, default=list)
    source_note = Column(String(500), nullable=False)
    source_url = Column(String(1000), nullable=True)
    verification_status = Column(String(40), nullable=False, default="user_attested")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    profile = relationship("CareerProfile", back_populates="achievements")


class ApplicationPackage(Base):
    __tablename__ = "application_packages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    target_job_id = Column(Integer, ForeignKey("target_jobs.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    analysis_id = Column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), index=True, nullable=False)
    content = Column(JSON, nullable=False, default=dict)
    source_map = Column(JSON, nullable=False, default=dict)
    warnings = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class ApplicationEvent(Base):
    __tablename__ = "application_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    target_job_id = Column(Integer, ForeignKey("target_jobs.id", ondelete="CASCADE"), index=True, nullable=False)
    status = Column(String(40), nullable=False)
    occurred_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
