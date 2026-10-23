"""Permission regression tests. Integration cases require a disposable PostgreSQL URL."""
import importlib.util
import os
from pathlib import Path
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError
from alembic.migration import MigrationContext
from alembic.operations import Operations

from app import models, growth_models  # register all current private tables
from app.database import Base


@pytest.fixture
def migration():
    path = Path(__file__).resolve().parents[1] / "alembic/versions/20261021_07_private_app_tables.py"
    spec = importlib.util.spec_from_file_location("private_tables_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_security_revision_covers_every_application_model(migration):
    # The original containment revision is frozen; subsequent private tables
    # must be protected by their own creation revision.
    path = Path(__file__).resolve().parents[1] / "alembic/versions/20261021_08_analysis_runs.py"
    spec = importlib.util.spec_from_file_location("analysis_run_migration", path)
    runs = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runs)
    assert set(migration.PRIVATE_TABLES) | set(runs.PRIVATE_TABLES) == set(Base.metadata.tables)
    assert migration.INTERNAL_TABLES == ("alembic_version",)


def test_security_revision_is_compatible_with_sqlite(migration, monkeypatch):
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(connection)))
        migration.upgrade()
        assert connection.execute(text("SELECT 1")).scalar() == 1
    engine.dispose()


@pytest.fixture
def postgres():
    url = os.getenv("SECURITY_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set SECURITY_TEST_DATABASE_URL to a disposable PostgreSQL database.")
    engine = create_engine(url)
    schema = "skillsync_security_qa_" + uuid.uuid4().hex
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            for role in ("anon", "authenticated"):
                if not connection.execute(text("SELECT 1 FROM pg_roles WHERE rolname=:role"), {"role": role}).scalar():
                    connection.exec_driver_sql(f'CREATE ROLE "{role}" NOLOGIN')
            connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
            connection.exec_driver_sql(f'GRANT USAGE ON SCHEMA "{schema}" TO PUBLIC')
            connection.exec_driver_sql(f'''CREATE TABLE "{schema}".private_items
                (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, secret TEXT NOT NULL)''')
            connection.exec_driver_sql(f'''INSERT INTO "{schema}".private_items (user_id,secret)
                VALUES ('synthetic-user','synthetic-private-resume')''')
            connection.exec_driver_sql(f'GRANT ALL ON "{schema}".private_items TO PUBLIC, anon, authenticated')
            connection.exec_driver_sql(f'GRANT SELECT(secret),UPDATE(secret) ON "{schema}".private_items TO PUBLIC, anon, authenticated')
            connection.exec_driver_sql(f'GRANT ALL ON ALL SEQUENCES IN SCHEMA "{schema}" TO PUBLIC, anon, authenticated')
            connection.exec_driver_sql(f'CREATE POLICY permissive_fixture ON "{schema}".private_items TO PUBLIC USING (true) WITH CHECK (true)')
            for kind in ("TABLES", "SEQUENCES"):
                connection.exec_driver_sql(f'ALTER DEFAULT PRIVILEGES IN SCHEMA "{schema}" GRANT ALL ON {kind} TO PUBLIC, anon, authenticated')
            yield connection, schema
        finally:
            transaction.rollback()
    engine.dispose()


def protect(migration, connection, schema):
    migration.protect_private_tables(connection, schema, ("private_items",))


@pytest.mark.parametrize("role", ["anon", "authenticated"])
def test_private_tables_columns_sequences_and_writes_denied(postgres, migration, role):
    connection, schema = postgres
    protect(migration, connection, schema)
    assert connection.execute(text("SELECT relrowsecurity FROM pg_class WHERE oid=CAST(:name AS regclass)"),
                              {"name": f'"{schema}".private_items'}).scalar() is True
    operations = [
        f'SELECT secret FROM "{schema}".private_items',
        f"INSERT INTO \"{schema}\".private_items (user_id,secret) VALUES ('other','forged')",
        f"UPDATE \"{schema}\".private_items SET secret='forged'",
        f'DELETE FROM "{schema}".private_items',
        f'TRUNCATE "{schema}".private_items',
        f"SELECT nextval('\"{schema}\".private_items_id_seq')",
    ]
    for sql in operations:
        with pytest.raises(DBAPIError) as error:
            with connection.begin_nested():
                connection.exec_driver_sql(f'SET LOCAL ROLE "{role}"')
                connection.exec_driver_sql(sql)
        assert error.value.orig.sqlstate == "42501", sql
    assert connection.execute(text(f'SELECT secret FROM "{schema}".private_items')).scalar() == "synthetic-private-resume"
    connection.exec_driver_sql(f"UPDATE \"{schema}\".private_items SET secret='backend-update'")
    connection.exec_driver_sql(f"INSERT INTO \"{schema}\".private_items (user_id,secret) VALUES ('backend','allowed')")
    assert connection.execute(text(f'SELECT COUNT(*) FROM "{schema}".private_items')).scalar() == 2


def test_future_tables_and_sequences_do_not_receive_public_grants(postgres, migration):
    connection, schema = postgres
    protect(migration, connection, schema)
    connection.exec_driver_sql(f'CREATE TABLE "{schema}".future_private (id BIGSERIAL PRIMARY KEY, secret TEXT)')
    for role in ("anon", "authenticated"):
        assert not connection.execute(text("SELECT has_table_privilege(:role,CAST(:name AS regclass),'SELECT,INSERT,UPDATE,DELETE')"),
            {"role": role, "name": f'"{schema}".future_private'}).scalar()
        assert not connection.execute(text("SELECT has_sequence_privilege(:role,CAST(:name AS regclass),'USAGE,SELECT,UPDATE')"),
            {"role": role, "name": f'"{schema}".future_private_id_seq'}).scalar()


def test_unrelated_table_and_other_schema_defaults_unchanged(postgres, migration):
    connection, schema = postgres
    other = schema + "_other"
    connection.exec_driver_sql(f'CREATE SCHEMA "{other}"')
    connection.exec_driver_sql(f'ALTER DEFAULT PRIVILEGES IN SCHEMA "{other}" GRANT SELECT ON TABLES TO anon')
    connection.exec_driver_sql(f'CREATE TABLE "{other}".unrelated (id BIGSERIAL PRIMARY KEY)')
    connection.exec_driver_sql(f'CREATE TABLE "{schema}".unrelated (id BIGSERIAL PRIMARY KEY)')
    connection.exec_driver_sql(f'GRANT SELECT ON "{schema}".unrelated TO anon')
    connection.exec_driver_sql(f'GRANT USAGE ON "{schema}".unrelated_id_seq TO anon')
    protect(migration, connection, schema)
    for name in (f'"{other}".unrelated', f'"{schema}".unrelated'):
        assert connection.execute(text("SELECT has_table_privilege('anon',CAST(:name AS regclass),'SELECT')"), {"name": name}).scalar()
    assert connection.execute(text("SELECT has_sequence_privilege('anon',CAST(:name AS regclass),'USAGE')"),
        {"name": f'"{schema}".unrelated_id_seq'}).scalar()
    connection.exec_driver_sql(f'CREATE TABLE "{other}".later (id INTEGER)')
    assert connection.execute(text("SELECT has_table_privilege('anon',CAST(:name AS regclass),'SELECT')"),
        {"name": f'"{other}".later'}).scalar()


def test_migration_is_idempotent_and_downgrade_keeps_containment(postgres, migration):
    connection, schema = postgres
    protect(migration, connection, schema)
    protect(migration, connection, schema)
    migration.downgrade()
    assert not connection.execute(text("SELECT has_table_privilege('anon',CAST(:name AS regclass),'SELECT')"),
        {"name": f'"{schema}".private_items'}).scalar()


def test_missing_table_aborts_before_changing_existing_permissions(postgres, migration):
    connection, schema = postgres
    with pytest.raises(RuntimeError, match="missing"):
        migration.protect_private_tables(connection, schema, ("private_items", "missing_table"))
    assert connection.execute(text("SELECT has_table_privilege('anon',CAST(:name AS regclass),'SELECT')"),
        {"name": f'"{schema}".private_items'}).scalar()


def test_global_grants_fail_before_touching_other_schemas(postgres, migration):
    connection, schema = postgres
    connection.exec_driver_sql('ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO anon')
    with pytest.raises(RuntimeError, match="Global public default grants"):
        protect(migration, connection, schema)
    assert connection.execute(text("SELECT has_table_privilege('anon',CAST(:name AS regclass),'SELECT')"),
        {"name": f'"{schema}".private_items'}).scalar()


def test_inherited_permission_aborts_transaction_instead_of_claiming_success(postgres, migration):
    connection, schema = postgres
    role = schema + "_reader"
    connection.exec_driver_sql(f'CREATE ROLE "{role}" NOLOGIN')
    connection.exec_driver_sql(f'GRANT SELECT ON "{schema}".private_items TO "{role}"')
    connection.exec_driver_sql(f'GRANT "{role}" TO anon')
    with pytest.raises(RuntimeError, match="inherited public role"):
        with connection.begin_nested():
            protect(migration, connection, schema)
    assert connection.execute(text("SELECT has_table_privilege('anon',CAST(:name AS regclass),'SELECT')"),
        {"name": f'"{schema}".private_items'}).scalar()


def test_backend_without_rls_access_is_rejected_before_mutation(postgres, migration):
    connection, schema = postgres
    role = schema + "_backend"
    connection.exec_driver_sql(f'CREATE ROLE "{role}" NOLOGIN')
    connection.exec_driver_sql(f'GRANT ALL ON "{schema}".private_items TO "{role}"')
    with pytest.raises(RuntimeError, match="backend role must retain"):
        with connection.begin_nested():
            connection.exec_driver_sql(f'SET LOCAL ROLE "{role}"')
            protect(migration, connection, schema)
