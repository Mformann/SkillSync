# Phase 5: database efficiency, schema consistency and accessibility

Implemented locally on 21 October 2026. Hosted activation requires migration
`20261021_09` and matching API/frontend deployment. No hosted data or permissions
were changed during this phase.

## Changes mapped to findings

| Finding | Repair |
| --- | --- |
| PERF-01: 41 SELECTs for 20 workspaces | Workspace cards use three summary queries, independent of page size. They fetch a description preview, true resume count, latest resume metadata and latest analysis ID without reading document bodies or historical analysis JSON. |
| PERF-01: unbounded lists | Workspace, career-workspace and resume-history lists have bounded cursor pagination. The target-job page, career selectors and dashboard expose older pages. A directly linked job outside the first page is loaded explicitly, with no silent substitution of another job. |
| DB-01: model/migration drift | Removed 13 redundant primary-key index declarations. Migration 09 removes only exact old redundant indexes if present and adds four ownership/lookup indexes. Metadata now also describes five existing PostgreSQL uniqueness constraints. |
| UI-01: small controls | Dashboard and analysis filters and logout meet the 44 px button guideline. Shared button minima, visible focus styles, filter pressed states and spacing improve keyboard/touch operation. |
| UI-02: missing main landmarks | Dashboard and gap-report loading, empty, error and populated content have main landmarks. A skip link, route-heading focus and Escape-to-close mobile navigation improve page traversal. |

## Response and performance contract

- `/workspaces`, `/career/workspaces` and `/resume/all` return arrays with at
  most 50 rows by default. `limit` accepts 1–100; positive `before_id` seeks
  older IDs. `X-Next-Cursor` is exposed through CORS and is empty on the final
  page. Invalid bounds return structured 422 errors.
- Ordering uses descending immutable IDs. New inserts do not shift subsequent
  cursor pages; reload to see newly created items. Archive filters and ownership
  apply on every page.
- Workspace list descriptions are limited to 240 characters. `resumes` contains
  the latest metadata item; `resume_count` is the full count. Detail requests
  retain the full job description and resume metadata.
- History eagerly loads only data needed for truthful current scores. Career
  lists load only the latest analysis per job, with related preparation data
  fetched in bounded batches rather than per-row queries.
- Dashboard scoring streams batches of 100. Totals/averages still cover all
  current analyses; chart data is limited to the latest 50 scored results.
  Resume activity loads five entries per action. Privacy export remains a
  complete owned-data export, including archived jobs.
- SQLite and PostgreSQL tests cover multiple pages, concurrent newer inserts,
  owner/archive isolation, accurate counts, absent document bodies, retry and
  cancellation behavior, and complete exports.

## Migration and schema checks

Revision `20261021_09` adds:

- `target_jobs(user_id, is_archived, id)`
- `resumes(user_id, target_job_id, id)`
- `analyses(user_id, id)`
- `analyses(target_job_id, id)`

Primary keys, foreign-key/ownership indexes, uniqueness constraints and private
table protections remain intact. Only specifically named, single-column,
non-unique duplicate `id` indexes are removed. An unrelated custom index is
preserved in the existing-data upgrade regression.

Fresh migration chains and existing-data upgrades pass metadata comparisons and
`alembic check` on both supported engines. Query-plan checks confirm an indexed
owned cursor seek is available; PostgreSQL's eligibility check disables
sequential scans for that assertion. These checks do not establish production
load capacity. CI now includes the new regression cases and SQLite/PostgreSQL
migration drift checks.

## Accessibility verification

The production build is exercised at 375×812, 812×375 and 1440×900 in light and
dark themes across the 17 original signed-in routes. Fixtures contain 56 target
jobs and seven resume analyses, including a linked job outside the first page.

Checks cover a single DOM/accessibility-tree main landmark, named headings,
labeled inputs, 44 px buttons, overflow, runtime/API errors and rendered HTML
text contrast after finite entrance animations settle. SVG chart labels/bars
use theme-aware colors and representative screenshots are visually reviewed.

Keyboard smoke checks in both themes exercise route-heading focus, the visible
skip link, Enter/Tab navigation, Escape and trigger-focus restoration, native
file-picker focus, older job pages and older resume history. The file chooser
now shows focus on its visible label when the visually hidden native input has
keyboard focus. Dashboard status text, roadmap labels and gap-chart colors were
adjusted where needed for contrast.

The Edge accessibility tree is inspected as the interface exposed to assistive
technology. Audible NVDA/Narrator output was not tested. The contrast review
excludes SVG text, gradient-backed content and disabled controls; it is not a
complete WCAG certification. Human screen-reader listening and broader
assistive-technology checks remain release verification work.

## Results and evidence

| Check | Result |
| --- | --- |
| New query/pagination/schema cases on SQLite and PostgreSQL | 24 passed (`phase-05-focused-tests.xml`) |
| Earlier factual-view and migration regressions | 52 passed, 1 SQLite-only PostgreSQL-permission skip (`phase-05-compatibility-tests.xml`) |
| Full backend suite | 291 passed, 1 known readiness-route assertion failure, 1 expected skip (`phase-05-backend-tests.xml`) |
| Linux production image, Phase 4/5 and migrations, SQLite/PostgreSQL | 76 passed, 1 expected skip (`phase-05-linux-tests.xml`) |
| New paging and previous factual-view frontend checks | 21 passed (`phase-05-frontend-focused-tests.xml`) |
| Full frontend suite | 123 passed, 1 known expired planner-date fixture failure (`phase-05-frontend-tests.xml`) |
| Type checking, lint, frontend/API production builds, Python compilation, whitespace check | Passed |
| Original QA defect probes | All 10 passed (`phase-05-original-probes.xml`) |
| Public/authentication Edge regressions | 6 passed |
| Page/theme/viewport accessibility sweep | 102 passed; 5,460 rendered HTML text contrast checks, no measured failures |
| Light/dark keyboard and paging smoke checks | Both passed |
| Full upload → analysis → plan → resume edit → DOCX → reload journey | Passed; exactly one initial analysis POST and one deliberate refresh; saved work retained |

Final browser observations and keyboard steps are recorded separately in
`phase-05-browser-results.json` and `phase-05-keyboard-light.json` /
`phase-05-keyboard-dark.json`. The post-fix summary and candidate-flow result
are recorded in `phase-05-verification-summary.json` and
`phase-05-browser-flow.json`.

The authentication browser fixture now matches request pathnames independently
of pagination query parameters. Its existing lazy-loaded footer-image assertion
scrolls the image into view and waits for it to load. The Phase 4 gap-notice test
waits for its loaded notice before asserting the status region; loading now
has its own status landmark. Assertions have not been disabled or weakened.

## Remaining work

Phase 6 still includes the known readiness-route test exception and expired
planner-date fixture, additional CI/hosted end-to-end coverage, live-account
authentication/email, provider smoke tests and representative production load.
Audible screen-reader verification remains outstanding as described above.

Apply phase 3's migration 08 followed by migration 09 before deploying the
matching API/frontend. Index creation can briefly block writes; follow the
deployment maintenance procedure. Recheck CORS cursor exposure, a second page,
linked older jobs, complete export and keyboard access after deployment.

Source navigation used the existing Graphify vocabulary `workspace workspaces
navigation schema` with a 1,500-token budget. UI guidance came from the local
UI/UX Pro Max accessibility/React references; current source and test results
provide the implementation evidence.
