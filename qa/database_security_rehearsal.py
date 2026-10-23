"""Rehearse the permission-only migration in a transaction that is always rolled back."""
import importlib.util
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
sys.path.insert(0, str(root / "backend/scripts"))
from verify_database_security import audit, DATABASE_URL
from sqlalchemy import create_engine, text

spec = importlib.util.spec_from_file_location("private_tables_migration",
    root / "backend/alembic/versions/20261021_07_private_app_tables.py")
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)
engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 10})
with engine.connect() as connection:
    transaction = connection.begin()
    try:
        connection.execute(text("SET LOCAL lock_timeout='5s'"))
        connection.execute(text("SET LOCAL statement_timeout='30000ms'"))
        before = audit(connection)
        migration.protect_private_tables(connection)
        rehearsed = audit(connection)
        assert rehearsed["secure"], "Permission rehearsal failed verification"
    finally:
        transaction.rollback()
    restored = audit(connection)
    assert restored == before, "Rehearsal rollback did not restore original permission metadata"
    connection.rollback()
engine.dispose()
result = {"rehearsal_secure": rehearsed["secure"], "private_table_count": rehearsed["private_table_count"],
    "backend_role": rehearsed["backend_role"], "original_permissions_restored": restored == before,
    "hosted_candidate_rows_modified": False}
(root / "qa/database-security-rehearsal.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
