# SkillSync

SkillSync is a career-readiness workspace that connects a target job description
with the resume a candidate plans to submit. Phase 3 turns explainable skill
gaps into prerequisite-aware learning plans with evidence-based progress.

## Implemented capabilities

- Supabase email/password authentication, confirmation feedback, and password recovery
- Protected application routes
- Target-job workspaces with job title, company, and full description
- PDF and DOCX resume ingestion
- Server-side 10 MB size limits and basic file-signature validation
- In-memory file parsing; original files are not persisted
- Saved extracted resume text and workspace history
- User-scoped workspace and analysis APIs
- Alembic database migrations
- Responsive, accessible target-job and upload flows
- Structured job-requirement extraction through Groq
- Requirement-to-resume evidence matching
- Verbatim evidence verification
- Deterministic required, preferred, overall, and confidence scores
- Per-requirement confidence and recommended action
- AI-result caching by normalized input hash
- Explicit rule-based fallback when AI is unavailable
- Per-workspace consent before external AI processing
- Configurable per-user free-tier safety limit
- Learning-plan setup using weekly availability, deadline, and experience level
- Deterministic gap prioritization and prerequisite ordering
- Deadline-aware task scheduling and readiness status
- Curated links to free official learning resources
- Persistent weighted progress
- Project briefs and assessment criteria
- Evidence and reflection requirements before task completion
- Truth-grounded tailored resume versions with claim warnings and DOCX/PDF export
- Per-job application pipeline and next-action tracking
- Portfolio evidence linked to target skills
- Job-grounded interview practice with deterministic STAR feedback
- Explainable career-readiness scoring across match, learning, proof, practice, and materials
- Reusable Career Vault with user-attested achievement sources
- Evidence-linked cover letters, recruiter outreach, and follow-up packages
- Observed application funnel and conversion analytics
- User-controlled JSON data export and permanent app-data deletion
- Route-level frontend code splitting and production security headers

## Career Growth additions

Career Hub now links to knowledge assessments, an adaptive weekly planner,
reviewed job-link imports, conversational text interviews, expiring/revocable
Skills Passports, configured-feed matching, and private contacts/reminders.
See [CAREER_GROWTH.md](CAREER_GROWTH.md) for the feature boundaries, privacy model,
external configuration, and verification. Knowledge checks are unproctored;
AI feedback and account-based reviews are not verified professional credentials.

## Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Alembic
- Identity: Supabase Auth
- Database: PostgreSQL in production, SQLite for local development

## Local setup

### Frontend

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `frontend/.env`.
Existing `VITE_SUPABASE_ANON_KEY` configurations continue to work. Production
builds reject missing configuration and secret/service-role keys before bundling.
The key must be a public publishable/anon key, never a secret or service-role key.
Use Node.js 24 (the current Supabase SDK requires Node.js 22 or later).

### Backend

Use Python 3.11 or 3.12.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Set `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in `backend/.env`.
Both frontend and backend must use the same Supabase project. A legacy public
anon key also works as the backend publishable key. No JWT signing secret is
needed: ES256/RS256 access tokens are verified against the project's public
JWKS, and legacy HS256 tokens are verified through Supabase Auth's `/user` API.
Issuer, authenticated audience, subject, and expiry are checked. Public signing
keys are cached for at most ten minutes; rotate/revoke keys accordingly.

In Supabase Authentication → URL Configuration, allow these exact local redirect
URLs (and their production-origin equivalents):

- `http://localhost:5173/login`
- `http://localhost:5173/reset-password`
- `http://127.0.0.1:5173/login` and `http://127.0.0.1:5173/reset-password` if used

Set the Site URL to your deployed frontend origin. Enable the email/password
provider and configure email delivery. Confirmation-required signup displays
inbox guidance instead of pretending a session exists. Password recovery uses
the `PASSWORD_RECOVERY` event and requires a valid session before updating.
Recovery signs out all refresh sessions after a successful password change;
already-issued access JWTs can remain valid until expiry, so use a suitable
Supabase access-token lifetime for your security requirements.

For AI-assisted analysis, create a free Groq API key and set:

```dotenv
GROQ_API_KEY=your-key
GROQ_MODEL=openai/gpt-oss-20b
AI_DAILY_ANALYSIS_LIMIT=5
```

The API key stays in FastAPI and is never sent to the browser. Users must enable
AI processing when creating a workspace. Without consent, a limited local
keyword comparison runs instead.

For a new local SQLite database, `alembic upgrade head` creates all Phase 1
tables. The migration also adds the new relationship columns when it encounters
the earlier `analyses` table.

## Verification

For production architecture, environment variables, Vercel setup, the backend
container, Supabase redirects, and the release checklist, see
[DEPLOYMENT.md](DEPLOYMENT.md).

```powershell
cd frontend
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm audit

cd ..\backend
pytest
python -m compileall -q app
python -m pip_audit -r requirements.txt
```

The API liveness endpoint is `GET /health`; `GET /health/ready` also checks
database connectivity. Interactive API documentation is available at `/docs`
in development and is disabled by default in production.

Browser checks use installed Microsoft Edge in headless mode, cover light/dark
auth pages at mobile, landscape, and desktop widths, and do not send credentials
to Supabase. Run `pip install pip-audit` if the optional audit tool is absent.
For the actual hosted project, also verify email delivery, redirect allowlists,
and a test-account sign-in. Local tests do not certify hosted RLS or production
security. Do not expose app-data tables through a public Supabase API without
appropriate row-level security policies.

## Main API routes

- `GET /auth/me`
- `GET /dashboard/summary`
- `POST /analysis/skill-gap-analysis`
- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/{id}`
- `PATCH /workspaces/{id}`
- `DELETE /workspaces/{id}`
- `POST /resume/upload`
- `GET /resume/all`
- `GET /resume/analysis/{id}`
- `GET /resume/analysis/{id}/explainable`
- `POST /resume/analysis/{id}/run`
- `POST /learning/plans`
- `GET /learning/plans/latest`
- `GET /learning/plans/by-analysis/{analysis_id}`
- `PATCH /learning/tasks/{task_id}`
- `GET /career/workspaces`
- `PUT /career/workspaces/{workspace_id}/application`
- `POST /career/workspaces/{workspace_id}/evidence`
- `POST /career/workspaces/{workspace_id}/interview-sessions`
- `PATCH /career/interview-sessions/{session_id}/answer`
- `GET /product/vault`
- `PUT /product/vault`
- `POST /product/vault/achievements`
- `POST /product/workspaces/{workspace_id}/package`
- `GET /product/analytics`
- `GET /product/privacy/export`
- `POST /product/privacy/delete-app-data`

All routes except system health and API documentation require a Supabase bearer
token.

## Phase roadmap

1. Foundation and target-job workspaces — implemented
2. Explainable hybrid-AI requirement and evidence matching — implemented
3. Optimized learning roadmap and verified progress — implemented
4. Truth-grounded tailored resume studio and ATS-safe export — implemented
5. Grounded interview coach, application tracking, proof, and readiness controls — implemented
