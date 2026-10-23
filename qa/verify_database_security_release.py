"""Verify deployed containment with catalog metadata, zero-row REST, and read-only API probes."""
import json
import os
from pathlib import Path
import sys
import uuid

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
sys.path.insert(0, str(root / "backend/scripts"))
from verify_database_security import audit, DATABASE_URL
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
import httpx
from fastapi.testclient import TestClient
from app.auth_utils import AuthenticatedUser, get_current_user
from app.database import get_session
from app.main import create_app

engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 10})
with engine.connect() as connection:
    connection.execute(text("SET TRANSACTION READ ONLY"))
    connection.execute(text("SET LOCAL statement_timeout='10000ms'"))
    metadata = audit(connection)
    metadata["migration_heads"] = connection.execute(text("SELECT version_num FROM alembic_version")).scalars().all()
    defaults = [dict(row) for row in connection.execute(text("""
        SELECT pg_get_userbyid(d.defaclrole) AS owner,COALESCE(n.nspname,'GLOBAL') AS schema,
            d.defaclobjtype AS object_type,d.defaclacl::text AS acl
        FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
        WHERE d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user)
        ORDER BY schema,object_type
    """)).mappings()]
    connection.rollback()
(root / "qa/database-security-after.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
assert metadata["secure"], "Database metadata verification failed"

baseline = json.loads((root / "qa/database-security-before.json").read_text(encoding="utf-8"))
def unrelated_defaults(rows):
    return [r for r in rows if r["schema"] != "public" or r["object_type"] not in {"r", "S"}]
assert unrelated_defaults(defaults) == unrelated_defaults(baseline["default_privileges"]), "Unrelated schema/function defaults changed"

public_key = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
project = os.environ["SUPABASE_URL"].rstrip("/")
rest = []
with httpx.Client(timeout=15, headers={"apikey": public_key}) as client:
    for table in metadata["tables"]:
        name = table["table_name"]
        response = client.get(project + f"/rest/v1/{name}", params={"select": "*", "limit": "0"})
        rest.append({"table": name, "status": response.status_code})
    health = client.get(project + "/auth/v1/health").status_code

app = create_app()
identity = str(uuid.uuid4())
app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=identity)
def read_only_session():
    with Session(engine) as session:
        session.execute(text("SET TRANSACTION READ ONLY"))
        session.execute(text("SET LOCAL statement_timeout='10000ms'"))
        try:
            yield session
        finally:
            session.rollback()
app.dependency_overrides[get_session] = read_only_session
checks = []
client = TestClient(app)
try:
    for path, expected in [("/health/ready", 200), ("/workspaces", 200), ("/resume/all", 200),
                           ("/product/privacy/export", 200), ("/growth/public/passport/" + uuid.uuid4().hex, 404)]:
        response = client.get(path)
        checks.append({"path": path.split("/passport/")[0], "status": response.status_code, "expected": expected})
finally:
    client.close()
engine.dispose()
result = {"secure": metadata["secure"], "private_table_count": metadata["private_table_count"],
    "protected_table_count": metadata["protected_table_count"], "migration_heads": metadata["migration_heads"],
    "anonymous_rest_checks": rest, "all_anonymous_rest_denied": all(r["status"] in {401, 403, 404} for r in rest),
    "supabase_auth_health": health, "backend_api_checks": checks,
    "backend_api_identity": "synthetic override with read-only sessions; no real account login",
    "unrelated_schema_and_function_defaults_unchanged": True, "candidate_records_modified": False}
result["passed"] = result["all_anonymous_rest_denied"] and health == 200 and all(c["status"] == c["expected"] for c in checks)
(root / "qa/database-security-release-results.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
raise SystemExit(0 if result["passed"] else 1)
