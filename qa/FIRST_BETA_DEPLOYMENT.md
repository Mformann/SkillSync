# First beta deployment

Prepared 22 October 2026. The requested scope is preparation for first deployment.
No beta has been deployed by this task. All changes remain in the working tree;
review and publish the candidate through the project's normal release process.

## Before deploying

1. Review [BETA_RELEASE_READINESS.md](BETA_RELEASE_READINESS.md), the source manifest
   and the changes. Commit/push the complete candidate so the six CI jobs can run.
   Local checks have passed; a remote GitHub CI run is not claimed.
2. Choose the beta API and frontend HTTPS origins and a dedicated Supabase beta
   project/database, or explicitly confirm the existing database is the intended
   target. Obtain a recoverable backup through the hosting provider. Keep secrets
   in the provider's environment configuration, outside Git and reports.
3. Use the exact server variables in [DEPLOYMENT.md](../DEPLOYMENT.md). Set
   `ENVIRONMENT=production`, a persistent PostgreSQL `DATABASE_URL`, the intended
   `SUPABASE_URL`, publishable key and audience, exact frontend `CORS_ORIGINS`,
   docs disabled, and one API worker initially. Set the server-only Groq key if
   consent-on external analysis is part of the beta. Parser limits stay enabled.
4. In Supabase configure the beta site URL and exact confirmation/recovery redirect
   URLs used by the app. Use the dedicated test accounts for subsequent checks.
   Verify email sending and confirmation requirements in the project settings.

## Deploy and verify the API

Build from the repository root using the checked-in Render configuration or:

```powershell
docker build -f backend/Dockerfile -t skillsync-api .
```

Use hosting environment variables when starting the image. Its non-root
entrypoint validates configuration, applies migrations and starts the API.
The first application request must not race schema creation. The expected head
is `20261021_09`. The configured existing database was read-only checked at
`20261021_07`; revisions **08 and 09 are pending there**. They are verified in
disposable PostgreSQL, not applied to the hosted database during this task.

If an older API is running, pause analysis traffic and drain its handlers before
migrating: the previous quota implementation must not overlap the ledger-aware
implementation. Do not run concurrent migration/startup deployments. Confirm the
provider backup and schedule the migration during deployment. If no API exists,
the entrypoint can apply the full migration chain to the chosen database.

After startup:

1. Confirm `/health` and `/health/ready` return 200 over HTTPS.
2. From the trusted backend runtime, run `python scripts/verify_database_security.py`.
   It must report `secure: true`, 22 private app tables, 23 protected tables and
   head `20261021_09`. Do not grant direct browser access to fix a failed check.
3. Verify anonymous Supabase REST access to
   `/rest/v1/resumes?select=id&limit=0` is denied without fetching candidate rows.
4. Confirm `/docs` and `/openapi.json` return 404 and anonymous `/workspaces` returns 401.

## Deploy the frontend

Import the repository root into Vercel using `vercel.json`. Set its public build
variables to the actual values:

- `VITE_API_BASE_URL`: the deployed API HTTPS origin, without a path.
- `VITE_SUPABASE_URL`: the intended Supabase project's HTTPS origin.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: its publishable key, or the supported public anon key.

The server's Groq key, database credentials and Supabase service-role key must
never be frontend variables. The strict beta build rejects a localhost API.
Use `npm ci` and `npm run build`; rebuild whenever these public values change.
Do not upload `.verification-dist` or the locally built synthetic-config bundle.
Check SPA deep links, security headers and the API's exact CORS allowlist.

## First hosted acceptance, before inviting testers

Set `BETA_API_URL` and `BETA_FRONTEND_URL` in the local process environment. Sign
in using the dedicated test account and supply its short-lived real access token
as `BETA_TEST_ACCESS_TOKEN` through a private environment value, not a command
argument or committed file. From the repository root run:

```powershell
backend/.venv/Scripts/python.exe qa/hosted_smoke.py
```

This is read-only and writes a redacted report. It checks health, readiness,
disabled docs, anonymous denial, actual bearer-token acceptance, CORS, frontend
deep links and security headers. A missing token cannot produce a complete pass.
It does not create users, send emails, refresh tokens or delete app data.

Record these manual results separately using synthetic documents and **two
dedicated accounts**, never real candidate data:

| Check | Required result |
| --- | --- |
| Signup and confirmation | Email arrives; intended redirect succeeds; confirmation requirement is enforced |
| Login, reload, refresh, logout | Protected API works; session refresh succeeds; logout returns to sign-in; private requests fail afterwards |
| Password recovery | Email arrives; recovery route accepts a valid link; expired/reused links fail safely |
| Candidate journey | PDF and DOCX upload; consent-off comparison; consent-on Groq; cache reuse; explicit refresh; allowance exhaustion |
| Owned work | Plan progress/evidence persists; tailored edit survives reload and refresh; DOCX and Print/PDF are readable |
| Privacy and sharing | Account B cannot read account A's IDs; exports are complete; share exposes only chosen evidence; revoke removes access; delete removes only the synthetic owner's data |
| Database boundaries | Private Data API reads/writes denied for public roles; trusted API remains functional |
| Keyboard and audible reader | Navigation, labels, page headings, errors, dialogs and file chooser are understandable in Narrator or NVDA |
| Hosting behavior | Record idle cold start separately, then warm request latency, errors and resource usage on the actual hosting tier |

For an initial small beta, use the preselected warm baseline target of zero
unexpected errors and p95 under 1.5 seconds for 120 owned-list/dashboard reads,
four concurrent clients, and roughly 200 jobs/400 resumes. Record provider time
separately with its 20-second attempt budget. The local container met that target;
it is not a claim about hosted capacity. Measure the chosen tier before expanding
access. An idle free hosting tier may need a different cold-start target or an
always-on tier; record that decision explicitly after measurement.

Open beta access only after hosted checks pass and the operator records the
manual acceptance results. Email delivery, redirect settings and provider-level
capacity cannot be certified from the local workspace.

## Recovery

If acceptance fails, stop invitations and roll back application traffic to a
compatible build while retaining private-table restrictions and the durable
usage ledger. Do not downgrade revision 08 to erase usage or restore old public
grants. Disable external AI if temporarily serving an older quota implementation.
Preserve committed user data; use the provider backup/recovery procedure only
after evaluating the failure and obtaining approval for any destructive restore.
