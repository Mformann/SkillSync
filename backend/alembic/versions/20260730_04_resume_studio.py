"""Add truth-grounded tailored resume versions.

Revision ID: 20260730_04
Revises: 20260729_03
"""
from alembic import op
import sqlalchemy as sa

revision = "20260730_04"
down_revision = "20260729_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "resume_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("analysis_id", sa.Integer(), sa.ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_job_id", sa.Integer(), sa.ForeignKey("target_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("template", sa.String(length=40), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("source_map", sa.JSON(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_resume_versions_user_id", "resume_versions", ["user_id"])
    op.create_index("ix_resume_versions_analysis_id", "resume_versions", ["analysis_id"])
    op.create_index("ix_resume_versions_target_job_id", "resume_versions", ["target_job_id"])


def downgrade() -> None:
    op.drop_table("resume_versions")
