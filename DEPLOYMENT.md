# SkillSync deployment

SkillSync deploys as two services:

For the free production release on Render, Supabase and Vercel, use
[PRODUCTION_RELEASE.md](PRODUCTION_RELEASE.md) for the current setup and release
checks. Earlier beta reports describe historical verification; they do not
certify this candidate or the hosted deployment.

- `frontend/`: a static React application, configured for Vercel by
  `vercel.json`.
- `backend/`: a FastAPI container with PostgreSQL and Alembic migrations.

Deploy the API first because its HTTPS origin is required by the frontend build.

For this candidate, follow [the first beta deployment checklist](qa/FIRST_BETA_DEPLOYMENT.md).
The code is prepared for first deployment; real-account/email acceptance and
deployed load checks run before opening access to testers.

Backend installs use `requirements.lock` with `--require-hashes` in Docker and CI.
Keep `requirements.txt` as the human-maintained input; regenerate/review the lock
and rerun audits when changing dependencies. The container uses the same
`backend/scripts/start.sh` exercised by `qa/production_smoke.py`.

`npm run build` uses Vite's `beta` mode and rejects a localhost API origin.
Set the actual public deployment configuration before building. Browser tests use
a separate verification bundle that permits a loopback fixture; that bundle is
not a deployment artifact. The locally verified beta bundle uses synthetic HTTPS
configuration and must also be rebuilt with the actual deployment values.

## 1. Provision production dependencies

Create:

1. A hosted PostgreSQL database.
2. A Supabase project with email/password authentication enabled.
3. A container-capable web service for `backend/Dockerfile`.

The backend service must provide persistent environment variables:

~~~dotenv
ENVIRONMENT=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
SUPABASE_JWT_AUDIENCE=authenticated
CORS_ORIGINS=https://YOUR_FRONTEND_DOMAIN
GROQ_API_KEY=YOUR_SERVER_ONLY_KEY
GROQ_MODEL=openai/gpt-oss-20b
AI_DAILY_ANALYSIS_LIMIT=5
MAX_REQUEST_BYTES=12582912
ENABLE_API_DOCS=false
WEB_CONCURRENCY=1
~~~

`CORS_ORIGINS` is a comma-separated list of exact HTTPS origins without paths
or wildcards. Never put a Supabase secret/service-role key in the frontend.
`GROQ_API_KEY` is optional; without it, SkillSync uses its documented local
rule-based fallback.

Build the backend with the repository root as context:

~~~powershell
docker build -f backend/Dockerfile -t skillsync-api .
docker run --env-file ./backend/.env -p 8000:8000 skillsync-api
~~~

The container applies Alembic migrations before starting the API. Configure the
platform health check as `GET /health/ready` so an API with an unavailable
database does not become healthy. `GET /health` is a process-only liveness check.

### Private application tables

The browser uses Supabase Auth and sends bearer tokens to FastAPI. It must not
read or write career data directly through Supabase's Data API. Migration
`20261021_07` enables RLS on all 19 private app tables plus Alembic's revision
table and revokes table, column,
and owned-sequence privileges from `PUBLIC`, `anon`, and `authenticated`.
The migration role's defaults for future tables/sequences in `public` are also
restricted. Existing tables outside the app and defaults in schemas such as
`storage` are unchanged.

Run migrations using the backend's trusted database role, which must retain
table-owner or BYPASSRLS access and CRUD permissions. Do not use an anonymous or
ordinary authenticated API role as `DATABASE_URL`. A separate restricted backend
role requires an explicit migration/access design; the migration fails before
silently breaking backend access. Global public default grants also require
owner review because schema-specific revokes cannot override them.

After applying migrations, verify with read-only metadata and zero-row reads:

~~~powershell
cd backend
python scripts/verify_database_security.py
~~~

The command exits nonzero if an app table is missing, RLS is off, public roles
retain effective table/column/sequence access, unsafe defaults remain, or the
backend would lose access. Also check that an anonymous Supabase REST request to
`/rest/v1/resumes?select=id&limit=0` is denied. Public passport sharing continues
through FastAPI's token-scoped endpoint, not direct table grants.

The security migration is transactional. Its downgrade deliberately preserves
containment; rolling back application code must not restore exposed grants.
Snapshot permission metadata before production changes and retain it privately.
Candidate rows are not changed by this migration.

### Bounded resume parsing

PDF/DOCX extraction runs in a separate process, called from a request worker
thread so it cannot block the API event loop. Each API process admits one parse
at a time; additional uploads receive 429 with `Retry-After: 2`.

Defaults are an eight-second wall deadline, 256 MB worker memory, 50 PDF pages,
200,000 extracted characters, 256 DOCX archive entries, 25 MB total expanded
archive data, and a maximum per-entry compression ratio of 200. The existing
10 MB upload limit still applies. Documents travel through bounded pipes; the
parser does not save original files or extracted text to disk or inherit
database/AI credentials. Library error logs are discarded rather than exposing
document fragments.

Linux enforces address-space and CPU limits; Windows uses a Job Object with
process memory/CPU limits. Deadlines and oversized output kill and reap the
worker. This is resource isolation, not a general filesystem/network sandbox.
Other operating systems fail closed until an enforceable memory limit is
implemented. Parser setup failure returns 503; malformed/encrypted documents
and timeouts return 422; resource/expansion/page/text limits return 413.

`RESUME_PARSE_TIMEOUT_SECONDS` may be set from 1 to 15 (default 8), and
`RESUME_PARSE_MEMORY_MB` from 128 to 512 (default 256). Invalid configuration
fails startup. Size/page/archive limits remain fixed server-side safeguards.
Keep `WEB_CONCURRENCY` and the parser memory allowance within the hosting plan's
memory budget: the parser allowance is additional to each API worker's memory.
No database writes for a new workspace occur until parsing succeeds.

After deploying the patched image, verify normal PDF/DOCX uploads and rejection
of invalid documents in staging. The Windows and Linux parser tests exercise
actual child termination, memory enforcement, bounded output, and API health
responsiveness. Dependency audits run in CI; deploy both the rebuilt API image
and rebuilt frontend to activate package updates in the hosted application.

PostgreSQL permission tests run in CI against a disposable database. To run them
locally, explicitly set `SECURITY_TEST_DATABASE_URL` to a disposable PostgreSQL
instance, then run `pytest tests/test_database_security.py -q`. Never use the
production database as that test target.

### Durable AI analysis runs (phase 3)

Revision `20261021_08` adds `ai_usage_accounts`, `analysis_runs`, and `ai_usage`,
plus source hashes on learning plans, resume versions, and application packages.
The three new tables receive RLS and public-role grant revocation in their
creation transaction. SQLite is supported for development; production accounting
uses PostgreSQL row locks across API processes.

Pause new analysis traffic and drain old API handlers before applying this
revision and starting the new API build. Old handlers use the former row-count
quota mechanism and must not overlap with the new accounting path. Apply
`alembic upgrade head`, restart every API worker with this code, then publish
the matching frontend. The Docker entrypoint already upgrades before starting
Uvicorn. Do not start traffic if migration or resource validation fails.

`AI_DAILY_ANALYSIS_LIMIT` bounds external **resume-analysis attempts** per user
over a rolling 24 hours. Reservations are committed before dispatch; dispatched
attempts count even on provider failure, timeout, or interrupted result saving.
Cache hits, consent-off comparisons, and an unconfigured provider do not spend
allowance. A dispatch recorded just before a process crash is conservatively
counted even if the network request did not leave the process. Existing known
Groq completions are backfilled; overwritten attempts predating this ledger
cannot be reconstructed. Interview coaching retains its separate practice limit.

Budgets are 20 seconds for provider connection/headers/body, 25 seconds for the
analysis handler including database stages, and the existing 30 seconds for each
browser request. Database stages use independent sessions with short lock/query
timeouts and never hold a transaction during provider I/O. A late database stage
can safely settle after a 503; it cannot initiate a later provider call. Poll
the existing explainable GET endpoint to discover its status before retrying.
An active run returns `status: processing`, a stable run ID, and a retry delay.
The page uses GET polling with backoff for at most 45 seconds and never resends
a run automatically because another request is processing or failed.

Runs have a 40-second lease. A subsequent status/run request expires an
interrupted lease, releases only undispatched usage, and requires an explicit
retry. A late result cannot replace current analysis after inputs change or its
lease expires. These are handler budgets: authentication, network transit, or a
[free Render service waking from idle](https://render.com/docs/troubleshooting-deploys)
can still cause the browser to time out before reaching the handler. Reload
status rather than increasing budgets or automatically resubmitting work.

Derived-material source hashes include both the analysis inputs and result
content, so a changed result on a same-input rerun also marks older drafts/plans.
Existing results lacking the new input fingerprint become stale. Refresh them
explicitly. Saved plans, resume edits, package text, completed evidence, and
in-progress learning notes are preserved; derived views display an older-analysis
notice until deliberately regenerated/recalculated. Regenerating a package is
an explicit replacement action, while New version keeps earlier resume versions.

Before promotion, verify concurrent same-analysis requests share one run;
with allowance 1, concurrent/forced requests make at most one provider attempt;
job edits invalidate results; slow/stalled providers settle safely; and public
roles cannot access all 23 protected tables (22 app tables plus Alembic).
Keep the ledger schema on application rollback. Its downgrade intentionally
refuses to discard usage history. Do not restore the old quota implementation
with external AI enabled; disable the provider until a ledger-aware API is ready.

### Factual analysis views and atomic uploads (phase 4)

Deploy the matching API and frontend together after phase 3's migration
`20261021_08`. Phase 4 adds no database migration. Its response metadata includes
`projection_version=evidence-views-v1`; the score formula remains
`weighted-match-v1`.

Current scores are recomputed from grounded explainable evidence. Older sample
JSON is retained for historical export but is no longer used in application
views. Records without a valid current result show pending, stale, legacy or
unavailable notices and require analysis before producing new material. No
background rewrite or bulk external AI call is needed.

DOCX extraction reads paragraphs, nested/merged table cells, and unique headers
and footers within the existing parser limits. It does not perform OCR or read
embedded attachments. Saved-job edits submitted with a resume upload now save
in the same transaction as the resume and analysis; remove any clients that
still issue a separate pre-upload update.

After deployment, check a genuine zero match, a pending upload, a legacy saved
record, a table-only DOCX and a failed saved-job upload. Confirm the original job
is unchanged after failure. See `qa/FLOW_FIX_04.md` for local evidence. Hosted
activation and real-account/provider checks remain outstanding.

### Bounded lists, schema parity and accessibility (phase 5)

Apply revision `20261021_09` before deploying the matching API and frontend.
It adds four owned-list/lookup indexes, removes only specifically named
redundant non-unique `id` indexes from older metadata-created schemas, and
preserves primary keys, uniqueness constraints, private-table permissions and
data. Index creation can briefly block writes; schedule the migration for the
application's normal maintenance window. Then run `alembic check` to confirm
metadata parity. Both fresh and existing-data upgrades are tested on SQLite
and PostgreSQL.

`GET /workspaces`, `/resume/all` and `/career/workspaces` retain list-shaped
responses but now return at most 50 rows by default, with `limit=1..100` and an
optional positive `before_id`. Newest IDs appear first; `X-Next-Cursor` contains
the next `before_id` or is empty. This header is exposed through CORS. Cursors
seek older IDs so a newly created row does not shift later pages. Reload to see
new rows; edits do not reorder existing rows.

Workspace list descriptions are 240-character previews. `resumes` contains
only the latest resume metadata and `resume_count` contains the actual count.
Use `GET /workspaces/{id}` for the complete description and resume metadata.
Update external consumers to follow cursors rather than treating the first
page as the entire account. Privacy export still includes all owned records.
Dashboard totals cover all current analyses; its chart shows the most recent
50 scored results, and history loads five entries per user action.

Verify a second page, a link to a job outside the initial page, complete privacy
export, visible keyboard focus, Escape on the mobile menu, a single main
landmark and both themes after deployment. See `qa/PERF_UI_FIX_05.md` for local
evidence and the limits of the accessibility review.

## 2. Deploy the frontend to Vercel

Import the repository root into Vercel. The checked-in `vercel.json` installs
with `npm ci`, builds `frontend/`, adds SPA deep-link rewrites, immutable asset
caching, and baseline browser security headers.

Set these Vercel environment variables for Production and Preview as needed:

~~~dotenv
VITE_API_BASE_URL=https://YOUR_API_DOMAIN
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
~~~

The production build fails early when any public URL/key is missing, malformed,
or unsafe. `VITE_API_BASE_URL` must be an origin only, with no `/api` path.

After Vercel assigns the final domain, update the backend `CORS_ORIGINS` and
restart it.

## 3. Configure Supabase redirects

In Supabase Authentication → URL Configuration:

1. Set **Site URL** to the production frontend origin.
2. Allow `https://YOUR_FRONTEND_DOMAIN/login`.
3. Allow `https://YOUR_FRONTEND_DOMAIN/reset-password`.
4. Add the corresponding Vercel preview URLs only if preview authentication is
   intentionally supported.

Confirm the email provider, confirmation policy, and recovery-email delivery
with a non-admin test account.

## 4. Release verification

Before promoting a deployment:

~~~powershell
cd frontend
npm ci
npm run typecheck
npm run lint
npm test
npm run build

cd ../backend
python -m pip install --require-hashes -r requirements.lock
python -m pytest -q
python -m compileall -q app
~~~

Then verify the deployed system:

1. `/health` and `/health/ready` return `200`.
2. A direct visit to `/login`, `/dashboard`, and `/reset-password` loads the
   React app instead of a 404.
3. Signup confirmation, sign-in, password recovery, and logout work.
4. An authenticated resume upload, analysis, and data export complete.
5. An untrusted origin receives no CORS permission.
6. Production API docs return 404 unless `ENABLE_API_DOCS=true` was explicitly
   chosen.

GitHub Actions runs the repeatable frontend and backend checks for pushes and
pull requests. Hosted Supabase permissions, RLS policies, email delivery, and
real production secrets still require environment-specific review.
