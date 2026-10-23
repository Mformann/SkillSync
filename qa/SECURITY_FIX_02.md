# Phase 2: dependency and document-processing security fixes

Implemented and verified locally on 21 October 2026. **Hosted rollout still
requires rebuilding/redeploying the API and frontend.** No hosted candidate
records or database permissions were changed by this phase.

## Changes

### Patched dependencies

| Package | Patched version |
| --- | --- |
| PyJWT | 2.15.1 |
| pypdf | 6.21.1 |
| certifi | 2026.10.19 |
| Vite | 6.4.5; manifest minimum raised to `^6.4.5` |
| source-map-js | 1.2.2 |
| DOMPurify | 3.4.17 |
| follow-redirects | 1.16.1 |
| Docker package installer | 26.2.2 in the verified image; build uses `pip>=26.2,<27` |

The refreshed scans found additional certificate-bundle, frontend, and base-image
installer advisories beyond the original audit. Those updates are included.
The frontend updates remain within compatible dependency ranges; no forced
major-version upgrade was used.

### Malformed-token handling

- Deeply nested token payloads below the existing token-length cap return a
  generic **401 with `WWW-Authenticate: Bearer`**, for HS256, ES256, and RS256.
- A defensive `RecursionError` handler prevents raw parser exceptions becoming
  request-level 500 errors.
- Existing signature, issuer, audience, expiry, and upstream-outage behavior is
  retained. Authentication outages continue to return 503 rather than rejecting
  a valid session as invalid.

References: [PyJWT maintainer advisory](https://github.com/jpadilla/pyjwt/security/advisories/GHSA-42vr-xj54-vc7v),
[certificate-bundle maintainer advisory](https://github.com/certifi/python-certifi/security/advisories/GHSA-6q48-6c7w-9gw2).

### Enforceable document-processing limits

Untrusted PDF/DOCX parsing now runs in a dedicated child process, coordinated
from a request worker thread. It no longer performs synchronous document
extraction on the API event loop.

| Limit | Default |
| --- | --- |
| Wall-clock deadline | 8 seconds |
| Child memory | 256 MB |
| Concurrent parsers | 1 per API process |
| Compressed upload | 10 MB |
| PDF pages | 50 |
| Extracted output | 200,000 characters |
| DOCX entries | 256 |
| Total expanded DOCX data | 25 MB |
| Maximum per-entry compression ratio | 200 |

- Linux uses address-space/CPU limits; Windows uses a Job Object with process
  memory/CPU limits. Failure to enforce resource isolation fails closed.
- Timeouts and oversized worker output terminate and reap the child process.
  Parent output reads are bounded; a child that never reads stdin cannot stall
  its request indefinitely.
- Worker environment excludes database, Supabase, and Groq credentials. Documents
  pass through pipes, library error output is discarded, and this parser does
  not write originals or extracted text to disk.
- ZIP metadata and actual streamed expansion are both checked before DOCX XML
  parsing. Unsupported/encrypted/malformed inputs have clear errors.
- Parser saturation returns 429 with `Retry-After: 2`; resource limits return
  413; invalid/encrypted documents and parsing timeouts return 422; unavailable
  resource isolation returns 503.
- New workspace records are inserted only after parsing succeeds.

This is resource isolation, not a general filesystem/network sandbox. The
supported resource-enforcement platforms are Windows and Linux. Memory settings
are additional to the API process footprint and must fit the hosting plan.

## Verification

| Check | Result |
| --- | --- |
| New parser/token cases on Windows | 28 passed |
| Same cases in non-root Linux production container, network disabled, 512 MB container limit | 28 passed |
| Full backend suite | 136 passed, 9 PostgreSQL-only tests skipped, 1 previously known failure |
| Frontend type checking and lint | Passed |
| Frontend production build with patched packages | Passed |
| Frontend unit suite | 92 passed, 1 previously known date-fixture failure |
| Production-build browser tests | 6 passed |
| Browser upload → analysis → roadmap → resume edit/save → DOCX export → reload persistence | Passed with synthetic data |
| Downloaded DOCX integrity and saved contact | Passed |
| Supabase Auth reachability with patched certificate bundle | HTTP 200 |
| Local backend and frontend dependency scans | Zero known vulnerabilities |
| Fresh non-root Linux production image dependency scan, including bundled installer | Zero known vulnerabilities |

The browser journey still records two analysis-run requests for one upload;
that existing AI-03 defect belongs to phase 3 and was not masked by these fixes.
The failed proxy-based file-upload attempt was a known test-harness limitation;
the direct-API browser journey passed.

The two known suite failures remain the intentionally public readiness-route
expectation and the planner's expired fixed date. Their assertions were not
disabled or weakened. PostgreSQL security tests were already validated in phase
1 and now also have a dedicated disposable-database CI job.

## Repeatable protection

- `backend/app/services/document_parser.py`: bounded process coordination and
  stable error mapping.
- `backend/app/services/document_parser_worker.py`: document limits and OS resource
  enforcement, with third-party parsers imported only inside the limited worker.
- `backend/tests/test_document_parser.py`: valid files, malformed/encrypted input,
  expansion/page/text/input limits, memory enforcement, worker cleanup, API
  responsiveness, credential isolation, and failure atomicity.
- `backend/tests/test_authentication.py`: malformed-payload and recursion regressions.
- CI includes Windows parser/token checks plus frontend and Python dependency audits.
- `DEPLOYMENT.md`, `backend/.env.example`, and `render.yaml` document/configure
  the parser limits and rollout requirements.

Evidence includes `security-02-targeted-tests.xml`, `security-02-backend-tests.xml`,
`security-02-linux-tests.xml`, `security-02-browser-flow.json`, and the three
`*-dependency-audit-after-02.json` reports (frontend, local backend, Linux image).

## Remaining work

Redeploy the patched API and frontend before treating SEC-02/SEC-03 and the
dependency updates as active on the hosted site. Then perform a staging upload
and malformed-token smoke check. Real-account login/email verification, the
other functional findings, and the later remediation phases remain open.
