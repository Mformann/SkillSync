"""career growth assessments planning passports and contacts

Revision ID: deaf9f5a764b
Revises: 20260730_06
Create Date: 2026-09-17 15:58:53.347974
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'deaf9f5a764b'
down_revision: Union[str, None] = '20260730_06'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    specifications = {
        "skill_assessments": [sa.Column("skill", sa.String(160), nullable=False), sa.Column("questions", sa.JSON(), nullable=False), sa.Column("answers", sa.JSON(), nullable=False), sa.Column("score", sa.Integer()), sa.Column("submitted_at", sa.DateTime(timezone=True))],
        "growth_preferences": [sa.Column("preferences", sa.JSON(), nullable=False), sa.UniqueConstraint("user_id")],
        "career_contacts": [sa.Column("target_job_id", sa.Integer(), sa.ForeignKey("target_jobs.id", ondelete="CASCADE"), nullable=False), sa.Column("details", sa.JSON(), nullable=False)],
        "career_reminders": [sa.Column("target_job_id", sa.Integer(), sa.ForeignKey("target_jobs.id", ondelete="CASCADE")), sa.Column("title", sa.String(300), nullable=False), sa.Column("due_date", sa.Date(), nullable=False), sa.Column("completed", sa.Boolean(), nullable=False)],
        "passport_shares": [sa.Column("token_hash", sa.String(64), nullable=False, unique=True), sa.Column("snapshot", sa.JSON(), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False), sa.Column("revoked", sa.Boolean(), nullable=False)],
        "passport_reviews": [sa.Column("share_id", sa.Integer(), sa.ForeignKey("passport_shares.id", ondelete="CASCADE"), nullable=False), sa.Column("evidence_id", sa.Integer(), nullable=False), sa.Column("review", sa.JSON(), nullable=False), sa.UniqueConstraint("share_id", "user_id", "evidence_id")],
    }
    indexed = {"career_contacts": ["target_job_id"], "career_reminders": ["target_job_id", "due_date"], "passport_shares": ["token_hash"], "passport_reviews": ["share_id"]}
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    for name, columns in specifications.items():
        # Development create_all may already have created these exact tables.
        if name not in existing:
            op.create_table(name, sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.String(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), *columns)
            op.create_index(f"ix_{name}_user_id", name, ["user_id"])
            for column in indexed.get(name, []):
                op.create_index(f"ix_{name}_{column}", name, [column], unique=column == "token_hash")
        if op.get_bind().dialect.name == "postgresql":
            op.execute(f'ALTER TABLE "{name}" ENABLE ROW LEVEL SECURITY')
            op.execute(f'REVOKE ALL ON TABLE "{name}" FROM PUBLIC')
            for role in ("anon", "authenticated"):
                if op.get_bind().execute(sa.text("SELECT 1 FROM pg_roles WHERE rolname = :role"), {"role": role}).scalar():
                    op.execute(f'REVOKE ALL ON TABLE "{name}" FROM "{role}"')


def downgrade() -> None:
    for name in ("passport_reviews", "passport_shares", "career_reminders", "career_contacts", "growth_preferences", "skill_assessments"):
        op.drop_table(name)
