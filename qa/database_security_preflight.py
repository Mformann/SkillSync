"""Read-only security metadata; never retrieve candidate records or print credentials."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from dotenv import load_dotenv
load_dotenv(ROOT / "backend/.env")
from sqlalchemy import create_engine, text
from app.database import DATABASE_URL, Base
from app import models, growth_models

engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 10})
with engine.connect() as db:
    db.execute(text("SET TRANSACTION READ ONLY"))
    db.execute(text("SET LOCAL statement_timeout = '10000ms'"))
    queries = {
        "backend_role": "SELECT current_user AS role, r.rolsuper, r.rolbypassrls FROM pg_roles r WHERE r.rolname=current_user",
        "migration": "SELECT version_num FROM alembic_version",
        "table_permissions": """SELECT c.relname AS table_name, owner.rolname AS owner, c.relrowsecurity AS rls,
            c.relforcerowsecurity AS force_rls, r.rolname AS role,
            has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
            has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,
            has_table_privilege(r.oid,c.oid,'UPDATE') AS can_update,
            has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete,
            has_table_privilege(r.oid,c.oid,'TRUNCATE') AS can_truncate,
            has_any_column_privilege(r.oid,c.oid,'SELECT') AS any_column_select,
            has_any_column_privilege(r.oid,c.oid,'INSERT') AS any_column_insert,
            has_any_column_privilege(r.oid,c.oid,'UPDATE') AS any_column_update,
            c.relacl::text AS acl
            FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            JOIN pg_roles owner ON owner.oid=c.relowner
            CROSS JOIN pg_roles r
            WHERE n.nspname='public' AND c.relkind='r'
            AND r.rolname IN ('anon','authenticated',current_user) ORDER BY c.relname,r.rolname""",
        "sequences": """SELECT c.relname AS name, pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl
            FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relkind='S' ORDER BY c.relname""",
        "default_privileges": """SELECT pg_get_userbyid(d.defaclrole) AS owner,
            COALESCE(n.nspname,'GLOBAL') AS schema, d.defaclobjtype AS object_type, d.defaclacl::text AS acl
            FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
            WHERE d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user)
            ORDER BY schema,object_type""",
        "schema_permissions": """SELECT rolname AS role,has_schema_privilege(oid,'public','USAGE') AS usage,
            has_schema_privilege(oid,'public','CREATE') AS can_create FROM pg_roles
            WHERE rolname IN ('anon','authenticated',current_user)""",
    }
    result = {name: [dict(row) for row in db.execute(text(sql)).mappings()] for name, sql in queries.items()}
    result["table_permissions"] = [r for r in result["table_permissions"] if r["table_name"] in set(Base.metadata.tables) | {"alembic_version"}]
    db.rollback()
engine.dispose()
path = ROOT / "qa/database-security-before.json"
path.write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps({"role": result["backend_role"], "migration": result["migration"],
    "private_table_count": len(Base.metadata.tables),
    "publicly_exposed_tables": sorted({r["table_name"] for r in result["table_permissions"] if r["role"] in {"anon", "authenticated"} and (r["can_select"] or r["can_insert"] or r["can_update"] or r["can_delete"])}),
    "owners": sorted({r["owner"] for r in result["table_permissions"]}),
    "defaults": result["default_privileges"], "schema_permissions": result["schema_permissions"]}, indent=2))
