# Cognitus Main Repository — October 22, 2026 Architecture Audit

Scope: inspected repository tree and key production entrypoints, main rules, integration docs,
validation workflows and critical employment/organization/Discord paths. This is not a formal
line-by-line penetration test of the entire 2MB codebase.

## Architecture
- 267 tracked files, roughly 2MB at inspection time.
- Static GitHub Pages frontend. Main entrypoint: index.html -> src/app.js.
- Main Firebase project: cognitus-solutions. Existing Discord OAuth endpoint is external
  auth.cognitus-solutions.org; do not bypass or replace it.
- A production Firestore rules file of roughly 145KB.
- Staff Command is a separate application sharing the main Firebase project.
- Main app historically had no Functions configuration; this branch introduces a separate
  `references` codebase without changing existing authentication.
- Indexing policy excludes manually maintained Firestore composite indexes. Multiple
  list views use client-side sorting after reading authorized query results.

## Confirmed issues / maintenance risk
1. The main ruleset contained malformed staff disciplinary and meeting predicates. They were
   corrected on the upgrade branch and the Reference security emulator tests compiled successfully.
2. CI validators contained stale assumptions about production build versions and account-login
   implementation. These were updated to match the actual current OAuth sign-in and maintained bundles.
3. Authorization logic for employment records in the legacy rules is broader than the new
   private-reference access policy. Existing employmentRecord grants were **not** silently tightened
   because that needs compatibility testing with employer and reporting screens.
4. Client-authored audit events are suitable for user activity traces but not authoritative
   investigations. New References events are written by trusted Functions.
5. Numerous versioned UI modules/styles are loaded by the existing app. Future consolidation
   should be staged with screenshot, keyboard, and device regression tests.
6. Some features still use native browser dialogs, unpaginated queries, and client-side writes
   for high-impact state changes. These remain prioritized remediation candidates.

## Completed in this upgrade
- Reference request/respond/withdraw/share/revoke lifecycle with private Firestore records.
- Authenticated and authorized callable Functions, rate limits and server-only audit events.
- Employer-visible inbox and responsive employee request form.
- Firestore denial rules for new private collections, with owner-only notification reads.
- Versioned opt-in launch flag (off by default until Functions are deployed).
- Emulator rules tests and source smoke tests; protected manual deployment workflow.
- Corrections to malformed legacy Firestore predicates and stale CI assertions.

## Deferred intentionally (not represented as complete)
- Cross-project Careers and Academy authentication reconciliation.
- Trusted backend migration of report, appeal, discipline, and organization decisions.
- End-to-end browser QA against a staged Firebase project with realistic identities.
- Security assessment of all legacy records and detailed privileged-rule migration.
- A scalable search/indexing policy with paginated queries.
- Real external-reference invitations with authorized external respondent onboarding.
- Outbound email/Discord notifications: no provider or bot delivery authority configured.
- Production App Check enforcement: requires app registration and staged testing.
- All-main-site design-system refactoring and removal of unused legacy modules.

## Launch order
1. Review this branch and passing CI.
2. Create a restorable production Firestore backup and validate OAuth identity continuity.
3. Configure protected GitHub environment and service-account secret for the manual deploy workflow.
4. Deploy Functions and authoritative rules to staging and test an actual employer/requester pair.
5. Deploy production backend only after staging passes.
6. Enable `REFERENCES_ENABLED` in `src/config/referenceLaunch.js`, then publish frontend.
7. Monitor errors and costs. Follow up with the broader privilege migration in small batches.

Do not treat a green source-level validator as proof that the deployed Firebase Functions
are working; the staging test and deployment are independent release gates.
