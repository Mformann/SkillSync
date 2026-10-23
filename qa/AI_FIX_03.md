# Phase 3: durable AI runs, current results, and bounded requests

Implemented on 21 October 2026. Hosted activation requires migration
`20261021_08` and matching API/frontend deployment. No hosted candidate data or
schema was changed during this phase; verification uses synthetic data and
disposable SQLite/PostgreSQL databases.

## Changes

### AI-01: allowance follows attempts, not mutable results

- Added a per-user accounting mutex, analysis-run records, and a usage ledger.
  PostgreSQL row locking and atomic upsert serialize reservations across workers;
  SQLite uses its database write lock. A unique active-analysis key is a second
  database guard against duplicate active runs.
- A reservation is committed before external work. Dispatch rechecks the current
  inputs and consent, then commits an attempt marker before network I/O.
- Every dispatched analysis attempt counts for the rolling 24-hour allowance,
  including provider errors, timeouts, cancellations, and failed result saving.
  Forced reruns cannot reset previous usage. Cache hits and local-only comparisons
  do not consume allowance.
- No transaction or database lock spans provider I/O. Requests for different
  users retain separate allowances.
- A 40-second lease handles interrupted workers. Expiry releases only an
  undispatched reservation; dispatched usage stays counted. GET never retries
  external work, and expired runs require an explicit user retry.
- Dispatch markers are deliberately conservative: a crash immediately after the
  marker can consume allowance without a network request. This prevents an
  uncertain dispatch from being replayed for free.

### AI-03: one upload initiates one analysis request

- The page normalizes IDs to numbers and separates initial loading from starting
  a run. Resolving the ID no longer reruns the loading effect.
- Active requests return the same run/status instead of dispatching again.
  The page polls the existing GET status endpoint with bounded backoff.
- StrictMode effect replay, route cleanup, manual reruns, processing responses,
  stale results, failures, and browser request errors have regression coverage.

### AI-02: results track their current inputs

- Fingerprints include job description, title/company context, exact resume
  text, configured model, prompt/scoring/policy versions, consent, and provider
  configuration state. Exact resume text preserves quotation provenance.
- Both cache lookup and status serialization compare current inputs. Stale
  results/scores are withheld; an older in-flight result is superseded if inputs
  or consent change before settlement.
- Enabling AI consent or configuring the provider invalidates a local-only cache.
  A deliberate rerun can refresh a fallback once the provider/allowance recovers.
- Learning plans, resume versions, and application packages retain their source
  fingerprint, including the actual result content. A changed interpretation on
  a same-input rerun also marks previous material as older. Older material is
  labeled without overwriting user work. New
  generation requires a current analysis; resume regeneration makes a new
  version, and plan recalculation preserves completed evidence and in-progress
  notes. Package regeneration remains an explicit replacement action.

### PERF-02: finite provider and operation deadlines

| Stage | Budget |
| --- | --- |
| Provider connection, headers, entire streamed body | 20 seconds |
| Analysis handler, including database stages | 25 seconds |
| Each browser request | 30 seconds |
| Frontend status polling | At most 45 seconds, GET only, backoff |
| Interrupted-run lease | 40 seconds |

- Async cancellation stops a stalled/trickling provider response; read timeouts
  cannot extend the total deadline. Provider output is capped at 1 MB.
- Failed, malformed, disconnected, oversized, or timed-out provider responses
  settle to a documented local comparison while retaining charged usage.
- Database stages own independent sessions, so a handler timeout cannot close a
  session still being used by its worker. A late database settlement cannot cause
  a delayed provider dispatch. The client checks status before retrying.
- Provider exception text is not stored or returned; it may contain sensitive
  request/response details.

## Migration and release behavior

- Migration `20261021_08` creates three private tables and source-hash columns.
  RLS and public-role revocation occur in the creation transaction.
- Known legacy Groq completions become dispatched usage records. Previous forced
  attempts overwritten by the old implementation cannot be reconstructed.
- Ledger records join the existing user data export/deletion paths. Interview
  coaching remains governed by its separate practice allowance.
- Rollout must drain old analysis handlers before migration/new API activation;
  old row-count accounting must not overlap the new ledger. All API workers and
  the frontend must use the matching release.
- Downgrade refuses to discard the usage ledger. If old API code must be
  restored, disable external AI until ledger-aware code is serving again.
- Handler deadlines do not include platform cold starts or authentication before
  the handler. Real hosted timing and account sign-in remain release smoke checks.

## Verification

| Check | Result |
| --- | --- |
| New accounting/cache/deadline/migration cases on Windows, with SQLite and PostgreSQL | 75 passed; 1 SQLite-only RLS case skipped because it requires PostgreSQL |
| Same cases in the final non-root Linux production image with SQLite/PostgreSQL | 75 passed; the same 1 SQLite-only RLS skip |
| Full backend suite, including original database-security checks | 220 passed, 1 known readiness-route assertion failure, 1 SQLite-only RLS skip |
| New page lifecycle cases | 10 passed |
| Full frontend suite | 102 passed, 1 known expired-date fixture failure |
| Frontend type checking and lint | Passed |
| Final frontend production build and API production-image build | Passed |
| Original quota, changed-job, and full candidate-flow probes | 3 passed |
| Production-build Edge regression tests | 6 passed |
| Synthetic browser upload → analysis → roadmap → editing → DOCX export → reload | Passed; exactly 1 initial analysis request |
| Browser job edit → explicit refresh → older-plan/version notices → saved contact preserved | Passed; exactly 1 additional deliberate run |
| Final interruption/deadline checks after cleanup-budget refinement | 3 passed on Windows; 6 passed on Linux (SQLite and PostgreSQL) |
| Python compilation | Passed |

Linux checks run with a 512 MB container limit and two CPUs, and use only the
disposable PostgreSQL test server. Results are in `phase-03-linux-tests.xml`.

Separate-process tests share neither Python locks nor ORM sessions and verify
both same-analysis deduplication and different-analysis quota reservation. The
provider is mocked; no real candidate documents or billable live AI requests
were used. A streaming test measures the actual provider deadline independently
of cold Windows database/thread startup; a separate test enforces the overall
operation deadline even during a slow database stage.

Evidence: `phase-03-backend-tests.xml`, `phase-03-linux-tests.xml`,
`phase-03-frontend-tests.xml`, `phase-03-original-probes.xml`, and
`phase-03-browser-flow.json`, and the `phase-03-*-final-tests.xml` supplements.

The prior readiness-route assertion and expired planner date fixture remain
separate known failures. Their tests have not been disabled or weakened. Scores,
generic gap content, table-only DOCX extraction, multipart field validation,
query scaling, schema drift, and the remaining accessibility work belong to
phases 4–6.
