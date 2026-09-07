"""Add explainable hybrid-AI analysis fields.

Revision ID: 20260729_02
Revises: 20260729_01
"""
from alembic import op
import sqlalchemy as sa

revision = "20260729_02"
down_revision = "20260729_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    target_columns = {column["name"] for column in inspector.get_columns("target_jobs")}
    if "ai_consent" not in target_columns:
        with op.batch_alter_table("target_jobs") as batch:
            batch.add_column(sa.Column("ai_consent", sa.Boolean(), nullable=False, server_default=sa.false()))
    columns = {column["name"] for column in inspector.get_columns("analyses")}
    additions = [
        ("analysis_status", sa.Column("analysis_status", sa.String(length=40), nullable=False, server_default="pending")),
        ("ai_provider", sa.Column("ai_provider", sa.String(length=40))),
        ("ai_model", sa.Column("ai_model", sa.String(length=120))),
        ("input_hash", sa.Column("input_hash", sa.String(length=64))),
        ("prompt_version", sa.Column("prompt_version", sa.String(length=40))),
        ("analyzed_at", sa.Column("analyzed_at", sa.DateTime(timezone=True))),
        ("explainable_data", sa.Column("explainable_data", sa.JSON())),
        ("score_breakdown", sa.Column("score_breakdown", sa.JSON())),
        ("analysis_error", sa.Column("analysis_error", sa.Text())),
    ]
    with op.batch_alter_table("analyses") as batch:
        for name, column in additions:
            if name not in columns:
                batch.add_column(column)
    inspector = sa.inspect(op.get_bind())
    indexes = {index["name"] for index in inspector.get_indexes("analyses")}
    if "ix_analyses_input_hash" not in indexes:
        op.create_index("ix_analyses_input_hash", "analyses", ["input_hash"])


def downgrade() -> None:
    with op.batch_alter_table("analyses") as batch:
        batch.drop_index("ix_analyses_input_hash")
        for name in [
            "analysis_error",
            "score_breakdown",
            "explainable_data",
            "analyzed_at",
            "prompt_version",
            "input_hash",
            "ai_model",
            "ai_provider",
            "analysis_status",
        ]:
            batch.drop_column(name)
    with op.batch_alter_table("target_jobs") as batch:
        batch.drop_column("ai_consent")
