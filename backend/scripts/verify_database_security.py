"""Read-only audit of private-table isolation; exits nonzero for an unsafe result.

Run from backend: python scripts/verify_database_security.py [--output PATH]
Only catalog metadata and zero-row backend reads are inspected. No tokens,
connection strings, or user records are included in output.
"""
import argparse
import json
from pathlib import Path
import sys

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from dotenv import load_dotenv
load_dotenv(BACKEND / ".env")
from sqlalchemy import bindparam, create_engine, text
from app import models, growth_models  # register models
from app.database import Base, DATABASE_URL


def audit(connection):
    if connection.dialect.name != "postgresql":
        raise RuntimeError("Private role isolation must be verified against PostgreSQL.")
    expected_tables = set(Base.metadata.tables) | {"alembic_version"}
    parameters = {"tables": tuple(sorted(expected_tables))}
    def table_sql(sql):
        return text(sql).bindparams(bindparam("tables", expanding=True))
    backend = connection.execute(text(
        "SELECT current_user AS name, rolsuper OR rolbypassrls AS bypass "
        "FROM pg_roles WHERE rolname=current_user"
    )).mappings().one()
    tables = [dict(row) for row in connection.execute(table_sql("""
        SELECT c.relname AS table_name,c.relrowsecurity AS rls,
            (has_table_privilege(current_user,c.oid,'SELECT') AND
             has_table_privilege(current_user,c.oid,'INSERT') AND
             has_table_privilege(current_user,c.oid,'UPDATE') AND
             has_table_privilege(current_user,c.oid,'DELETE')) AS backend_crud,
            (NOT c.relforcerowsecurity AND pg_has_role(current_user,c.relowner,'USAGE')) AS backend_owner
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname IN :tables AND c.relkind IN ('r','p')
        ORDER BY c.relname
    """), parameters).mappings()]
    grants = [dict(row) for row in connection.execute(table_sql("""
        SELECT c.relname AS table_name,r.rolname AS role,
            has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS table_access,
            has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') AS column_access
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        CROSS JOIN pg_roles r WHERE n.nspname='public' AND c.relname IN :tables
          AND r.rolname IN ('anon','authenticated') ORDER BY c.relname,r.rolname
    """), parameters).mappings()]
    sequences = [dict(row) for row in connection.execute(table_sql("""
        SELECT DISTINCT sn.nspname AS schema_name,s.relname AS sequence_name,r.rolname AS role,
            has_sequence_privilege(r.oid,s.oid,'USAGE,SELECT,UPDATE') AS public_access
        FROM pg_class s JOIN pg_namespace sn ON sn.oid=s.relnamespace
        JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=s.oid
        JOIN pg_class t ON d.refclassid='pg_class'::regclass AND d.refobjid=t.oid
        JOIN pg_namespace tn ON tn.oid=t.relnamespace CROSS JOIN pg_roles r
        WHERE s.relkind='S' AND d.deptype IN ('a','i') AND tn.nspname='public'
          AND t.relname IN :tables AND r.rolname IN ('anon','authenticated')
        ORDER BY sequence_name,role
    """), parameters).mappings()]
    defaults = [dict(row) for row in connection.execute(text("""
        SELECT COALESCE(n.nspname,'GLOBAL') AS schema_name,d.defaclobjtype AS object_type,
            COALESCE(r.rolname,'PUBLIC') AS grantee,a.privilege_type
        FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
        CROSS JOIN LATERAL aclexplode(d.defaclacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
        WHERE d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user)
          AND (d.defaclnamespace=0 OR n.nspname='public') AND d.defaclobjtype IN ('r','S')
          AND (a.grantee=0 OR r.rolname IN ('anon','authenticated'))
    """)).mappings()]
    missing = sorted(expected_tables - {t["table_name"] for t in tables})
    issues = []
    if missing:
        issues.append({"missing_tables": missing})
    issues.extend({"rls_disabled": t["table_name"]} for t in tables if not t["rls"])
    issues.extend({"public_table_access": t} for t in grants if t["table_access"] or t["column_access"])
    issues.extend({"public_sequence_access": s} for s in sequences if s["public_access"])
    issues.extend({"public_default_grant": d} for d in defaults)
    issues.extend({"backend_access_missing": t["table_name"]} for t in tables
                  if not t["backend_crud"] or not (backend["bypass"] or t["backend_owner"]))
    if not issues:
        quote = connection.dialect.identifier_preparer.quote_identifier
        for t in tables:
            connection.exec_driver_sql(f'SELECT 1 FROM public.{quote(t["table_name"])} LIMIT 0')
    return {"secure": not issues, "backend_role": backend["name"],
            "private_table_count": sum(t["table_name"] in Base.metadata.tables for t in tables),
            "protected_table_count": len(tables), "issues": issues,
            "tables": tables, "public_role_permissions": grants,
            "sequence_permissions": sequences, "public_default_grants": defaults}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 10})
        with engine.connect() as connection:
            connection.execute(text("SET TRANSACTION READ ONLY"))
            connection.execute(text("SET LOCAL statement_timeout = '10000ms'"))
            result = audit(connection)
            result["migration_heads"] = connection.execute(text("SELECT version_num FROM alembic_version")).scalars().all()
            connection.rollback()
        engine.dispose()
    except Exception as exc:
        result = {"secure": False, "error_type": type(exc).__name__}
    if args.output:
        args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k in {
        "secure", "backend_role", "private_table_count", "protected_table_count", "issues", "migration_heads", "error_type"
    }}, indent=2))
    return 0 if result["secure"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
