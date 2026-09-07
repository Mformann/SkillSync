# SkillSync

SkillSync is a career-readiness workspace that connects a target job description
with the resume a candidate plans to submit. Phase 3 turns explainable skill
gaps into prerequisite-aware learning plans with evidence-based progress.

## Implemented capabilities

- Supabase email/password authentication
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
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `frontend/.env`.

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

Set the database URL and Supabase JWT secret in `backend/.env`. Retrieve the
legacy JWT secret from the Supabase project settings when using HS256 access
tokens. Never place that secret in the frontend environment.

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

```powershell
cd frontend
npx tsc --noEmit
npm run build

cd ..\backend
pytest
python -m compileall -q app
```

The API health endpoint is `GET /health`. Interactive API documentation is
available at `/docs` while the backend is running.

## Main API routes

- `GET /auth/me`
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
