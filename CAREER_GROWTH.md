# SkillSync Career Growth

Open **Career Hub → Career Growth tools**, or `/career/growth`. The reminder bell
opens the follow-up inbox. Target Jobs also links directly to job capture.

## Included in this release

1. **Knowledge checks** for React, Python, SQL, JavaScript, TypeScript, Docker,
   and Git. Each attempt samples three questions and shuffles options. Answer
   keys stay server-side; submission is immutable. History compares baseline
   and retest scores. These are small, unproctored knowledge checks—not a
   professional certification, proof of project ownership, or proof of mastery.
   Other skills retain self-reported progress.
2. **Adaptive weekly planning** uses unfinished task effort, current progress,
   available hours, and chosen weekdays. Completed work is preserved. Sessions
   suggest up to 30 minutes each. Impossible deadlines are flagged and projected
   dates may exceed the requested deadline; effort is never silently compressed.
   Use rescheduling after changing availability or missing sessions. Saved
   session suggestions are a snapshot; reschedule after updating progress.
3. **Job capture** previews public Greenhouse and Lever links through their
   official read-only APIs. Users review/edit before saving. Unsupported sites
   use a manual description form, not scraping. Saved links are deduplicated per
   user. Resume uploads reuse the saved workspace. A browser extension and
   application autofill are not included.
4. **Conversational text interviews** save answers and generate contextual
   follow-ups. With explicit per-turn consent and a configured Groq provider,
   coaching estimates relevance, reasoning, and evidence. Without consent or
   when the provider fails, guided practice supplies a follow-up with no semantic
   score. No voice recording, live interview assistance, or hiring prediction.
5. **Skills Passports** publish an explicitly selected, expiring snapshot of
   project evidence and assessment results. Only the display name/headline from
   Career Vault are included automatically. Raw resumes, contact details, private
   notes, and practice answers are excluded. Tokens are random and stored only
   as hashes. Links expire after 1–30 days and can be revoked. Anyone with a link
   may copy the snapshot; revocation cannot recall copies. Signed-in non-owner
   accounts can review clarity, relevance, and reproducibility of published
   evidence. Reviews are account-based, not verified expert endorsements.
6. **Live job matching** reads configured public employer feeds and filters role,
   location, remote preference, and comparable annual salary data. Unknown
   salary/currency/period remains a manual-review flag. Alignment is the fraction
   of recognized skill terms with a latest passed knowledge check. It is not an
   ATS score, comprehensive job eligibility assessment, or hiring guarantee.
7. **Private contact management and reminders** support job-linked recruiters,
   hiring managers, referrals, notes, and communication history. Application
   next-action dates and unfinished task deadlines populate the inbox. Dismissing
   a reminder does not change learning progress or application status. The bell
   refreshes once a minute while signed in. Calendar export downloads all-day
   task deadlines and reminders; it does not create timed study appointments,
   synchronize calendars, or send emails/push notifications.

## External configuration

In `backend/.env`, set employer board identifiers approved for your deployment:

```dotenv
JOB_FEED_GREENHOUSE_BOARDS=
JOB_FEED_LEVER_COMPANIES=
```

Values are comma-separated board/company identifiers, not arbitrary URLs. Up to
six sources are queried concurrently; public feed results are cached for five
minutes. No feed is enabled by default. Greenhouse job details and global/EU
Lever job-link imports work without configuring discovery feeds. Confirm each
source's permission, usage terms, geography, and suitability before enabling it.

Semantic interview coaching uses existing `GROQ_API_KEY` and `GROQ_MODEL` settings.
No new secret is exposed to the browser. A daily per-user practice limit applies
across old and new sessions; provider output is validated before saving. Do not
include sensitive or confidential material in AI-enabled practice answers.

## Database and privacy

Alembic revision `deaf9f5a764b` adds six tables without changing existing columns.
Local SQLite development also supports the existing startup `create_all` flow.
Production should apply reviewed migrations before serving requests.

New PostgreSQL tables enable RLS and revoke client-role access. All new data is
accessed through the backend, which validates Supabase identity and ownership.
Direct browser Data API writes are deliberately prohibited: they must not be
able to change assessment answer keys, scores, or passport snapshots. The one
public read route validates an unguessable, unexpired, non-revoked capability;
public review writes still require authentication. No privileged public database
function, broadly public table policy, or service-role browser key was added.
Run hosted database security advisors and access tests before production rollout;
local SQLite tests cannot certify hosted grants/RLS.

Privacy export includes the new owned records but omits token hashes and answer
keys. App-data deletion removes growth records and other accounts' reviews of
deleted passports, invalidating published links. Deleting a target-job workspace
also removes its contacts/reminders and saved weekly schedule.

## Verification

Backend tests cover immutable grading, retests, quotas, ownership, realistic
schedules, import host restrictions, salary comparison, private snapshots,
review restrictions, expiry/revocation, calendar escaping, and privacy deletion.
Frontend tests cover controlled forms, explicit consent, errors/retry, job review
before saving, deep links, guided interviews, link sanitization, and reminder
counts. External API behavior and hosted Supabase security need deployment checks.

For offline layout verification, run these from `frontend`:

```text
npm run build -- --outDir .verification-dist
node e2e/check-career-growth.mjs
```

The checker renders real components and production styles with explicitly mocked
API/account data. It blocks network requests and checks all six sections plus
shared navigation in both themes at phone, landscape, tablet, and desktop sizes.
It checks viewport fit, visible button targets, form labels, consistent fonts,
and browser errors, and saves screenshots under ignored `test-results`.
It does not start the frontend/backend or test a hosted login/provider account.
