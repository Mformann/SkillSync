# SkillSync: four-part QA report

**Status update — 21 October 2026:** SEC-01 has been fixed in the configured
database using migration `20261021_07`. All 19 private app tables and the migration
revision table now deny anonymous REST access. See [the containment results](SECURITY_FIX_01.md).
SEC-02/SEC-03 and dependency repairs are now implemented and verified locally,
including Windows/Linux parser tests and clean scans of the frontend, backend,
and Linux production image. Hosted activation requires API/frontend redeployment;
see [the phase 2 results](SECURITY_FIX_02.md). AI-01, AI-02, AI-03, and PERF-02
are implemented and locally verified in phase 3: durable usage/run accounting,
current-input cache checks, one browser run per upload, and bounded requests.
Hosted activation requires migration `20261021_08` and API/frontend deployment;
see [the phase 3 results](AI_FIX_03.md). Other findings remain open.
The dated audit below is retained as the original evidence.

Reviewed 19 October 2026. **Release recommendation: BLOCKED.** The configured Supabase database exposes private application tables to public roles. Correct this before accepting real candidate data.

This was a testing and review task. Application source and hosted configuration were not repaired. The `qa` folder contains reproducible probes and evidence; its regression tests intentionally fail where the current application is defective.

## Results at a glance

| Check | Result |
| --- | --- |
| Frontend type checking, lint, production build | Passed |
| Existing frontend unit tests | 92 passed, 1 failed |
| Existing backend tests | 106 passed, 1 failed |
| Existing Edge browser tests | 6 passed |
| Direct browser candidate journey | Passed: upload, analysis, roadmap, editing, DOCX download, reload persistence; duplicate analysis-call finding |
| Added API regression probes | 1 passed, 9 failed, reproducing nine defects |
| Signed-in production UI sweep | 68 page/theme/viewport checks; no horizontal overflow, runtime exceptions, server errors, or unlabeled visible form controls; accessibility findings below |
| PostgreSQL connectivity and model columns | Passed; database migration head `deaf9f5a764b`, no missing model columns |
| Supabase Auth health | HTTP 200 |
| Live Groq analysis | Passed with synthetic documents; approximately 1.05 seconds |
| Public database access | FAILED: 13 private tables have RLS off and public read/write grants |
| Frontend dependency audit | 2 affected packages: 1 high and 1 low severity |
| Backend installed-package audit | 10 advisories across 2 affected packages |
| Fresh migration chain | Upgrade succeeded; schema drift check failed on 13 redundant primary-key index declarations |

The UI sweep covers 17 signed-in routes, both themes, and 375×812 / 1440×900 viewports. Existing browser tests also cover public/authentication pages at 812×375 landscape. A final direct browser journey is recorded separately in `browser-flow-results.json`.

## 1. User flow

### What passed

- Simulated sign-in, protected-route redirect, session persistence after reload, and sign-out in Edge.
- Signup, password visibility controls, forgotten-password navigation, and invalid recovery-link feedback in the existing frontend/browser tests.
- A complete isolated API journey: DOCX upload → consent-off analysis → persistent roadmap → tailored resume → valid DOCX download → personal-data export → deletion.
- A second synthetic user could not retrieve the first user's workspace, analysis, roadmap, resume export, or exported resume data through FastAPI.
- Existing tests cover career assessments, planning, contacts/reminders, job import boundaries, interview feedback, expiring/revocable passports, and application-package grounding.

### Confirmed defects

| ID / priority | Reproduction and actual result | Expected behavior / repair direction |
| --- | --- | --- |
| FLOW-01 / High | Analyze a resume with no Kubernetes/Docker match. Explainable analysis returns **0**, but `/resume/all` returns **78**. | Preserve legitimate zero scores. Replace truthiness-based fallback at `backend/app/routers/resume.py:200` with an explicit missing-value check; avoid sample scores for pending analyses. |
| FLOW-02 / High | A Python/Docker target produces a gap report containing AWS, Azure, CI/CD, CSS, Cypress, and Django. Dashboard weekly goals use this same generic gap source. | Derive gaps, goals, role recommendations, and strength labels from the current target analysis. `backend/app/services/analysis_service.py:71` also assigns “Expert”, “3+” years, and a fixed role match without supporting evidence. |
| FLOW-03 / Medium | Put readable resume text in a DOCX table. Upload returns 422, “Very little readable text was found.” | Extract table cells in document order, including common nested/table layouts. Current parser reads only `document.paragraphs` at `backend/app/services/analysis_service.py:19`. |
| FLOW-04 / Medium | PATCH a workspace with `{"title":null}`. API returns HTTP 500. | Reject null for required fields with HTTP 422. `WorkspaceUpdate` accepts null and `update_workspace` assigns it to a non-null database column (`backend/app/routers/workspaces.py:24`, `:140`). Check description, archive, and consent fields as well. |
| FLOW-05 / Medium | Submit a 161-character job title through `/resume/upload`. It succeeds in SQLite despite the 160-character limit in workspace creation. | Apply the same title/company/description validation to multipart upload and JSON creation. PostgreSQL's length constraint can turn this into a database failure instead of a validation response. |

The exact failing assertions and responses are in `regression-results.xml`; reproduction code is in `test_qa_audit.py`.

## 2. Database, AI connectivity, and performance

### Connectivity and correctness

- Read-only PostgreSQL connection and `SELECT 1` succeeded. The configured database contains the latest migration head and every model column.
- Frontend and backend refer to the same Supabase project. No credential values are included in this report.
- Supabase Auth health returned 200. This establishes reachability, not real-account login or email delivery.
- One real Groq request with synthetic job/resume text returned two requirements and two matches in approximately 1.05 seconds. No real candidate data was sent.
- Consent-off behavior, missing-provider fallback, deterministic scoring, and removal of unsupported match quotations have existing automated coverage.
- Job matching feeds are not configured in the local environment; the application correctly presents that limitation rather than inventing jobs.

### Confirmed defects and risks

| ID / priority | Evidence | Expected behavior / repair direction |
| --- | --- | --- |
| AI-01 / High | With a daily limit of 1, forcing the same analysis twice invokes the mocked external provider twice. Setting the record to `processing` removes its previous completion from the quota query. | Record each AI invocation in a durable usage ledger and reserve allowance atomically before making the request. Current logic is at `backend/app/routers/resume.py:300`. Row counts cannot track repeated invocations safely. |
| AI-02 / Medium | Analyze a Python/Docker target, edit it to require Kubernetes, then call the normal run endpoint. It still returns Python/Docker requirements. | Compare current input hash before returning existing results and invalidate/recompute results after relevant workspace edits. The early return at `backend/app/routers/resume.py:260` bypasses the hash check. |
| AI-03 / High | One fresh upload triggered **two POST requests** to its analysis-run endpoint during the direct production-browser journey. Both returned 200; the fixture had external consent off. | Stabilize the analysis effect and prevent duplicate in-flight analysis jobs on the server. `setCurrentAnalysisId` changes the `runAnalysis` callback on initial load, retriggering the effect (`frontend/src/app/components/analysis-page.tsx:126`, `:140`). With AI enabled, overlapping requests can invoke the provider twice. Request traces and `analysisRunRequests: 2` are in `browser-flow-results.json`. |
| PERF-01 / Medium | Listing 20 workspaces executes **41 SELECT queries**, even without resumes. | Eager-load or aggregate related data and paginate lists. `serialize_workspace` lazily reads both relationships for each row (`backend/app/routers/workspaces.py:56`). This adds avoidable latency against remote PostgreSQL. |
| PERF-02 / Medium, configuration finding | Browser API timeout is **30 seconds**, but the Groq request timeout is **60 seconds**. | Align time budgets, or use a background job and polling. A slow AI response can complete after the browser reports failure. This path was identified in code, not reproduced by deliberately delaying the hosted provider. References: `frontend/src/lib/api.ts:9`, `backend/app/services/ai_analysis_service.py:183`. |
| DB-01 / Low, schema maintenance | All fresh SQLite migrations succeed, but `alembic check` proposes 13 `ix_*_id` indexes declared in models and absent in migrations. | Reconcile metadata and migrations. These columns are already primary keys, so do not assume adding duplicate indexes improves performance. |

### Performance sample

Against the isolated localhost API with one synthetic workspace, 60 read requests at concurrency 4 returned 200. The run completed in 0.917 seconds, approximately 65 requests/second. Per-route median response times ranged from 8 to 30 ms; observed route p95 values ranged from 23 to 78 ms. Cold outliers reached 601 ms.

This is a small functional timing sample using SQLite and stubbed identity, collected while browser QA was active. It is **not a production capacity, network-latency, PostgreSQL throughput, or AI-load benchmark**. Detailed observations are in `local-performance-results.json`. Database live-probe duration includes connection setup and metadata inspection; it must not be interpreted as `SELECT 1` latency.

## 3. UI

### What passed

- 68 signed-in checks rendered the production build across 17 routes in both themes and mobile/desktop sizes.
- No document-level horizontal overflow, browser exceptions, or API 5xx responses in the final sweep.
- No unlabeled visible input, select, or textarea controls under the audit's DOM checks.
- Existing browser tests passed for the landing page, legal pages, login/signup, password recovery, dark/light controls, and mobile landscape.
- Representative mobile dashboard, dark Resume Studio, and other page screenshots were captured for inspection. The results include populated analysis/roadmap/resume pages and empty states in newer career tools.

### Findings

| ID / priority | Evidence | Repair direction |
| --- | --- | --- |
| UI-01 / Low | Dashboard skill-filter buttons are 36 px high; dashboard logout is 38 px; analysis filters are 40 px. | Increase frequently used mobile targets to the project's 44 px interaction guideline. This is a usability recommendation, not a claim that every button fails WCAG's smaller minimum-target criterion. |
| UI-02 / Low | Dashboard and gap-report pages have no `<main>` or `role="main"` landmark. | Add one main landmark around page content to help assistive-technology navigation. References: `frontend/src/app/components/dashboard-page.tsx:288`, `gap-report-page.tsx:78`. |

Machine-readable page observations are in `browser-results.json`; screenshots are in `screenshots/`. The checks are not a complete screen-reader, keyboard-only, or automated contrast certification.

The direct browser journey additionally passed DOCX upload, automatic analysis, roadmap generation, editing and saving resume contact data, DOCX download, and persistence after reload. It used the actual API over loopback with stubbed identity and external consent off. The earlier proxy-based upload attempt was discarded because request interception omitted file bytes; that harness problem is not recorded as an application defect.

### Existing frontend test failure

`tests/career-growth.test.tsx:89` expects the planner to submit using a fixed deadline of **17 October 2026**. On the review date, the date input's minimum is **19 October 2026**, so browser validation correctly blocks submission. Use a controlled clock or relative future fixture. This is a time-dependent test failure, not evidence that the real planner cannot submit a valid future date.

## 4. Security

### SEC-01 / Critical — public read/write access to private database tables

Read-only PostgreSQL catalog inspection confirmed **RLS disabled** and **SELECT, INSERT, UPDATE, DELETE granted to `anon`** on:

`resumes`, `target_jobs`, `analyses`, `learning_plans`, `learning_tasks`, `resume_versions`, `interview_sessions`, `job_applications`, `portfolio_evidence`, `career_profiles`, `career_achievements`, `application_events`, `application_packages`.

The `authenticated` role also has SELECT privileges on these tables. A request to Supabase REST for `/resumes?select=id&limit=0` using only the frontend's public key returned **HTTP 200**. The request intentionally returned zero rows; no private record contents were retrieved, and no hosted write or delete was attempted. Write exposure is established from database permission metadata, not a destructive test.

**Impact:** callers can bypass FastAPI's ownership checks through the Data API. Confidentiality, integrity, and availability of candidate data are at risk. Six newer growth tables had RLS enabled and public SELECT revoked in the inspected database, showing inconsistent protection across the schema.

**Required action:** implement a versioned database-security migration. For this backend-mediated design, revoke direct access from public roles and enable RLS on all private app tables while retaining the backend role's required privileges. If direct client access is intentional, define and test explicit ownership policies instead. Recheck anonymous and authenticated access to every affected table after deployment.

Evidence: `live-connectivity-results.json`. Supabase explicitly requires RLS on exposed-schema tables: [official RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

### SEC-02 / Medium — malformed token causes a request-level server error

A synthetic HS256 token with a deeply nested unsigned JSON payload, still below the application's 16,384-character token limit, makes `/auth/me` return **500 instead of 401**. No real token, external verification request, or account is required for this reproduction.

The installed `PyJWT==2.14.0` is affected by [GHSA-42vr-xj54-vc7v](https://github.com/jpadilla/pyjwt/security/advisories/GHSA-42vr-xj54-vc7v), fixed in 2.15.0. Update the dependency and test malformed-token failure handling. The observed impact is an uncaught request error; this audit did not demonstrate authentication bypass or process termination.

### SEC-03 / High risk — vulnerable PDF parsing dependency on the upload path

The installed `pypdf==6.16.1` has eight audit advisories. Several concern long runtimes or memory growth during document reading/text extraction, which this app invokes on uploaded PDFs. For example, [the maintainer's text-extraction advisory](https://github.com/py-pdf/pypdf/security/advisories/GHSA-fp3h-c4fm-7vvf) covers excessive memory use. Other reported advisories concern features such as form flattening, embedded-file access, or page labels; their exploitation was not established in this application.

Upgrade to a release covering the reported fixes (the audit lists fixes through 6.19.0) and add bounded parser execution. The async upload endpoint calls the synchronous parser directly; compressed upload-size limits alone do not bound parser CPU or expanded memory. Malicious resource-exhaustion PDFs were not executed against hosted infrastructure.

### Other dependency findings

- **Frontend:** `source-map-js@1.2.1` has a high-severity indexed-source-map denial-of-service advisory; `dompurify@3.4.15`, pulled through jsPDF, has low-severity advisories. Update the lockfile to patched versions and retest exports/build tooling. The scan does not establish that untrusted indexed maps or the affected DOMPurify mode are reachable from this app's UI. See [source-map advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
- **Backend:** pip-audit reports two PyJWT advisories and eight pypdf advisories. The second PyJWT advisory concerns private OKP JWK import; this audit did not establish that path as reachable. Full scanner data is in `backend-dependency-audit.json`.
- The AI allowance bypass is also a cost/abuse-control issue; see AI-01.

### Controls that passed

- Existing tests exercise actual ES256/RS256 signatures, tampering, issuer/audience/expiry checks, remote-auth failure handling, and rejected algorithms.
- API ownership isolation passed on workspace, analysis, plan, resume-export, privacy, and growth routes.
- Request-size checks cover chunked/misdeclared bodies; upload extension/signature checks and consent-off processing have coverage.
- Job import restricts hosts to supported official APIs, rejects unsupported/internal targets, limits responses, and refuses redirects.
- Passport tests cover consent, selected owned records, expiry, revocation, private grading keys, and cross-user review rules.
- Environment files are ignored/untracked. A limited scan of 290 tracked files found no matches for Groq secret keys, Supabase secret keys, Vercel tokens, or PEM private-key patterns. Git history and every possible secret format were not scanned.

### Existing backend test failure

`tests/test_authentication.py:171` treats `/health/ready` as an application endpoint requiring a bearer token. The implementation intentionally exposes the readiness check. Update the test's system-route exception and verify that actual application operations remain protected. A public readiness response is not itself a user-data authentication bypass.

## Coverage limits and next verification

- No real user account was created or signed into. Hosted signup confirmation email, password-reset email, redirect allowlists, refresh-token rotation, and real-account JWT-to-API integration still need a designated test account.
- No hosted application data was modified. Database checks used read-only transactions; the Supabase anonymous probe used `limit=0`.
- The final browser/API fixtures stub identity, and consent is off. They prove product integration under a known identity; the separate signature tests cover the authentication implementation.
- PDF print/export dialogs, manual screen-reader/keyboard audit, production cold starts, large-user datasets, multi-worker quota concurrency, and sustained load were not certified.
- The public database exposure should be corrected first, followed by vulnerable upload/auth dependencies, AI usage accounting, and incorrect user-facing scores/gaps.

## Reproducing the audit

From the project root, using the existing backend interpreter:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest qa/test_qa_audit.py -q --junitxml=qa/regression-results.xml
.\backend\.venv\Scripts\python.exe qa/live_connectivity.py
```

The second command performs read-only configured-service checks and one Groq request containing only synthetic text. To inspect only database metadata, append `database`.

For direct browser QA, start `qa/local_qa_server.py`, build the frontend into `.verification-dist` with `VITE_API_BASE_URL=http://127.0.0.1:8011`, then run `qa/browser-audit.mjs` with `QA_API=http://127.0.0.1:8011` and `QA_DIST=.verification-dist`. Add `--flow` for the upload → analysis → roadmap → edited DOCX journey. These servers use loopback addresses and synthetic data only; stop them after the run.
