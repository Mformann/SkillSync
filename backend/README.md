# SkillSync API

FastAPI + SQLAlchemy, with Supabase Auth identity. PostgreSQL is supported in
production; SQLite is the local default. Passwords and signup/login are handled
by Supabase, not stored or hashed by this API.

## Install and run (Windows)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Configure .env before running migrations or the server.
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Use Python 3.11/3.12. Set `DATABASE_URL`, `SUPABASE_URL`, and the public
`SUPABASE_PUBLISHABLE_KEY`. The Supabase project must match the frontend.
`SUPABASE_JWT_AUDIENCE` defaults to `authenticated`; the expected issuer defaults
to `<SUPABASE_URL>/auth/v1`. An optional `SUPABASE_JWT_ISSUER` supports custom
trusted issuer configuration. Never use a service-role/secret key in the browser.

ES256/RS256 tokens are signature-verified with the project's public JWKS and a
ten-minute maximum key-set cache. Legacy HS256 tokens are verified remotely by
Supabase Auth using the public API key. All accepted tokens require issuer,
audience, subject, and expiry. Verification outages return 503; rejected tokens
return a generic 401. The frontend retries a token refresh once without silently
signing users out on backend failures.

## Routes and ownership

`GET /health`, interactive `/docs`, and `GET /growth/public/passport/{token}` are
public. The passport route requires an unguessable, unexpired, non-revoked sharing
capability and returns only its selected snapshot. All other application API routes
require `Authorization: Bearer <Supabase access token>`, including stateless
skill-gap comparison. There is no `/auth/token`, local signup, or local login.

- `GET /auth/me`: verified identity
- `GET /dashboard/summary`: current user's summary
- `/workspaces`, `/resume`, `/learning`, `/career`, `/resume-studio`, `/product`:
  user-scoped career data
- `POST /analysis/skill-gap-analysis`: authenticated stateless comparison
- `/growth`: assessments, planning, job imports/matching, interviews, passports,
  private contacts, and reminder/calendar workflows. See `../CAREER_GROWTH.md`.

See the root README and `/docs` for the complete API contract. Data-access queries
must always filter by the verified user ID. User metadata is display-only, not an
authorization source. Configure strict production CORS origins and HTTPS.

## Container deployment

`Dockerfile` is the production entry point. It installs pinned dependencies,
runs `alembic upgrade head`, starts Uvicorn as a non-root user, and includes a
health check. Build it from the repository root:

```powershell
docker build -t skillsync-api ./backend
docker run --env-file ./backend/.env -p 8000:8000 skillsync-api
```

Production startup fails fast unless `DATABASE_URL` is PostgreSQL,
`SUPABASE_URL` is HTTPS, and `CORS_ORIGINS` contains exact HTTPS origins
without wildcards. API documentation is disabled by default in production; set
`ENABLE_API_DOCS=true` only when public docs are intentional. See
`../DEPLOYMENT.md` for the complete release order and checklist.

## Verify

```powershell
pytest -q
python -m compileall -q app
pip install pip-audit
python -m pip_audit -r requirements.txt
```

Authentication tests exercise real ES256/RS256 signatures, tampering, required
claims, wrong issuers/audiences, expiry, upstream failures, legacy remote
verification, and bearer requirements. No hosted account is created by tests.
Hosted redirect configuration, email delivery, JWT lifetime, and any exposed
Postgres tables' RLS still need deployment-specific verification.
