"""Upgrade real pre-ledger schemas, preserve known historical usage and privacy."""
from datetime import datetime, timezone
import os
from pathlib import Path
import uuid

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, inspect, MetaData, Table, text
from sqlalchemy.engine import make_url

from app import database


@pytest.fixture(params=["sqlite", "postgresql"])
def migrated_database(request, tmp_path, monkeypatch):
    backend = Path(database.__file__).resolve().parents[1]
    admin = None
    if request.param == "postgresql":
        base_url = os.getenv("ANALYSIS_TEST_DATABASE_URL")
        if not base_url:
            pytest.skip("Set ANALYSIS_TEST_DATABASE_URL to a disposable PostgreSQL server.")
        name = "phase03_migration_" + uuid.uuid4().hex
        admin = create_engine(base_url, isolation_level="AUTOCOMMIT")
        with admin.connect() as connection:
            connection.exec_driver_sql(f'CREATE DATABASE "{name}"')
            for role in ("anon", "authenticated"):
                if not connection.execute(text("SELECT 1 FROM pg_roles WHERE rolname=:role"), {"role": role}).scalar():
                    connection.exec_driver_sql(f'CREATE ROLE "{role}" NOLOGIN')
        url = make_url(base_url).set(database=name).render_as_string(hide_password=False)
    else:
        url = "sqlite:///" + str(tmp_path / "migration.db")
    monkeypatch.setattr(database, "DATABASE_URL", url)
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "alembic"))
    command.upgrade(config, "20261021_07")
    engine = create_engine(url)
    metadata = MetaData()
    analyses = Table("analyses", metadata, autoload_with=engine)
    with engine.begin() as connection:
        now = datetime.now(timezone.utc)
        connection.execute(analyses.insert().values(user_id="synthetic-legacy-user", analysis_status="completed_ai",
            ai_provider="groq", ai_model="synthetic-model", prompt_version="legacy-v1", input_hash="a" * 64,
            created_at=now, analyzed_at=now))
    command.upgrade(config, "head")
    yield engine, config
    engine.dispose()
    if admin:
        with admin.connect() as connection:
            connection.exec_driver_sql(f'DROP DATABASE "{name}" WITH (FORCE)')
        admin.dispose()


def test_upgrade_keeps_historical_usage_and_adds_provenance(migrated_database):
    engine, _ = migrated_database
    with engine.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar() == "20261021_09"
        assert connection.execute(text("SELECT COUNT(*) FROM analyses")).scalar() == 1
        assert connection.execute(text("SELECT COUNT(*) FROM analysis_runs WHERE status='completed'")).scalar() == 1
        assert connection.execute(text("SELECT COUNT(*) FROM ai_usage WHERE status='dispatched' AND dispatched_at IS NOT NULL")).scalar() == 1
        assert connection.execute(text("SELECT COUNT(*) FROM analysis_runs WHERE active_analysis_id IS NOT NULL")).scalar() == 0
    inspector = inspect(engine)
    for table in ("learning_plans", "resume_versions", "application_packages"):
        assert "source_input_hash" in {column["name"] for column in inspector.get_columns(table)}


def test_rollback_cannot_silently_reset_the_usage_ledger(migrated_database):
    engine, config = migrated_database
    with pytest.raises(RuntimeError, match="Retain the AI usage ledger"):
        command.downgrade(config, "20261021_07")
    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM ai_usage")).scalar() == 1


def test_new_tables_keep_public_roles_out(migrated_database):
    engine, _ = migrated_database
    if engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL roles and RLS are required.")
    with engine.connect() as connection:
        for table in (*database.Base.metadata.tables, "alembic_version"):
            assert connection.execute(text("SELECT relrowsecurity FROM pg_class WHERE oid=CAST(:table AS regclass)"), {"table": table}).scalar() is True
            for role in ("anon", "authenticated"):
                assert connection.execute(text("SELECT has_table_privilege(:role,:table,'SELECT,INSERT,UPDATE,DELETE')"), {"role": role, "table": table}).scalar() is False
