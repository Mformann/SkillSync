# SkillSync repair and release plan

Prepared 21 October 2026 from the 19 October QA report. This document plans the work; it does not apply application changes or hosted database migrations. Hosted permissions must be rechecked before acting because the audit is a dated snapshot.

**Progress update:** Phase 1 is complete in the configured database as of
21 October 2026, including migration `20261021_07` and hosted verification.
See [SECURITY_FIX_01.md](SECURITY_FIX_01.md) for evidence. Phase 2 is implemented
and verified on Windows and Linux, with clean dependency scans and passing
parser/token regression cases. Its hosted activation still requires rebuilding
and redeploying the API and frontend; see [SECURITY_FIX_02.md](SECURITY_FIX_02.md).
Phase 3 is implemented with durable accounting, shared active runs, current-input
caching, preserved derived work, and aligned time budgets. Its code and migration
are verified using disposable databases; hosted activation requires revision
`20261021_08` and matching API/frontend deployment. See [AI_FIX_03.md](AI_FIX_03.md).
Phase 4 is implemented: current evidence supplies scores, gaps and goals across
pages; DOCX tables are read in order; JSON and upload validation share the same
limits; saved-job edits and uploads commit together. See [FLOW_FIX_04.md](FLOW_FIX_04.md)
for verification and deployment status. Phase 5 is implemented with bounded
summary queries and pagination, reconciled metadata/migrations, larger controls,
page landmarks and keyboard/focus improvements. See [PERF_UI_FIX_05.md](PERF_UI_FIX_05.md)
for verification, remaining manual checks and deployment requirements. Phase 6
is implemented for a first-deployment release candidate: the remaining failing
tests are repaired, the original probes run in the normal suite, dependencies
are locked, and CI includes browser and real production-container verification.
The user selected **prepare for first deployment**. Hosted acceptance therefore
remains a launch checklist, not an assertion that a beta has already been deployed.
See [BETA_RELEASE_READINESS.md](BETA_RELEASE_READINESS.md) for the final evidence
and [FIRST_BETA_DEPLOYMENT.md](FIRST_BETA_DEPLOYMENT.md) for the handoff.

## Outcome and scope

Fix every confirmed finding in `QA_REPORT.md`, retain the working candidate journey, and close the verification gaps before calling the project production-ready. Preserve factual, job-specific scoring and evidence. Keep candidate documents private and external AI processing consent-controlled.

Use small, reviewable changes with a regression test for each behavioral defect. Preserve the existing QA evidence; save post-fix results separately. Do not disable failing tests or remove security checks to achieve a green build.

## Order of work

| Phase | Work | Depends on | Completion gate |
| --- | --- | --- | --- |
| 1 | Contain database exposure and repair security boundaries | Read-only confirmation of current permissions and backend role | Public roles cannot access private app data; backend still works |
| 2 | Update vulnerable dependencies and bound document parsing | Dependency compatibility review; overlaps with phase 1 preparation | Fresh audits and parser/auth regression tests pass |
| 3 | Fix AI accounting, duplicate execution, caching, and timeouts | Phase 1 protects new usage/run tables | Concurrent requests cannot duplicate jobs or bypass allowance |
| 4 | Correct scores, gaps, uploads, and validation | Phase 3 supplies valid current analysis state | Accurate data across pages; robust document handling and 422 responses |
| 5 | Improve database queries, schema consistency, and UI accessibility | Final response contracts from phases 3–4 | Query-count, migration, mobile, keyboard, and landmark checks pass |
| 6 | Automate regression checks and prepare first deployment | All repairs integrated in candidate | Local release gate passes; hosted acceptance runs after first deployment |

Keep the project release-blocked until phase 1 is complete. Do not postpone containment while preparing the larger application fixes.

## Part 1 — Security

### SEC-01: contain public database exposure first

1. Recheck the public Data API, RLS, table/schema grants, sequence grants, and the actual backend database role without retrieving private records.
2. Identify every private application table, including the six growth tables already protected in the audited database and any new analysis-run/usage tables. Confirm that frontend data access is mediated through FastAPI.
3. Capture current schema/permission definitions and confirm a recoverable database backup. Prepare a versioned Alembic migration that enables RLS and removes unnecessary direct access for `anon`, `authenticated`, and `PUBLIC` on private tables and their sequences. Review applicable default privileges so future tables do not reopen exposure.
4. Preserve the backend role's required access. Do not revoke authentication-service permissions or unrelated Supabase-managed schema privileges. If a table genuinely needs direct client access, give it explicit, tested ownership policies instead of broad access.
5. Apply and verify the migration in staging, then apply the narrowly scoped containment change to the configured environment through the normal deployment path. Record the deployed revision and resulting permissions.

**Acceptance:** anonymous and ordinary authenticated clients cannot read, insert, update, or delete private app data through the Data API. Two-user FastAPI tests still pass. Intentional public passport sharing continues to work only through its capability endpoint. Test grants in disposable PostgreSQL using the actual public roles; SQLite is insufficient. Use staging fixtures for write-denial tests, and non-destructive permission/zero-row checks on production.

**Rollback:** repair backend-role access if needed while retaining the public-access restrictions. Do not automatically roll back to the exposed grants.

### SEC-02 / SEC-03 / dependency findings: update and harden input processing

- Refresh both dependency audits at implementation time. Upgrade PyJWT, pypdf, source-map-js, and DOMPurify to compatible patched releases covering all reported advisories; update pins and the frontend lockfile deliberately. The prior audit's minimum fixes are a starting point, not a substitute for a fresh scan.
- Convert malformed token failures into a generic 401. Preserve 503 for upstream authentication outages and retain signature/issuer/audience/expiry enforcement. Test deeply nested payloads below the token-length cap in both legacy and JWKS entry paths.
- Move document parsing out of the async request event loop. Run untrusted parsing in an isolated process with enforceable execution and memory limits; a timeout around an ordinary thread does not stop runaway work.
- Bound DOCX ZIP expansion, archive entry counts, extracted text length, and PDF page/output limits before retaining parsed content. Keep the existing upload size and signature checks. Return a clear, recoverable response for encrypted, malformed, oversized-expanded, or timed-out documents.
- Terminate timed-out parser processes and clean up temporary resources. Verify the implementation on the Windows development environment and Linux deployment environment.

**Acceptance:** malformed tokens return 401; valid authentication tests remain green. Bounded parser fixtures fail safely without destabilizing other requests, and normal PDF/DOCX files still work. Fresh dependency scans have no unresolved applicable advisories; any remaining scanner findings require documented reachability analysis rather than being silently ignored.

## Part 2 — Database, AI connectivity, and performance

### AI-01 / AI-03: account for every provider call and prevent duplicate runs

- Introduce persisted analysis-run and usage records with explicit queued/reserved, running, completed, failed, and expired states as appropriate. Store identifiers, model/prompt version, input hash, timestamps, and usage status; avoid logging raw documents or credentials.
- Reserve an allowance atomically per user before dispatching an external call. Use PostgreSQL transaction locking or an equivalent atomic database operation around the quota check and reservation, then commit before network work. Do not hold database locks during provider requests.
- Count dispatched provider attempts independently of the mutable analysis row. A failed or timed-out request that reached the provider still consumes the allowance; release a reservation only when no external request was dispatched. Cache hits and consent-off local comparisons must not consume AI allowance.
- Enforce one active run for the same analysis/input. Duplicate requests return the same run/result or a documented processing response; `force` requests must not bypass deduplication or quota. Use a finite lease and safe recovery for interrupted runs.
- Stabilize the frontend analysis effect and its identifier types. Separate loading an analysis from initiating its run, so setting the current analysis ID does not initiate another request. Handle processing states without automatically issuing another provider call.
- Keep consent as a server-side prerequisite checked at dispatch. An analysis fetched from cache must never become a reason to send data externally without consent.

**Acceptance:** one fresh upload initiates one run. With allowance 1, sequential forced reruns and simultaneous requests across multiple API workers make at most one provider call. Separate users retain separate allowances. Restart/expired-lease tests cannot cause uncontrolled retries or lose usage records. Browser request traces and mocked provider-call counts prove this behavior.

### AI-02: make results track their current inputs

- Compute and compare the current input hash before returning existing results. Include the resume/job inputs, model, prompt/scoring version, and relevant processing policy in cache validity decisions.
- Invalidate affected analysis views when a job description or resume changes. Treat a model result completed after its inputs changed as superseded rather than presenting it as current.
- Define dependent roadmap and tailored-material behavior explicitly: preserve user-entered content, mark derived artifacts as based on an older analysis, and offer deliberate regeneration. Never silently overwrite an edited resume or completed learning evidence.
- Handle consent/provider-availability changes explicitly so a cached fallback does not prevent an intentional AI refresh. Consent revocation must prevent new dispatches; describe already-dispatched work accurately.

**Acceptance:** changing a Python/Docker job to Kubernetes produces current requirements on the next run. Unchanged inputs reuse a valid result without an external call. Stale derived content is identifiable, and user edits survive refreshes.

### PERF-02: define a consistent time budget

- Keep the current synchronous path initially rather than introducing a separate queue solely for this defect. Proposed initial budgets: a provider attempt bounded to 20 seconds, an overall backend operation bounded to 25 seconds, and a 30-second browser timeout. Confirm these fit hosting/proxy limits before implementation.
- Enforce wall-clock operation deadlines, not only per-read network timeouts. On provider deadline expiry, return the documented rule-based fallback or a clear retryable state within the browser budget.
- For duplicate requests encountering an active run, return processing state and poll the existing status endpoint with bounded backoff. Do not start another AI call because a browser timed out.
- If representative workloads require longer than this budget, implement a durable job/worker and polling design as an explicit follow-up decision rather than merely increasing every timeout.

**Acceptance:** simulated slow, stalled, failed, and disconnected provider calls settle within the documented budget. UI status agrees with persisted state and cannot trigger duplicate spending on retry.

### PERF-01 / DB-01: repair query scaling and migration drift

- Replace per-workspace relationship loading with bounded eager loading or aggregate queries. Avoid fetching full resume text or analysis JSON where summaries suffice.
- Add bounded pagination for workspace/history lists and update consumers, exports, and latest-item behavior consistently. Keep explicit ordering stable.
- Reconcile the redundant `index=True` primary-key declarations with actual migrations. Prefer removing unnecessary duplicate index declarations over adding indexes already served by primary keys. Preserve necessary foreign-key, ownership, and lookup indexes.
- Verify the complete migration chain on disposable SQLite and PostgreSQL databases, including upgrading an existing schema with data.

**Acceptance:** the existing 20-workspace probe uses no more than five SELECTs; the count does not grow per workspace. Query plans use suitable indexes. Migration checks are clean on both supported databases, with no data loss or accidental duplicate primary-key indexes.

## Part 3 — User flow and data accuracy

### FLOW-01 / FLOW-02: use a single factual analysis source

- Replace score truthiness checks with explicit missing-value checks so zero remains zero.
- Remove fixed sample scores and unsupported “Expert”, “3+ years”, fixed role-match, and time-to-readiness claims from real-user responses. A pending or unavailable score must be visibly pending/unavailable, not a fabricated number.
- Derive history, dashboard scores/goals, gap reports, strengths, and suggested actions from the same current, job-specific explainable result. Prioritize actual required/preferred gaps rather than every term in a global skill list.
- Keep compatibility with older saved analyses: compute a truthful view from supported evidence when possible, otherwise mark the result as legacy and request reanalysis. Do not rewrite historical records with invented values.
- Version scoring/projections where needed so UI consumers and saved data agree on the formula and freshness.

**Acceptance:** a 0% match stays 0% everywhere. A Python/Docker job produces the appropriate Docker gap and no unrelated AWS/Azure goals. Pending analyses do not count as completed. Every experience or strength claim has an identifiable source or is clearly user-attested.

### FLOW-03: read common DOCX layouts correctly

- Extract paragraphs and table cells in document order, including nested tables and mixed layouts, without counting merged cell text twice.
- Define how headers/footers and unsupported embedded content are handled. Give clear feedback when meaningful text cannot be extracted.
- Apply the parser resource limits from phase 2 to these paths as well.

**Acceptance:** paragraph-only, table-only, nested/merged-table, and mixed DOCX resumes parse reliably. Scanned/encrypted/malformed documents produce useful errors. Ordinary PDF and DOCX regressions remain green.

### FLOW-04 / FLOW-05: share validation across entry points

- Reuse one validation contract for multipart resume upload and JSON workspace creation/update. Trim meaningful text before enforcing title/company/description limits.
- Distinguish omitted update fields from explicit null: reject null for title, description, archive state, and consent; allow clearing nullable fields such as company where intended.
- Validate before inserting or changing records. Roll back failed uploads/updates fully so they do not leave orphan workspaces, resumes, or usage reservations.
- Keep frontend limits and backend error messages consistent, with backend enforcement authoritative.

**Acceptance:** invalid titles/descriptions and prohibited nulls return structured 422 responses in SQLite and PostgreSQL; maximum valid values succeed. Failed requests leave no partial records. The normal saved-job upload flow remains intact.

## Part 4 — UI and accessibility

### UI-01 / UI-02

- Increase dashboard filters/logout and analysis filter controls to at least the project's 44 px interaction target, with adequate spacing on mobile.
- Add one semantic main landmark to dashboard and gap-report content, preserving the shared navigation structure and heading hierarchy.
- Verify keyboard focus visibility, tab order, error announcements, loading states, file-picker access, menu operation, and focus behavior after navigation.
- Review contrast in both themes, particularly muted text, warnings, chart labels, disabled controls, and validation feedback. Preserve the existing working layout and visual style.

**Acceptance:** the 68 existing page/theme/viewport checks remain free of overflow, runtime errors, API errors, and unlabeled inputs. Add target-size and main-landmark assertions. Repeat portrait, landscape, and desktop checks, then complete a manual keyboard and screen-reader smoke test with recorded results.

## Test maintenance and continuous verification

- Fix the planner's date-dependent fixture with a controlled clock or an explicitly relative future date. Retain assertions proving the deadline/capacity warning works; do not weaken form validation to satisfy an obsolete date.
- Update the bearer-enforcement test to exempt only intentional public system endpoints and the token-protected passport read. Continue enumerating all application routes to catch accidentally unprotected operations.
- Promote all ten QA API probes into the normal test suite after correcting implementation. Add coverage for the duplicate browser run, PostgreSQL public-role denial, atomic quota concurrency, parser limits, and stale derived artifacts.
- Add CI jobs for browser flows, disposable PostgreSQL migrations/permissions, schema drift, and dependency audits. Use synthetic data and test-only configuration; do not make CI depend on a real candidate account or live paid AI calls.
- Keep a separate opt-in hosted smoke suite for Supabase and Groq. Ensure its credentials and any test-account tokens stay outside reports and repository files.

## Hosted verification and release gate

Use a designated test account and staging fixtures to verify the checks that the original audit could not certify:

1. Signup confirmation email, login, protected API access using a real issued token, session refresh, logout, password-reset email, expiry, and redirect allowlists.
2. PDF/DOCX upload, consent-on AI analysis, consent-off fallback, retry behavior, current-data caching, and allowance exhaustion.
3. Roadmap progress/evidence, tailored resume editing, DOCX export, and the actual print/PDF output with visual inspection.
4. Data export/deletion, cross-user isolation, passport sharing/revocation, and private-table access denial through Supabase's Data API.
5. Representative PostgreSQL datasets, deployment cold starts, and sustained load. Record data size, concurrent users, error rate, p50/p95 latency, memory/CPU, and provider time separately; choose release thresholds before the run based on intended usage.

Release only after:

- All confirmed findings have a linked fix and passing verification result.
- Frontend typecheck/lint/build, backend tests, browser tests, migrations, and PostgreSQL role-isolation checks pass in CI.
- The nine previously failing QA defect probes pass without weakened assertions, and a fresh upload initiates exactly one analysis run.
- Public database restrictions are verified in the deployed environment and no applicable dependency vulnerabilities remain unresolved.
- The hosted smoke checks pass or any remaining limit is explicitly documented and accepted before production use.

Deploy schema protections and additive changes before application code that depends on them. Recheck health, readiness, ownership, and the core candidate journey immediately after deployment. Roll back application code if needed while retaining security containment and preserving committed user data.

## Deliverables

- Versioned security and analysis-usage migrations.
- Patched dependency manifests/lockfile and fresh audit results.
- Fixed backend/frontend behavior with regression and PostgreSQL concurrency tests.
- Accessible UI corrections without a redesign.
- Updated CI and deployment instructions.
- A post-fix report mapping every original finding to its change, test evidence, deployed status, and any remaining limitation.
