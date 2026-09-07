"""Add career vault, application packages, and outcome events.

Revision ID: 20260730_06
Revises: 20260730_05
"""
from alembic import op
import sqlalchemy as sa

revision = "20260730_06"
down_revision = "20260730_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "career_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False, unique=True),
        sa.Column("full_name", sa.String(length=160)),
        sa.Column("headline", sa.String(length=240)),
        sa.Column("location", sa.String(length=160)),
        sa.Column("email", sa.String(length=320)),
        sa.Column("phone", sa.String(length=80)),
        sa.Column("links", sa.JSON(), nullable=False),
        sa.Column("role_preferences", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_career_profiles_user_id", "career_profiles", ["user_id"], unique=True)
    op.create_table(
        "career_achievements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("profile_id", sa.Integer(), sa.ForeignKey("career_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("source_note", sa.String(length=500), nullable=False),
        sa.Column("source_url", sa.String(length=1000)),
        sa.Column("verification_status", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_career_achievements_profile_id", "career_achievements", ["profile_id"])
    op.create_index("ix_career_achievements_user_id", "career_achievements", ["user_id"])
    op.create_table(
        "application_packages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("target_job_id", sa.Integer(), sa.ForeignKey("target_jobs.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("analysis_id", sa.Integer(), sa.ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("source_map", sa.JSON(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_application_packages_user_id", "application_packages", ["user_id"])
    op.create_index("ix_application_packages_target_job_id", "application_packages", ["target_job_id"], unique=True)
    op.create_index("ix_application_packages_analysis_id", "application_packages", ["analysis_id"])
    op.create_table(
        "application_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("target_job_id", sa.Integer(), sa.ForeignKey("target_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_application_events_user_id", "application_events", ["user_id"])
    op.create_index("ix_application_events_target_job_id", "application_events", ["target_job_id"])


def downgrade() -> None:
    op.drop_table("application_events")
    op.drop_table("application_packages")
    op.drop_table("career_achievements")
    op.drop_table("career_profiles")
