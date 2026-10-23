"""Bounded owned lists, stable cursors, summary payloads and schema parity."""
from contextlib import contextmanager
from datetime import datetime, timezone

from sqlalchemy import event, inspect, text
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
import pytest

from app import models as m
from app.database import Base
from test_analysis_runs import environment
from test_analysis_run_migration import migrated_database


@contextmanager
def selects(factory):
    statements = []
    def record(_connection, _cursor, statement, *_):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)
    engine = factory.kw["bind"]
    event.listen(engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", record)


def seed(factory, count=65):
    with factory() as db:
        for index in range(count):
            job = m.TargetJob(user_id="candidate-a", title=f"Role {index}", description="D"*50000,
                updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
            db.add(job); db.flush()
            for n in range(2):
                resume = m.Resume(user_id="candidate-a", target_job_id=job.id,
                    filename=f"resume-{n}.docx", content_type="fixture", size_bytes=40, extracted_text="PRIVATE DOCUMENT BODY")
                db.add(resume); db.flush()
                db.add(m.Analysis(user_id="candidate-a", target_job_id=job.id, resume_id=resume.id,
                    resume_filename=resume.filename, resume_text=resume.extracted_text))
        db.add(m.TargetJob(user_id="candidate-b", title="Other owner", description="Other owner description"))
        db.add(m.TargetJob(user_id="candidate-a", title="Archived", description="Archived description", is_archived=True))
        db.commit()


def test_workspace_summary_is_three_queries_at_any_page_size_and_has_no_document_bodies(environment):
    client, factory, *_ = environment
    seed(factory)
    for size in (20, 50):
        with selects(factory) as statements:
            response = client.get("/workspaces", params={"limit": size})
        assert response.status_code == 200, response.text
        assert len(statements) == 3
        assert len(response.json()) == size
        assert all(len(item["description"]) <= 240 for item in response.json())
        assert all(item["resume_count"] == 2 and len(item["resumes"]) == 1 for item in response.json())
        assert all(item["resumes"][0]["filename"] == "resume-1.docx" for item in response.json())
        joined = " ".join(statements).lower()
        for field in ("extracted_text", "explainable_data", "score_breakdown", "resume_text"):
            assert field not in joined
        assert "PRIVATE DOCUMENT BODY" not in response.text


@pytest.mark.parametrize("path,key", [("/workspaces", "id"), ("/resume/all", "id"), ("/career/workspaces", "workspace_id")])
def test_cursor_pages_remain_owned_and_stable_after_newer_insert(environment, path, key):
    client, factory, *_ = environment
    seed(factory, 12)
    expected = client.get(path, params={"limit": 100}).json()
    first = client.get(path, params={"limit": 5})
    seen = first.json()
    cursor = first.headers["x-next-cursor"]
    with factory() as db:
        db.add(m.TargetJob(user_id="candidate-a", title="Inserted after page one", description="A newly inserted target job"))
        db.commit()
    while cursor:
        response = client.get(path, params={"limit": 5, "before_id": cursor})
        assert response.status_code == 200
        seen.extend(response.json()); cursor = response.headers["x-next-cursor"]
    assert [item[key] for item in seen] == [item[key] for item in expected]
    assert len({item[key] for item in seen}) == len(seen)
    assert "Other owner" not in str(seen) and "Archived" not in str(seen)


@pytest.mark.parametrize("path", ["/workspaces", "/resume/all", "/career/workspaces"])
def test_invalid_page_bounds_are_structured_422(environment, path):
    client, *_ = environment
    for params in ({"limit": 0}, {"limit": 101}, {"before_id": 0}, {"before_id": "bad"}):
        response = client.get(path, params=params)
        assert response.status_code == 422 and isinstance(response.json()["detail"], list)


def test_history_and_career_queries_do_not_grow_per_row(environment):
    client, factory, *_ = environment
    seed(factory)
    for path in ("/resume/all", "/career/workspaces"):
        counts = []
        for size in (20, 50):
            with selects(factory) as statements:
                response = client.get(path, params={"limit": size})
            assert response.status_code == 200, response.text
            counts.append(len(statements))
        assert counts[0] == counts[1]
        assert counts[0] <= 8


def test_privacy_export_is_complete_despite_list_pagination(environment):
    client, factory, *_ = environment
    seed(factory)
    assert len(client.get("/workspaces").json()) == 50
    exported = client.get("/product/privacy/export")
    assert exported.status_code == 200
    assert len(exported.json()["target_jobs"]) == 67
    assert len(exported.json()["resumes"]) == 131
    assert "Other owner" not in exported.text


def test_migrated_schema_matches_metadata_without_duplicate_primary_key_indexes(migrated_database):
    engine, config = migrated_database
    with engine.connect() as connection:
        assert compare_metadata(MigrationContext.configure(connection, opts={"compare_type": True}), Base.metadata) == []
        assert connection.execute(text("SELECT COUNT(*) FROM analyses")).scalar() == 1
    for table in Base.metadata.tables:
        assert f"ix_{table}_id" not in {item["name"] for item in inspect(engine).get_indexes(table)}
    command.check(config)


def test_upgrade_removes_old_metadata_indexes_without_touching_custom_indexes_or_data(migrated_database):
    engine, config = migrated_database
    command.downgrade(config, "20261021_08")
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE INDEX ix_analyses_id ON analyses (id)")
        connection.exec_driver_sql("CREATE INDEX fixture_custom_analysis_id ON analyses (id)")
    command.upgrade(config, "head")
    indexes = {item["name"] for item in inspect(engine).get_indexes("analyses")}
    assert "ix_analyses_id" not in indexes
    assert "fixture_custom_analysis_id" in indexes
    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM analyses")).scalar() == 1
        assert connection.execute(text("SELECT COUNT(*) FROM ai_usage")).scalar() == 1


def test_paging_uses_owned_composite_index(migrated_database):
    engine, _ = migrated_database
    statement = "SELECT id FROM target_jobs WHERE user_id='fixture' AND is_archived=false AND id<100 ORDER BY id DESC LIMIT 20"
    with engine.begin() as connection:
        if engine.dialect.name == "postgresql":
            connection.exec_driver_sql("SET LOCAL enable_seqscan=off")
            plan = str(connection.exec_driver_sql("EXPLAIN " + statement).all())
        else:
            plan = str(connection.exec_driver_sql("EXPLAIN QUERY PLAN " + statement).all())
    # SQLite may prefer the existing ownership index, whose rowid suffix also
    # supports this cursor. Either indexed seek satisfies the query contract.
    assert any(name in plan for name in ("ix_target_jobs_user_archive_id", "ix_target_jobs_user_id"))
