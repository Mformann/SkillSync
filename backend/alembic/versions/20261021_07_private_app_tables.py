"""Restrict private app tables to the backend database role.

Revision ID: 20261021_07
Revises: deaf9f5a764b

This application uses Supabase for Auth, not direct browser table access.
Permission changes are transactional; rollback of this revision intentionally
does not reopen public access. SQLite has no database roles or RLS.
"""
from alembic import op
import sqlalchemy as sa

revision = "20261021_07"
down_revision = "deaf9f5a764b"
branch_labels = None
depends_on = None

PRIVATE_TABLES = (
    "target_jobs", "resumes", "analyses", "learning_plans", "learning_tasks",
    "resume_versions", "job_applications", "portfolio_evidence", "interview_sessions",
    "career_profiles", "career_achievements", "application_packages", "application_events",
    "skill_assessments", "growth_preferences", "career_contacts", "career_reminders",
    "passport_shares", "passport_reviews",
)
PUBLIC_ROLES = ("anon", "authenticated")
INTERNAL_TABLES = ("alembic_version",)
TABLE_PRIVILEGES = "SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER"
COLUMN_PRIVILEGES = "SELECT,INSERT,UPDATE,REFERENCES"
SEQUENCE_PRIVILEGES = "USAGE,SELECT,UPDATE"


def _tables_query(sql):
    return sa.text(sql).bindparams(sa.bindparam("tables", expanding=True))


def protect_private_tables(connection, schema="public", table_names=None):
    """Apply this frozen migration to a schema; tests use disposable schemas."""
    if connection.dialect.name != "postgresql":
        return
    if table_names is None:
        table_names = PRIVATE_TABLES + INTERNAL_TABLES
    quote = connection.dialect.identifier_preparer.quote_identifier
    parameters = {"schema": schema, "tables": tuple(table_names)}
    backend = connection.execute(sa.text(
        "SELECT current_user AS name, rolsuper OR rolbypassrls AS bypass "
        "FROM pg_roles WHERE rolname=current_user"
    )).mappings().one()
    if backend["name"] in PUBLIC_ROLES:
        raise RuntimeError("Private-table migrations cannot run as a public API role.")
    roles = connection.execute(sa.text(
        "SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') ORDER BY rolname"
    )).scalars().all()
    tables = connection.execute(_tables_query("""
        SELECT c.oid, c.relname, c.relforcerowsecurity,
               pg_has_role(current_user,c.relowner,'USAGE') AS owns
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=:schema AND c.relname IN :tables AND c.relkind IN ('r','p')
        ORDER BY c.relname
    """), parameters).mappings().all()
    if {r["relname"] for r in tables} != set(table_names):
        raise RuntimeError("A private application table is missing; apply earlier migrations first.")
    if not backend["bypass"] and any(not r["owns"] or r["relforcerowsecurity"] for r in tables):
        raise RuntimeError("The backend role must retain owner/BYPASSRLS access to private tables.")

    # Schema-specific revokes cannot override global default grants. Do not
    # silently change defaults for unrelated schemas (for example storage).
    global_public_grants = connection.execute(sa.text("""
        SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
        WHERE d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user)
          AND d.defaclnamespace=0 AND d.defaclobjtype IN ('r','S')
          AND (a.grantee=0 OR a.grantee IN
               (SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated')))
        LIMIT 1
    """)).scalar()
    if global_public_grants:
        raise RuntimeError("Global public default grants require owner review before this schema-only migration.")

    columns = connection.execute(_tables_query("""
        SELECT c.relname, a.attname FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_attribute a ON a.attrelid=c.oid
        WHERE n.nspname=:schema AND c.relname IN :tables
          AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum
    """), parameters).all()
    sequences = connection.execute(_tables_query("""
        SELECT DISTINCT sn.nspname AS schema_name,s.relname
        FROM pg_class s JOIN pg_namespace sn ON sn.oid=s.relnamespace
        JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=s.oid
        JOIN pg_class t ON d.refclassid='pg_class'::regclass AND d.refobjid=t.oid
        JOIN pg_namespace tn ON tn.oid=t.relnamespace
        WHERE s.relkind='S' AND d.deptype IN ('a','i')
          AND tn.nspname=:schema AND t.relname IN :tables
        ORDER BY sn.nspname,s.relname
    """), parameters).mappings().all()
    statements = []
    grantees = ["PUBLIC", *(quote(role) for role in roles)]
    for table in tables:
        name = f'{quote(schema)}.{quote(table["relname"])}'
        column_names = ", ".join(quote(column) for tab, column in columns if tab == table["relname"])
        statements.append(f"ALTER TABLE {name} ENABLE ROW LEVEL SECURITY")
        for grantee in grantees:
            statements.append(f"REVOKE ALL PRIVILEGES ON TABLE {name} FROM {grantee}")
            # Table-level revokes do not remove separately granted column ACLs.
            statements.append(f"REVOKE ALL PRIVILEGES ({column_names}) ON TABLE {name} FROM {grantee}")
    for sequence in sequences:
        name = f'{quote(sequence["schema_name"])}.{quote(sequence["relname"])}'
        for grantee in grantees:
            statements.append(f"REVOKE ALL PRIVILEGES ON SEQUENCE {name} FROM {grantee}")
    for kind in ("TABLES", "SEQUENCES"):
        for grantee in grantees:
            statements.append(
                f'ALTER DEFAULT PRIVILEGES FOR ROLE {quote(backend["name"])} '
                f'IN SCHEMA {quote(schema)} REVOKE ALL PRIVILEGES ON {kind} FROM {grantee}'
            )
    # One round trip for the DDL, all inside Alembic's transaction.
    connection.exec_driver_sql(";\n".join(statements))

    # Inherited role grants must not silently leave effective public access.
    leaked = connection.execute(_tables_query("""
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        CROSS JOIN pg_roles r
        WHERE n.nspname=:schema AND c.relname IN :tables
          AND r.rolname IN ('anon','authenticated')
          AND (has_table_privilege(r.oid,c.oid,:table_privileges)
               OR has_any_column_privilege(r.oid,c.oid,:column_privileges)) LIMIT 1
    """), {**parameters, "table_privileges": TABLE_PRIVILEGES,
            "column_privileges": COLUMN_PRIVILEGES}).scalar()
    if leaked:
        raise RuntimeError("An inherited public role still has private-table access; migration rolled back.")
    for sequence in sequences:
        leaked = connection.execute(sa.text("""
            SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated')
              AND has_sequence_privilege(oid,CAST(:sequence AS regclass),:privileges) LIMIT 1
        """), {"sequence": f'{quote(sequence["schema_name"])}.{quote(sequence["relname"])}',
                "privileges": SEQUENCE_PRIVILEGES}).scalar()
        if leaked:
            raise RuntimeError("An inherited public role still has a private sequence privilege.")
    missing_backend_access = connection.execute(_tables_query("""
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=:schema AND c.relname IN :tables AND NOT (
            has_table_privilege(current_user,c.oid,'SELECT') AND
            has_table_privilege(current_user,c.oid,'INSERT') AND
            has_table_privilege(current_user,c.oid,'UPDATE') AND
            has_table_privilege(current_user,c.oid,'DELETE')) LIMIT 1
    """), parameters).scalar()
    if missing_backend_access:
        raise RuntimeError("Backend table access would be lost; migration rolled back.")


def upgrade():
    protect_private_tables(op.get_bind())


def downgrade():
    # Security containment survives application rollback. Restoring public
    # grants or disabling RLS would knowingly reintroduce candidate-data access.
    pass
