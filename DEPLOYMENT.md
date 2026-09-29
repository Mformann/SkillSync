# SkillSync deployment

SkillSync deploys as two services:

- `frontend/`: a static React application, configured for Vercel by
  `vercel.json`.
- `backend/`: a FastAPI container with PostgreSQL and Alembic migrations.

Deploy the API first because its HTTPS origin is required by the frontend build.

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
docker build -t skillsync-api ./backend
docker run --env-file ./backend/.env -p 8000:8000 skillsync-api
~~~

The container applies Alembic migrations before starting the API. Configure the
platform health check as `GET /health`; `GET /health/ready` additionally checks
database connectivity.

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
python -m pip install -r requirements.txt
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
