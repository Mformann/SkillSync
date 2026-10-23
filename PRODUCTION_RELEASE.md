# Free production release

Prepared 23 October 2026. SkillSync remains free: no checkout, subscription
activation, paid feature gates or automatic charges. Pro features and commercial
limits remain a future discussion. Existing safety limits (including external
analysis attempts per rolling day) remain enabled to protect service resources.
The Groq provider, server-side API key and configured model stay in place.

## Hosting configuration

Deploy the repository root to Render using `render.yaml`. The Docker runtime
installs the hashed backend lockfile, runs as an unprivileged user, validates
configuration, applies Alembic migrations and starts the API on Render's `PORT`.
Begin with one worker. The health check is `/health/ready`; `/health` checks
only that the process is responding. See [Render's FastAPI documentation](https://render.com/docs/deploy-fastapi).

Use the same Supabase project for PostgreSQL and Auth. For a persistent backend,
prefer the session pooler connection from the Supabase Connect panel (port 5432)
when a direct connection is unavailable over IPv4. Add `sslmode=require` to the
database URL; URL-encode special characters in the password. Do not use a
Supabase HTTP API URL or publishable key as a database connection string.
The backend disables prepared statement caching for compatibility with transaction
pooling, bounds its connection pool and waits, and recycles stale connections.
Use a session/direct connection for migrations. See [Supabase connection options](https://supabase.com/docs/guides/database/connecting-to-postgres).

Configure these **server-only Render variables**:

| Variable | Value |
| --- | --- |
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | Supabase PostgreSQL session/direct URL with `sslmode=require` |
| `SUPABASE_URL` | The project's HTTPS origin |
| `SUPABASE_PUBLISHABLE_KEY` | Public publishable key (legacy public anon key is also supported) |
| `SUPABASE_JWT_AUDIENCE` | `authenticated` |
| `CORS_ORIGINS` | Exact Vercel/custom frontend HTTPS origin; comma-separated if necessary |
| `GROQ_API_KEY` | Existing server-side provider key |
| `GROQ_MODEL` | Existing model, currently `openai/gpt-oss-20b` |
| `AI_DAILY_ANALYSIS_LIMIT` | `5` external attempts per user over 24 hours |
| `MAX_REQUEST_BYTES` | `12582912` |
| `ENABLE_API_DOCS` | `false` |
| `WEB_CONCURRENCY` | `1` |
| `RESUME_PARSE_TIMEOUT_SECONDS` | `8` |
| `RESUME_PARSE_MEMORY_MB` | `256` |

Create the Vercel project from the **repository root**, using `vercel.json`.
It installs/builds `frontend/`, publishes `frontend/dist` and rewrites browser
routes to the application. See [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
Set only these public build variables:

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | Deployed Render HTTPS origin, without a path |
| `VITE_SUPABASE_URL` | Same Supabase project's HTTPS origin |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public publishable key |

Never put database credentials, the Groq key or a Supabase secret/service-role
key in `VITE_*`. The deployment build rejects local API/Supabase origins and
secret Supabase keys. Rebuild when public configuration changes. Local bundles
in `.production-dist` or `.verification-dist` use test configuration and must
not be published.

In Supabase Auth, enable the intended email/password policy. Set Site URL to the
frontend origin and allow the exact `/login` and `/reset-password` redirect URLs.
Configure production email delivery and verify confirmation/recovery emails using
dedicated test accounts. Restrict preview redirects to previews intentionally
supported. Update Render's CORS allowlist after assigning the final Vercel domain.
For public signup, require email confirmation and review Supabase's Auth rate
limits. Keep anonymous sign-ins disabled unless they are deliberately supported.

## Data and release safety

Before the first production migration, take a recoverable Supabase backup and
confirm the intended target database. If an older API is live, drain its analysis
requests before migrations/startup; old and new quota code must not overlap.
The expected schema head remains `20261021_09`. No new migration is required by
this production preparation. All app data is accessed through authenticated
FastAPI routes; the browser uses Supabase directly only for Auth.

After startup, run `python scripts/verify_database_security.py` from the trusted
backend runtime. Require `secure: true`, 22 private application tables, 23
protected tables and the expected revision. Never loosen public grants or RLS
to resolve a backend connectivity failure. Apply migrations with the intended
trusted database role. Keep usage history and private grants on rollback.

The release adds a browser crash-recovery page, no-store API responses,
sanitized API errors with request IDs, a total upload-body deadline, CORS on
rejected/error responses, bounded PostgreSQL connection waits and a restrictive
object/frame/form policy. These reduce common failures; testing does not prove
the application is error-free.

Vercel uploads explicitly exclude local environment files, backend source, QA
databases/reports and verification bundles. Keep production secrets in provider
settings and commit only the reviewed source/configuration changes.

## Required verification

Run frontend typecheck, lint, tests, dependency audit and `npm run build` with
the actual public deployment values. Run the full backend tests, locked dependency
audit and compile check. CI additionally exercises PostgreSQL permissions and
migrations, browser journeys and the production Linux container. Dependency
scanners are tooling only; do not add them to the application lockfile.

After deployment, run the existing `qa/hosted_smoke.py` with private process
environment values `BETA_API_URL`, `BETA_FRONTEND_URL` and a short-lived dedicated
test-account `BETA_TEST_ACCESS_TOKEN`. It performs read-only checks and must pass.
Do not paste access tokens into commands, reports or Git.

Before opening public access, verify with synthetic documents and two accounts:

- Signup/confirmation, login/reload, session refresh, recovery, expired links and logout.
- PDF/DOCX upload, consent-off analysis, consent-on Groq, safe provider failure,
  cache reuse and explicit retries without duplicate attempts.
- Cross-account access denial, saved edits/progress, exports and readable downloads.
- Public sharing/revocation and deletion of only the intended synthetic account's data.
- Frontend deep links, exact CORS, disabled API docs, readiness and security headers.
- Real hosting cold starts and warm latency/resource usage before inviting users.

Hosted configuration, email delivery, real identities and provider behavior
must be checked on the final deployment. Local reports cannot certify those.
