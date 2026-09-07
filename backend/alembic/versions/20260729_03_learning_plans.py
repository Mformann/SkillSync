"""Add prerequisite-aware learning plans and progress tasks.

Revision ID: 20260729_03
Revises: 20260729_02
"""
from alembic import op
import sqlalchemy as sa

revision = "20260729_03"
down_revision = "20260729_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "learning_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("target_job_id", sa.Integer(), sa.ForeignKey("target_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analysis_id", sa.Integer(), sa.ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("hours_per_week", sa.Float(), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=False),
        sa.Column("experience_level", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("total_estimated_hours", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_learning_plans_user_id", "learning_plans", ["user_id"])
    op.create_index("ix_learning_plans_target_job_id", "learning_plans", ["target_job_id"])
    op.create_index("ix_learning_plans_analysis_id", "learning_plans", ["analysis_id"], unique=True)
    op.create_table(
        "learning_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("learning_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("skill", sa.String(length=160), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("priority_score", sa.Float(), nullable=False),
        sa.Column("estimated_hours", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("prerequisites", sa.JSON(), nullable=False),
        sa.Column("resource", sa.JSON(), nullable=False),
        sa.Column("objective", sa.Text(), nullable=False),
        sa.Column("project_brief", sa.Text(), nullable=False),
        sa.Column("assessment_criteria", sa.Text(), nullable=False),
        sa.Column("evidence_url", sa.String(length=1000)),
        sa.Column("reflection", sa.Text()),
        sa.Column("assessment_score", sa.Integer()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_learning_tasks_plan_id", "learning_tasks", ["plan_id"])


def downgrade() -> None:
    op.drop_table("learning_tasks")
    op.drop_table("learning_plans")
