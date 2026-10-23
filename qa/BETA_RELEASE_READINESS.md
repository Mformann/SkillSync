# Beta release candidate: remediation complete locally

Prepared 22 October 2026. The user selected **prepare for first deployment**.
Phases 1–6 are implemented and locally verified. The candidate is ready to review
and deploy to a controlled beta environment. It has not been deployed, and hosted
acceptance must pass before inviting testers. No hosted migration or account
creation was performed as part of Phase 6.

## Phase 6 changes

- Fixed the stale planner date fixture without weakening deadline/capacity checks.
  Token validity dates are also calculated at execution time, avoiding failures
  when a long-running suite crosses a fixture's collection-time deadline.
- Fixed bearer-route enumeration: only explicit public health/readiness endpoints
  and the capability passport read are exempt. Every other declared operation is
  checked for security metadata and actually requested anonymously to require 401.
- Promoted all ten original QA probes into `backend/tests/test_qa_regressions.py`.
  The original QA entry remains available. Normal tests explicitly isolate their
  configuration from developer credentials and hosted databases.
- Added a fully pinned, hashed backend lockfile used by Docker and CI. Fresh
  frontend and exact-lock backend audits report zero known vulnerabilities.
- Made the production entrypoint reusable and verified it as the non-root image
  user. Added portable browser and production-container CI jobs; the workflow now
  has six jobs, including PostgreSQL security/migrations and Windows parser tests.
- Added strict beta build validation: deployment builds reject localhost API
  origins. Local browser fixtures use a separate verification build. Corrected
  the deployment guide's Docker build context and preserved LF shell scripts.
- Added opt-in read-only hosted smoke checks, a machine-readable evidence gate,
  source/evidence checksums and a first-deployment checklist.

## Verification

| Area | Recorded result |
| --- | --- |
| Windows backend, including disposable PostgreSQL | 302 passed; one SQLite-only RLS case intentionally skipped |
| Linux production-image backend, including PostgreSQL | 302 passed; the same SQLite-only RLS case skipped |
| Frontend regression tests | 128 passed across nine files |
| Frontend typecheck, lint and strict beta build | Passed using synthetic public HTTPS configuration |
| Public browser tests | Six passed, including simulated login/reload/logout and responsive auth/legal pages |
| Signed-in browser sweep | 102 route/theme/viewport cases; no overflow, runtime/API errors, unlabeled controls or undersized tested buttons |
| Accessibility automation | 5,460 HTML text contrast checks; one DOM and accessibility-tree main landmark per page; keyboard smoke passed in both themes |
| Candidate browser journey | Upload/table extraction, roadmap, edit/save/reload, DOCX export, actual A4 print, explicit refresh, preserved edits and accurate zero/pending states passed |
| Duplicate analysis prevention | Exactly one initial run POST and one additional deliberate refresh in the browser journey |
| Dependency audits | No known vulnerabilities in frontend audit or 38 locked backend packages |
| Database migration and permissions | Revision 09, no metadata drift, 22 private app tables and 23 protected tables verified in disposable PostgreSQL |
| Configured services | Read-only PostgreSQL connectivity, Supabase Auth health and anonymous REST denial passed; one synthetic Groq analysis passed in 4.36 seconds |
| Printed resume | One A4 page; name/email/evidence checked in extracted text and rendered image; no clipping, overlap or extra page |

The final production-container smoke used the actual validation/migration/startup
entrypoint, real ES256 signatures fetched from a temporary HTTPS JWKS fixture,
and PostgreSQL, without authentication dependency overrides. Missing/tampered
tokens, disabled docs, untrusted origins, oversized requests and cross-user IDs
were rejected. Bounded DOCX parsing, cached analysis, persisted resume editing,
readable DOCX export, complete privacy export/deletion and private-role auditing
passed.

The declared local performance gate was zero errors and p95 below 1,500 ms for
120 list/dashboard reads at concurrency four with 201 jobs and 401 resumes.
The final run recorded p50 **57.83 ms**, p95 **698.65 ms**, **zero errors**, about
**215 MiB** API RSS, and **64.64%** average use of the container's two allocated
CPU cores during a 5.81-second read sample. Limits were 512 MiB and two CPUs.
Startup/readiness took **5.93 seconds**. Provider calls were disabled during the
load sample and measured separately in the synthetic live preflight. These are
local measurements, not hosted capacity or a sustained-load certification.

An earlier attempt was interrupted when Windows suspended network activity.
It produced browser network-suspended failures and expired collection-time JWT
fixtures/analysis leases. The final clean runs supersede that interrupted run;
no application auth or timeout checks were relaxed. Framework deprecation
warnings remain informational. The intentional skip exercises PostgreSQL roles
against a SQLite fixture; corresponding PostgreSQL cases pass.

## Original finding closure

| Findings | Repair and evidence |
| --- | --- |
| SEC-01: public private-table exposure | [Phase 1](SECURITY_FIX_01.md); migration 07 already hosted, migrations 08/09 verified locally with private new tables |
| SEC-02: malformed token errors | [Phase 2](SECURITY_FIX_02.md); malformed/deep token cases, signature/claim tests and actual anonymous route enumeration pass |
| SEC-03 and dependency findings | [Phase 2](SECURITY_FIX_02.md); resource-isolated parser, patched dependencies and fresh Phase 6 exact-lock audits |
| AI-01 / AI-03: quota and duplicate runs | [Phase 3](AI_FIX_03.md); durable reservations, multi-worker PostgreSQL tests and one-initial-POST browser trace |
| AI-02: stale cached inputs | [Phase 3](AI_FIX_03.md); processing-input invalidation and preserved/stale derived artifacts verified |
| PERF-02: conflicting time budgets | [Phase 3](AI_FIX_03.md); aligned provider/handler/request/poll limits and timeout regressions |
| FLOW-01 / FLOW-02: zero, generic gaps and invented metrics | [Phase 4](FLOW_FIX_04.md); factual projections and zero/pending/current-input browser checks |
| FLOW-03: DOCX tables | [Phase 4](FLOW_FIX_04.md); ordered nested/merged table/header/footer tests and table-only browser upload |
| FLOW-04 / FLOW-05: null/length mismatch and partial edits | [Phase 4](FLOW_FIX_04.md); shared JSON/multipart validation and atomic rollback cases on both databases |
| PERF-01 / DB-01: list queries and schema drift | [Phase 5](PERF_UI_FIX_05.md); three-query summaries, stable cursors, migration parity and local production read baseline |
| UI-01 / UI-02: targets and landmarks | [Phase 5](PERF_UI_FIX_05.md); 102-case viewport/landmark/target sweep and both-theme keyboard checks |
| Existing planner/auth test failures and verification automation | Phase 6; repaired fixtures, ten promoted probes, six CI jobs, production-container and release evidence gates |

## Deployment status and acceptance boundary

The existing configured database was read-only rechecked at `20261021_07`.
Its existing private tables remain protected; it still needs revisions **08 and
09**, followed by the matching API/frontend deployment. Newly added model columns
are expected to be absent until that deployment. Local migration success does not
mean those hosted changes have happened.

The GitHub workflow has been parsed and its checks exercised locally. Its remote
run awaits review/commit/push. The built frontend uses synthetic deployment
configuration; rebuild with the actual API and public Supabase values. Do not
publish the local verification bundle.

Follow [FIRST_BETA_DEPLOYMENT.md](FIRST_BETA_DEPLOYMENT.md). Remaining hosted
acceptance covers actual signup/confirmation and password-reset email, issued
session refresh/logout, intended redirect allowlists, two real test accounts,
consent-on AI and quota behavior, deployed private-role checks, actual host
cold-start/load behavior and audible Narrator/NVDA review. These cannot be claimed
before a beta host and dedicated accounts exist. Automated accessibility results
are not an audible screen-reader or full WCAG certification.

## Evidence and repeatability

- [Machine-readable summary](phase-06-verification-summary.json)
- [Source and evidence checksums](beta-release-manifest.json)
- [Production-container lifecycle/load](phase-06-production-smoke.json)
- [Signed-in pages](phase-06-browser-results.json), [candidate journey](phase-06-browser-flow.json), [public browser tests](phase-06-public-browser-tests.json)
- [Windows backend](phase-06-backend-tests.xml), [Linux backend](phase-06-linux-tests.xml), [frontend tests](phase-06-frontend-tests.xml)
- [Backend audit](phase-06-backend-dependency-audit.json), [frontend audit](phase-06-frontend-dependency-audit.json), [configured-credential scan](phase-06-secret-scan.json)
- [Read-only service preflight](phase-06-service-preflight.json), [printed synthetic resume](phase-06-resume-print.pdf)

Run `backend/.venv/Scripts/python.exe qa/release_gate.py` from the repository root
to validate the recorded evidence and regenerate the summary/manifest. Run the
suites in `.github/workflows/ci.yml` to refresh the evidence after source changes.
The gate labels hosted acceptance as pending and never opens beta access itself.
