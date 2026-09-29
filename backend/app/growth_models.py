"""Career growth records. All access goes through the authenticated backend."""
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint, event

from .database import Base
from .models import utc_now


class GrowthRecord:
    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class SkillAssessment(GrowthRecord, Base):
    __tablename__ = "skill_assessments"
    skill = Column(String(160), nullable=False)
    questions = Column(JSON, nullable=False)
    answers = Column(JSON, nullable=False, default=dict)
    score = Column(Integer, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)


class GrowthPreferences(GrowthRecord, Base):
    __tablename__ = "growth_preferences"
    preferences = Column(JSON, nullable=False, default=dict)
    __table_args__ = (UniqueConstraint("user_id"),)


class CareerContact(GrowthRecord, Base):
    __tablename__ = "career_contacts"
    target_job_id = Column(Integer, ForeignKey("target_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    details = Column(JSON, nullable=False, default=dict)


class CareerReminder(GrowthRecord, Base):
    __tablename__ = "career_reminders"
    target_job_id = Column(Integer, ForeignKey("target_jobs.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(300), nullable=False)
    due_date = Column(Date, nullable=False, index=True)
    completed = Column(Boolean, nullable=False, default=False)


class PassportShare(GrowthRecord, Base):
    __tablename__ = "passport_shares"
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    snapshot = Column(JSON, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)


class PassportReview(GrowthRecord, Base):
    __tablename__ = "passport_reviews"
    share_id = Column(Integer, ForeignKey("passport_shares.id", ondelete="CASCADE"), nullable=False, index=True)
    evidence_id = Column(Integer, nullable=False)
    review = Column(JSON, nullable=False)
    __table_args__ = (UniqueConstraint("share_id", "user_id", "evidence_id"),)


GROWTH_TABLES = (SkillAssessment, GrowthPreferences, CareerContact, CareerReminder, PassportShare, PassportReview)


def secure_table(target, connection, **_):
    if connection.dialect.name == "postgresql":
        name = target.name
        connection.exec_driver_sql(f'ALTER TABLE "{name}" ENABLE ROW LEVEL SECURITY')
        # Answer keys and sharing tokens must never be writable via the Data API.
        connection.exec_driver_sql(f'REVOKE ALL ON TABLE "{name}" FROM PUBLIC')
        for role in ("anon", "authenticated"):
            if connection.exec_driver_sql("SELECT 1 FROM pg_roles WHERE rolname = %s", (role,)).scalar():
                connection.exec_driver_sql(f'REVOKE ALL ON TABLE "{name}" FROM "{role}"')


for model in GROWTH_TABLES:
    event.listen(model.__table__, "after_create", secure_table)
