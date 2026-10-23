# Phase 4: factual scores, document extraction and validation

Implemented 21 October 2026. Phase 4 of `REMEDIATION_PLAN.md` is complete in
the working tree. Hosted activation still requires the phase 3 migration and
matching API/frontend deployment.

## Changes mapped to findings

| Finding | Change |
| --- | --- |
| FLOW-01: zero and sample scores | One read-only projection validates and grounds the current explainable result, then calculates the score. History, dashboard, analysis, gap reports and the career page use it. A genuine zero stays zero; missing results remain unavailable. |
| FLOW-02: generic gaps and invented claims | Requirements, strengths, gaps, actions and dashboard goals come from the selected job analysis. Required items precede preferred items, ordered by importance. Strengths require supporting resume excerpts. Fixed expertise, experience, demand and time-to-readiness claims are removed. |
| FLOW-03: table-only DOCX rejection | The bounded worker reads paragraphs and physical table cells in document order, including nested tables and horizontal/vertical merges. Unique headers precede body content; unique footers follow it. Merged-cell aliases do not repeat text. |
| FLOW-04: mismatched upload validation | Multipart uploads, workspace creation/update and saved imported jobs share trimmed field constraints. Frontend limits and readable structured error messages match the backend contract. |
| FLOW-05: explicit null and partial writes | Explicit nulls for title, description, archive state and consent return 422. Omitted update fields stay unchanged; nullable company/location/employment fields can be cleared. Saved-job edits, resume and analysis commit together after parsing and validation. |

## Result and compatibility behavior

- `projection_version=evidence-views-v1` identifies the response contract.
  Scores continue to use `weighted-match-v1`.
- Only current completed analyses with evaluable requirements enter scored
  history, averages and completion counts. Pending, processing, failed, stale,
  legacy and no-requirements results return notices and nullable scores.
- Stored legacy sample JSON is preserved, including in historical export.
  Application views never use it as evidence. Unsupported legacy results need
  explicit reanalysis; invalid legacy JSON cannot satisfy a cache hit.
- Learning tasks are joined to their actual analysis and source fingerprint.
  An unrelated or older plan cannot make a new job gap look complete.
  Dashboard goals show saved task progress; clicking a goal no longer invents
  unsaved completion.
- The gap chart describes evidence classifications rather than measured skill
  proficiency. The career page labels its activity-based composite as
  preparation progress; its job-match component uses the same current score.
  Its overall estimate is unavailable without a current job match.
- New generation still requires a valid current analysis. Existing saved
  plans, resume edits and application packages remain preserved.

## Document handling

Images, drawing/text-box content and embedded attachments are not read; no OCR
or external document retrieval is performed. Scanned/low-text documents receive
an actionable message asking for selectable text. Encrypted, malformed and
oversized documents retain the phase 2 error handling and resource limits.

The existing limits remain: 10 MB input, 50 PDF pages, 200,000 text characters,
256 archive entries, 25 MB expanded archive data, compression-ratio checks,
256 MB worker memory and an 8-second default worker deadline. Table/header/
footer extraction goes through the same worker and output limits.

## Validation and atomicity

After trimming: title is 2–160 characters, description 50–50,000, company and
location at most 160, employment type at most 80. JSON consent/archive values
must be booleans. Field failures produce structured 422 responses with field
locations; they are formatted as readable messages in the upload form.

Parsing and field validation happen before writes. A saved-job upload performs
its job edits and new resume/analysis inserts in one transaction. Parser failure
leaves the job unchanged. An induced database commit failure rolls back all
inserts, job changes and newly created account-lock records. Reusing a saved job
does not create a duplicate workspace or trigger a separate pre-upload PATCH.

## Verification

All checks use synthetic documents and isolated databases. Groq is mocked or
disabled; no live candidate account or billable provider request is involved.

| Check | Evidence |
| --- | --- |
| Phase 4 API, validation, zero/legacy/cache and DOCX cases on SQLite/PostgreSQL | `test_phase_four.py`: 47 cases; final integration results recorded in `phase-04-final-integration-tests.xml` |
| Final Phase 4/career integration and retried PostgreSQL setup case on Windows | 82 passed: `phase-04-final-integration-tests.xml` |
| Final non-root Linux production image, Phase 4 and career regressions, 512 MB / 2 CPUs | 81 passed: `phase-04-linux-final-tests.xml` |
| Broader backend/parser/accounting/migration checks | `phase-04-backend-tests.xml`, `phase-04-linux-tests.xml`, `phase-04-final-tests.xml` |
| Final Phase 4 pages plus prior analysis lifecycle cases | 25 passed: `phase-04-frontend-final-tests.xml` |
| Combined backend verification, using final reruns for corrected cases | 267 passed, 1 known readiness-route assertion failure, 1 SQLite-only RLS skip |
| Combined frontend verification, using final added-page cases | 117 passed, 1 known planner-date fixture failure |
| Type checking, lint, frontend production build, API image build, Python compilation and whitespace check | Passed |
| Production-build Edge regression suite | 6 passed |
| All original QA API probes | 9 passed; only the Phase 5 query-count probe remains failing |
| Full synthetic candidate browser journey | `phase-04-browser-flow.json`: passed, no runtime errors, one initial analysis POST and one deliberate refresh |

The browser journey covers a table-only DOCX upload, analysis, plan generation,
resume editing, DOCX download, reload persistence, changed-job refresh, older
plan/version notices and preservation of edits. It checks a genuine zero on
dashboard/gap/career pages, then unavailable scores after a saved-job pending
upload. Frontend tests also cover legacy/unavailable notices, stale/unrelated
learning plans, structured validation and the atomic upload request.

The final integration rerun covers an interview-practice regression found and
corrected during verification, plus one PostgreSQL setup case interrupted by a
local connection timeout. Original failing artifacts are retained; the final
results supersede those cases. `phase-04-verification-summary.json` consolidates
the latest result for each case and records remaining failures explicitly.

## Remaining release work

- Phase 5: workspace listing still performs 41 SELECTs for 20 jobs; schema and
  accessibility work remain in the remediation plan.
- Phase 6: the existing bearer-enforcement test does not exempt public
  `/health/ready`; the planner fixture uses an expired fixed date. Those
  assertions have not been disabled or weakened.
- Deploy phase 3 revision `20261021_08` and rebuild/redeploy the API and frontend
  together. Phase 4 adds no migration. Hosted authentication, email, live Groq
  and production-load checks remain release verification tasks.

Source navigation used the existing Graphify graph with the expanded vocabulary
`analysis gap report resume schema score workspace` and a 1,500-token query
budget. Implementation and test conclusions were verified against current files.
