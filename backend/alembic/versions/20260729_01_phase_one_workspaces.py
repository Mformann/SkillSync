"""Create target-job workspaces and resume records.

Revision ID: 20260729_01
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "20260729_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    existing_tables = set(inspector.get_table_names())
    if "target_jobs" not in existing_tables:
        op.create_table(
        "target_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("company", sa.String(length=160)),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=160)),
        sa.Column("employment_type", sa.String(length=80)),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_target_jobs_user_id", "target_jobs", ["user_id"])
    if "resumes" not in existing_tables:
        op.create_table(
        "resumes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("target_job_id", sa.Integer(), sa.ForeignKey("target_jobs.id", ondelete="CASCADE")),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_resumes_user_id", "resumes", ["user_id"])
        op.create_index("ix_resumes_target_job_id", "resumes", ["target_job_id"])
    if "analyses" not in existing_tables:
        op.create_table(
        "analyses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("target_job_id", sa.Integer(), sa.ForeignKey("target_jobs.id", ondelete="SET NULL")),
        sa.Column("resume_id", sa.Integer(), sa.ForeignKey("resumes.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("job_role", sa.String()),
        sa.Column("resume_filename", sa.String()),
        sa.Column("resume_text", sa.Text()),
        sa.Column("skills", sa.JSON()),
        sa.Column("dashboard_summary", sa.JSON()),
        sa.Column("analysis_data", sa.JSON()),
        sa.Column("gap_report", sa.JSON()),
        sa.Column("roadmap", sa.JSON()),
        )
        op.create_index("ix_analyses_user_id", "analyses", ["user_id"])
        op.create_index("ix_analyses_target_job_id", "analyses", ["target_job_id"])
        op.create_index("ix_analyses_resume_id", "analyses", ["resume_id"])
    else:
        analysis_columns = {column["name"] for column in inspector.get_columns("analyses")}
        with op.batch_alter_table("analyses") as batch:
            if "target_job_id" not in analysis_columns:
                batch.add_column(sa.Column("target_job_id", sa.Integer(), nullable=True))
            if "resume_id" not in analysis_columns:
                batch.add_column(sa.Column("resume_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_table("analyses")
    op.drop_table("resumes")
    op.drop_table("target_jobs")
