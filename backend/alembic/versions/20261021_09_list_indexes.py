"""Reconcile primary-key index drift and support bounded owned lists.

Revision ID: 20261021_09
Revises: 20261021_08
"""
from alembic import op
import sqlalchemy as sa

revision = "20261021_09"
down_revision = "20261021_08"
branch_labels = depends_on = None

INDEXES = (
    ("target_jobs", "ix_target_jobs_user_archive_id", ["user_id", "is_archived", "id"]),
    ("resumes", "ix_resumes_user_workspace_id", ["user_id", "target_job_id", "id"]),
    ("analyses", "ix_analyses_user_id_id", ["user_id", "id"]),
    ("analyses", "ix_analyses_workspace_id_id", ["target_job_id", "id"]),
)


def upgrade():
    inspector = sa.inspect(op.get_bind())
    for table in inspector.get_table_names():
        # Only drop exact redundant indexes produced by the old metadata.
        # Never drop a primary-key constraint or unrelated/custom index.
        if table not in {"target_jobs", "resumes", "analyses", "learning_plans", "learning_tasks",
            "resume_versions", "job_applications", "portfolio_evidence", "interview_sessions",
            "career_profiles", "career_achievements", "application_packages", "application_events"}:
            continue
        for index in inspector.get_indexes(table):
            if index["name"] == f"ix_{table}_id" and index["column_names"] == ["id"] and not index["unique"]:
                op.drop_index(index["name"], table_name=table)
    for table, name, columns in INDEXES:
        if name not in {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table)}:
            op.create_index(name, table, columns)


def downgrade():
    for table, name, _ in reversed(INDEXES):
        op.drop_index(name, table_name=table)
    # Primary keys continue serving id lookups; redundant indexes stay removed.
