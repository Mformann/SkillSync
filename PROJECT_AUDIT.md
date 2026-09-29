# Project audit and fixes — 17 September 2026

Scope: React/Vite frontend and FastAPI backend, focusing on sign-in, authentication
boundaries, dark mode, and the concrete issues found during the initial audit.
Existing user changes were preserved. The findings below have now been fixed in
source; hosted Supabase settings and real-account login remain unverified.

## Fixed findings

| Issue | Implemented change |
| --- | --- |
| HS256-only backend rejects asymmetric Supabase tokens | Verify ES256/RS256 using the configured project's public JWKS; verify legacy HS256 through Supabase Auth's `/user` endpoint. No local signing secret is required. |
| Missing issuer and mandatory expiry checks | Require expected issuer, audience, expiry, and nonempty subject; reject forged signatures, unsupported/malformed algorithms, malformed claims, and future not-before claims. |
| Backend errors silently sign valid users out | Shared API client refreshes once, deduplicates concurrent refreshes, and never automatically signs out on backend verification/network failures. Dashboard offers an explicit retry or sign-in action. |
| Public stateless skill-gap route contradicts auth policy | Require bearer authentication, matching all other application routes. |
| Dashboard API returns 404 | Register `/dashboard/summary` and correctly type the verified identity. |
| White dark-mode fields and weak contrast | Override field/switch backgrounds, native color scheme, field text and placeholders; use readable theme-specific primary/error colors and distinguishable input borders. |
| Invalid hex-valued variables wrapped in `hsl(...)` | Use CSS variables directly in chart tooltips and sidebar shadows; theme the gap-report tooltip too. |
| Nonfunctional Forgot password button | Add forgot/reset routes, recovery email submission, `PASSWORD_RECOVERY` routing, valid-session checks, matching-password validation, and clear success/error states. |
| Signup mishandles confirmation and logs sessions | Remove session logging; show inbox guidance without a session and enter the dashboard when signup creates a session. |
| Session initialization can hang | Catch initial session failures; ignore stale initialization results after newer auth events; clean up subscriptions. |
| Intended destination ignored | Preserve local path/query/hash after login; reject external, control-character, and auth-loop destinations. |
| Auth forms lack accessibility/reliability controls | Add error announcements/focus, password autocomplete and visibility controls, disabled pending actions, recovery feedback, and reduced-motion support. |
| Mobile/landscape overflow | Prevent signup entrance-animation overflow and switch crowded authenticated navigation to a mobile menu below desktop widths. |
| Legacy localStorage token fallback | Gap reports now use the shared Supabase-authenticated client; no ad hoc stored bearer token or credential-bearing console error remains. |
| Obsolete dependencies | Update vulnerable frontend/backend dependencies without forced npm upgrades; maintain the frontend lockfile, a patched Starlette lower bound, and a pinned patched PDF parser. Remove unused legacy JWT/PDF libraries from the local environment. |
| Privileged keys can accidentally reach browser builds | Validate public Supabase key configuration before bundling; reject secret/service-role keys. Legacy public anon keys remain supported. |
| Chunked uploads bypass Content-Length-only limits | Count and bound the actual request body before multipart parsing, including missing/false length headers. Early error responses retain security headers. |
| Numeric loopback frontend blocked by local CORS configuration | Explicitly allow both localhost and 127.0.0.1 development origins while still rejecting unrelated origins. |
| Obsolete auth documentation and OAuth token endpoint | Document Supabase setup and hosted redirect requirements; use HTTP bearer documentation instead of advertising nonexistent local login/token routes. |

## Verification results

- Backend: **73 tests passed**. Real ES256/RS256 cryptographic fixtures test
  acceptance, tampering, expiry, issuer/audience, missing claims, and malformed
  algorithms/claims. Legacy remote verification and outage handling are covered.
- Two-user isolation: an isolated in-memory database confirms another user cannot
  list, read, modify, or delete the first user's workspace. No private project
  data was used by these tests.
- Route policy: every application operation declares bearer security; anonymous
  auth, resume, dashboard, and stateless skill-gap requests are rejected.
- Request limits: oversized chunked/false-length bodies return 413 before the
  downstream application parses them.
- Frontend: **61 tests passed**, covering session races/failures, login/signup,
  password recovery, safe redirects, refresh deduplication, no forced logout,
  public-key configuration, and light/dark token contrast.
- Production browser: **4 checks passed** against `.verification-dist`, including
  simulated sign-in → dashboard → reload → logout, landscape authenticated
  navigation, and auth/recovery layouts at 375×812, 812×375, and 1440×900.
- Browser assertions verify actual dark input/text/placeholder colors, light-mode
  fields, password visibility controls, no horizontal overflow, and no page
  errors in the layout checks. Test screenshots were visually inspected.
- TypeScript checks for app and tests, ESLint, production build, Python compile,
  and backend dependency compatibility checks passed.
- `npm audit` (including development dependencies) and
  backend audits of both requirements and the installed environment report
  **no known vulnerabilities**. Unused `python-jose`, `ecdsa`, and `PyPDF2` were
  uninstalled from the local virtual environment; these packages are reinstallable
  if separately needed. The active `pypdf` parser and pip were upgraded.
- The configured hosted project's public JWKS was fetched successfully through
  the new backend verifier and advertises **ES256**. This does not prove which
  algorithm a particular real account session is currently using.
- One backend test-client deprecation warning remains: Starlette suggests its
  new optional `httpx2` transport. Existing HTTPX tests and runtime calls work.

## Deployment checks still needed

1. Connect the Supabase plugin's project-management tools or check the dashboard.
   The plugin's skill guidance was available, but no connected Supabase management
   tool was exposed in this task, so no hosted settings were changed.
2. Allow exact `/login` and `/reset-password` redirect URLs for each frontend origin
   in Authentication → URL Configuration. Verify Site URL, email/password provider,
   confirmation policy, and email delivery. See the root README for local URLs.
3. Test an existing account's actual password sign-in and recovery email. Browser
   sign-in tests intercept all auth requests; fixture credentials were never sent
   to Supabase. No hosted account was created or password changed.
4. Review production JWT lifetime and revocation requirements. Global recovery
   sign-out revokes refresh sessions, but already-issued asymmetric access JWTs
   may remain valid until expiry. Public signing-key cache lifetime is ten minutes.
5. Audit deployed database permissions/RLS separately if app tables are exposed
   through Supabase's public API. Hosted database contents, grants, and policies
   were not inspected; local ownership tests are not a production-security
   certification.

Restart the backend and frontend after dependency/environment changes. The
standard production output is generated by `npm run build`; verification used an
alternate output directory to avoid overwriting existing tracked build edits.
Earlier audit-generated changes in `frontend/dist` have not been restored or
deleted without explicit cleanup approval.

The graphify skill supplied a supporting architecture map, but its initial
integrity check found dangling/collapsed edges. Source and runtime checks above
are authoritative; the graph predates these fixes. Windows Application Control
blocked optional graph export/benchmark. The interactive browser/image helpers
also failed; headless Edge and direct screenshot reading provided browser QA.

## References

- [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts)
- [Supabase signing keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase password recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
- [FastAPI releases and Starlette compatibility](https://fastapi.tiangolo.com/release-notes/)
- [Motion reduced-motion configuration](https://motion.dev/docs/react-motion-config)
