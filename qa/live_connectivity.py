"""Read-only configured-service checks. Never prints credentials or user records."""
import json
import os
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
from dotenv import load_dotenv
load_dotenv(root / "backend" / ".env")
import httpx
from sqlalchemy import create_engine, text

results = {}
def probe(name, fn):
    started = time.perf_counter()
    try:
        results[name] = {"ok": True, "details": fn()}
    except Exception as exc:
        results[name] = {"ok": False, "error_type": type(exc).__name__}
    results[name]["elapsed_ms"] = round((time.perf_counter() - started) * 1000)
    print(json.dumps({name: results[name]}), flush=True)

def database():
    from app.database import DATABASE_URL, Base
    from app import models, growth_models
    engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 8})
    with engine.connect() as connection:
        connection.execute(text("SET TRANSACTION READ ONLY"))
        connection.execute(text("SET LOCAL statement_timeout = '8000ms'"))
        connection.execute(text("SELECT 1"))
        version = connection.execute(text("SELECT version_num FROM alembic_version")).scalars().all()
        columns = connection.execute(text("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'")).all()
        actual = set(columns)
        missing = [f"{table.name}.{column.name}" for table in Base.metadata.sorted_tables for column in table.columns if (table.name,column.name) not in actual]
        rows = connection.execute(text("SELECT c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT'),has_table_privilege('authenticated',c.oid,'SELECT'),has_table_privilege('anon',c.oid,'INSERT'),has_table_privilege('anon',c.oid,'UPDATE'),has_table_privilege('anon',c.oid,'DELETE') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'")).all()
        exposure = [{"table": n, "rls": r, "anon_select": a, "authenticated_select": u, "anon_insert": i, "anon_update": up, "anon_delete": de} for n,r,a,u,i,up,de in rows if n in Base.metadata.tables]
        connection.rollback()
    engine.dispose()
    return {"select_1": True, "migration_heads": version, "missing_model_columns": missing, "app_table_security": exposure}

def supabase():
    project = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    with httpx.Client(timeout=10) as client:
        health = client.get(project + "/auth/v1/health", headers={"apikey": key})
        # limit=0 checks anonymous table access without retrieving any user rows.
        table = client.get(project + "/rest/v1/resumes?select=id&limit=0", headers={"apikey": key})
    return {"auth_health_status": health.status_code, "anonymous_resumes_limit_zero_status": table.status_code}

def groq():
    from app.services.ai_analysis_service import GroqProvider, calculate_scores
    result = GroqProvider().analyze(
        "Require Python and Docker for a backend engineer building reliable APIs.",
        "Synthetic QA candidate. Built Python APIs and wrote automated unit tests. No Docker experience is claimed.")
    return {"provider": "groq", "requirements": len(result.requirements), "matches": len(result.matches), "scores": calculate_scores(result)}

selected = sys.argv[1:] or ["database", "supabase", "groq_synthetic_analysis"]
for name, fn in [("database", database), ("supabase", supabase), ("groq_synthetic_analysis", groq)]:
    if name in selected:
        probe(name, fn)
output = Path(os.getenv("QA_CONNECTIVITY_OUTPUT", str(root / "qa" / "live-connectivity-results.json")))
previous = json.loads(output.read_text(encoding="utf-8")) if output.exists() else {}
previous.update(results)
output.write_text(json.dumps(previous, indent=2), encoding="utf-8")
