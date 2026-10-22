# Cognitus References + Functions Modernization (October 2026)

## What shipped in this branch
- A new responsive `#/references` employee request and authorized employer inbox.
- Firebase Functions v2: submit, list, respond, withdraw, create/revoke private shares, read shared reference, daily expiration.
- Server-side account and organization membership validation, duplicate-request prevention, per-user request limits.
- Server-owned audit records and in-app notifications.
- Deny-by-default Firestore rules for private reference, share, lock, rate-limit and audit collections.
- No schema migration and no deletion of existing Cognitus records.
- Existing Discord OAuth and existing UI remain authoritative for sign-in.

## Security model
Functions access the database using the Admin SDK; **Firestore rules do not authorize Admin SDK accesses.**
Every privileged callable checks the Firebase Auth UID, active Cognitus user, and where needed an active organization membership
with `addEmploymentRecords` or `manageTalent`. A requester cannot respond to their own reference.
Requests are private, and a public verification is only available through a random bearer token whose SHA-256 hash is saved
to Firestore. The link expires after seven days. Do not share links in public channels.

Employer comments may be inaccurate or contested. Do not automatically publish references into reports,
professional standing, screening decisions, or searchable user profiles.

## Before deploying
1. Confirm the Firebase CLI target is **the existing Cognitus production project** (`cognitus-solutions`).
2. Take a verified Firestore export; record the live rules version. This branch does not modify existing documents.
3. Configure Firebase Blaze billing, spending alerts, APIs for 2nd-gen Functions and Cloud Scheduler.
4. From `functions/`, run `npm install` and `npm run check`. Do not commit secrets.
5. Run CI validation and emulator authorization tests from the PR. Deploy functions to a staging Firebase project first.
6. Deploy **Firestore rules** from the authoritative `cognitus-solutions/firestore.rules` only. Never use Staff Command reference fragments as competing rules.
7. Deploy **only** the listed functions from the main repo, e.g. `firebase deploy --only functions:references --project cognitus-solutions`.
8. Merge the frontend after staging functions and security rules succeed; GitHub Pages remains the frontend host.
9. Verify that existing checks, claims, appeals, organization management, Discord OAuth, staff access, and employee records still work.
10. After monitoring, enable App Check enforcement. Do not turn it on before registering and testing the site's App Check provider.

**Deployment note:** This branch is source-only; no Firebase or GitHub Pages deployment is performed by creating the PR.

## Functional scope
- Requests can target **verified organizations already present in Cognitus**.
- An authorized employee of the organization can read and respond via Employer Inbox.
- References do not require a verified position to request; the employer confirms or does not confirm that position.
- Responses can be completed, declined, withdrawn, or expire.
- A completed response can be shared by the requester through an expiring link.
- The in-app inbox is available. External Discord/email invitations are *not* configured yet because there is
  no user-approved notification provider, contact channel, or invite-verification process.

## Rollout follow-ups
- External employer invitation flow with verified representative onboarding and consent.
- User-facing list of active shares with individual revocation.
- App Check token enforcement with key management.
- Better pagination and expiration-queue partitioning for high-volume usage.
- Full emulator-driven function integration tests and accessibility/browser automation.
- Future migration of legacy sensitive writes to server-side callables.

## Avoid breaking the deployed platform
Cognitus's main repo is a static app with a 140KB+ production Firestore rules file, layered UI generations,
and older scripts that generate rule variants. Those older rule-generation scripts and deployment workflows must be
audited before using them on production. They can overwrite new rule blocks if they operate on an old baseline.
