# SEC-01 containment completed

Applied to the configured Supabase PostgreSQL database on 21 October 2026.
Migration revision: **20261021_07**.

## Result

- RLS is enabled on all **19 private application tables** and the Alembic revision table.
- `PUBLIC`, `anon`, and `authenticated` no longer have table or separately granted column access to those tables.
- Public access to the tables' owned ID sequences is revoked.
- The migration role's defaults for future tables/sequences in `public` no longer grant public access.
- Backend ownership/BYPASSRLS access and CRUD privileges remain intact.
- Unrelated schema defaults, including Supabase storage and function defaults, were compared with the pre-change snapshot and are unchanged.
- Candidate records were not modified. The only persisted row change is Alembic's migration revision bookkeeping.

## Verification

| Check | Result |
| --- | --- |
| Disposable PostgreSQL permission regression suite | **11 passed** |
| Fresh PostgreSQL migration chain with Supabase-style public defaults | Passed |
| Downgrade/re-upgrade in disposable PostgreSQL | Passed; downgrade retains containment |
| Configured-database transaction rehearsal | Passed; original permissions restored on rollback |
| Committed database audit | 19 private tables / 20 total protected; no permission issues |
| Anonymous Supabase REST requests with `limit=0` | **20 of 20 returned HTTP 401** |
| Supabase Auth health | HTTP 200 |
| Backend readiness, workspaces, resume history, data export | HTTP 200 |
| Invalid public passport capability | HTTP 404, as expected |
| Full backend regression run | 117 passed; one pre-existing readiness-route expectation failed |

Public-role write attempts, column access, sequence access, permissive-policy bypass,
future defaults, inherited grants, backend lockout prevention, and unrelated-schema
preservation were tested only in disposable PostgreSQL with synthetic rows.

Hosted verification used catalog metadata, zero-row REST requests, and read-only
API sessions under a synthetic identity. It did not retrieve private candidate
records, attempt hosted writes, or perform a real-user sign-in. The existing
signature/authentication tests remain separate from these database-access probes.

## Changes and repeatable checks

- `backend/alembic/versions/20261021_07_private_app_tables.py`: transactional, schema-qualified permission migration; deliberately does not reopen grants on downgrade.
- `backend/tests/test_database_security.py`: role-isolation and failure-safety regression coverage.
- `backend/scripts/verify_database_security.py`: read-only verifier that exits nonzero for unsafe permissions, missing tables, or lost backend access.
- `.github/workflows/ci.yml`: disposable PostgreSQL security tests, migration-chain application, and verification.
- `DEPLOYMENT.md`: database-role requirements, verification, and rollback guidance.

From `backend`, run `python scripts/verify_database_security.py` to recheck the
configured environment. Run integration tests only with `SECURITY_TEST_DATABASE_URL`
pointing to a disposable database.

Evidence files:

- `database-security-before.json`: pre-change permission snapshot.
- `database-security-rehearsal.json`: rolled-back hosted rehearsal.
- `database-security-local.json`: final disposable-database audit.
- `database-security-after.json`: committed hosted database audit.
- `database-security-release-results.json`: anonymous REST and backend smoke results.
- `security-backend-results.xml`: full backend test output.

The pre-existing backend failure is
`tests/test_authentication.py::test_all_application_endpoints_require_bearer`,
which incorrectly treats the intentionally public `/health/ready` route as a
private application endpoint. Its maintenance fix and the other QA findings
remain outside this containment change. **The overall project release remains
blocked by the remaining QA findings.**
