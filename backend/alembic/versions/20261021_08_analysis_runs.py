"""Durable analysis runs, usage reservations, and derived-material provenance.

Revision ID: 20261021_08
Revises: 20261021_07
"""
import importlib.util
from pathlib import Path
import uuid

from alembic import op
import sqlalchemy as sa

revision = "20261021_08"
down_revision = "20261021_07"
branch_labels = depends_on = None
PRIVATE_TABLES = ("ai_usage_accounts", "analysis_runs", "ai_usage")


def upgrade():
    op.create_table("ai_usage_accounts", sa.Column("user_id", sa.String(), primary_key=True))
    op.create_table("analysis_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("analysis_id", sa.Integer(), sa.ForeignKey("analyses.id", ondelete="SET NULL")),
        sa.Column("active_analysis_id", sa.Integer(), unique=True),
        sa.Column("input_hash", sa.String(64), nullable=False),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("prompt_version", sa.String(40), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("error_code", sa.String(40)),
    )
    for column in ("user_id", "analysis_id"):
        op.create_index("ix_analysis_runs_" + column, "analysis_runs", [column])
    op.create_table("ai_usage",
        sa.Column("run_id", sa.String(36), sa.ForeignKey("analysis_runs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("reserved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("dispatched_at", sa.DateTime(timezone=True)),
        sa.Column("released_at", sa.DateTime(timezone=True)),
    )
    for column in ("user_id", "dispatched_at"):
        op.create_index("ix_ai_usage_" + column, "ai_usage", [column])
    op.add_column("learning_plans", sa.Column("source_input_hash", sa.String(64)))
    op.add_column("resume_versions", sa.Column("source_input_hash", sa.String(64)))
    op.add_column("application_packages", sa.Column("source_input_hash", sa.String(64)))
    connection = op.get_bind()
    # Preserve the historical calls the old mutable rows still identify. Earlier
    # forced attempts that overwrote a row cannot be reconstructed retroactively.
    analyses = sa.table("analyses", sa.column("id", sa.Integer()), sa.column("user_id", sa.String()),
        sa.column("input_hash", sa.String()), sa.column("ai_model", sa.String()),
        sa.column("prompt_version", sa.String()), sa.column("ai_provider", sa.String()),
        sa.column("analyzed_at", sa.DateTime(timezone=True)))
    runs = sa.table("analysis_runs", *[sa.column(name, kind) for name, kind in (
        ("id", sa.String()), ("user_id", sa.String()), ("analysis_id", sa.Integer()),
        ("input_hash", sa.String()), ("model", sa.String()), ("prompt_version", sa.String()),
        ("status", sa.String()), ("created_at", sa.DateTime(timezone=True)),
        ("lease_expires_at", sa.DateTime(timezone=True)), ("finished_at", sa.DateTime(timezone=True)))])
    usage = sa.table("ai_usage", sa.column("run_id", sa.String()), sa.column("user_id", sa.String()),
        sa.column("status", sa.String()), sa.column("reserved_at", sa.DateTime(timezone=True)),
        sa.column("dispatched_at", sa.DateTime(timezone=True)))
    for row in connection.execute(sa.select(analyses).where(
            analyses.c.ai_provider == "groq", analyses.c.analyzed_at.isnot(None))).mappings():
        run_id = str(uuid.uuid4())
        connection.execute(runs.insert().values(id=run_id, user_id=row["user_id"], analysis_id=row["id"],
            input_hash=row["input_hash"] or "legacy", model=row["ai_model"] or "legacy",
            prompt_version=row["prompt_version"] or "legacy", status="completed",
            created_at=row["analyzed_at"], lease_expires_at=row["analyzed_at"], finished_at=row["analyzed_at"]))
        connection.execute(usage.insert().values(run_id=run_id, user_id=row["user_id"], status="dispatched",
            reserved_at=row["analyzed_at"], dispatched_at=row["analyzed_at"]))
    # Reuse the prior frozen containment implementation. New tables are private
    # in the same migration transaction, before they can contain any new runs.
    path = Path(__file__).with_name("20261021_07_private_app_tables.py")
    spec = importlib.util.spec_from_file_location("private_table_containment_v07", path)
    containment = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(containment)
    containment.protect_private_tables(connection, table_names=PRIVATE_TABLES)


def downgrade():
    raise RuntimeError("Retain the AI usage ledger when rolling back application code; do not reset usage or discard attempts.")
