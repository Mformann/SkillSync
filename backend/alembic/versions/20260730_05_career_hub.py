"""Add application, portfolio evidence, and interview coaching.

Revision ID: 20260730_05
Revises: 20260730_04
"""
from alembic import op
import sqlalchemy as sa

revision = "20260730_05"
down_revision = "20260730_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_applications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("target_job_id", sa.Integer(), sa.ForeignKey("target_jobs.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("job_url", sa.String(length=1000)),
        sa.Column("applied_at", sa.DateTime(timezone=True)),
        sa.Column("next_action", sa.String(length=500)),
        sa.Column("next_action_date", sa.Date()),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_job_applications_user_id", "job_applications", ["user_id"])
    op.create_index("ix_job_applications_target_job_id", "job_applications", ["target_job_id"], unique=True)
    op.create_table(
        "portfolio_evidence",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("target_job_id", sa.Integer(), sa.ForeignKey("target_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("evidence_type", sa.String(length=40), nullable=False),
        sa.Column("url", sa.String(length=1000)),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_portfolio_evidence_user_id", "portfolio_evidence", ["user_id"])
    op.create_index("ix_portfolio_evidence_target_job_id", "portfolio_evidence", ["target_job_id"])
    op.create_table(
        "interview_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("target_job_id", sa.Integer(), sa.ForeignKey("target_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_id", sa.Integer(), sa.ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=False),
        sa.Column("scores", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_interview_sessions_user_id", "interview_sessions", ["user_id"])
    op.create_index("ix_interview_sessions_target_job_id", "interview_sessions", ["target_job_id"])
    op.create_index("ix_interview_sessions_analysis_id", "interview_sessions", ["analysis_id"])


def downgrade() -> None:
    op.drop_table("interview_sessions")
    op.drop_table("portfolio_evidence")
    op.drop_table("job_applications")
