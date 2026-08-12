# Cognitus Solutions

Cognitus Solutions is a static Firebase-backed employment intelligence and screening portal for Roblox and Discord communities.

## Production architecture

The production site uses one application entrypoint:

- `index.html` — shell, responsive UI, and production stylesheet
- `src/app.js` — the only production router/application entrypoint
- `src/firebase/firebaseApp.js` — Firebase initialization
- `src/firebase/firebaseConfig.js` — public Firebase web configuration
- `firestore.rules` — authoritative access control
- `firestore.indexes.json` — required composite Firestore indexes
- `firebase.json` — Firebase CLI deployment configuration for rules/indexes

`src/appV1.js` and `src/appSafe.js` are legacy snapshots and are not loaded by production. They should not be used as alternate routers.

## Security model

Cognitus is intentionally designed so frontend route hiding is never the security boundary. Firestore Security Rules enforce the real authorization model.

Key rules in the secure V2 architecture:

- A user's Discord ID, Cognitus ID, Auth UID, role, status, and organization identity cannot be changed through ordinary self-service writes.
- Privileged roles only grant authority while the account status is `active`.
- Admins cannot grant the Owner role, remove the Owner role, or modify Owner accounts.
- Owners cannot accidentally demote their own final active session through the client.
- Client-side Owner bootstrap has been retired. There is no public route that can elevate an account to Owner.
- Users cannot edit their own professional standing, risk level, identity confidence, or verification state.
- Organization administrators cannot self-verify their organization or change its trust rating.
- Original report text, severity, category, author, and subject are immutable after filing. Reviewers change review fields only.
- Claims require the immutable Discord ID on the claimant's account to match the target profile.
- Appeals must reference a real report/profile pair and must concern a profile the appellant is eligible to represent.
- Employment and certification records created by employer members are scoped to that member's organization.
- Public password-reset tickets are disabled because a browser-only Firebase client cannot securely administer another user's Firebase Authentication password.

## Identity model

Registration accepts a Discord ID and Discord username, but Cognitus does **not** claim that typing those values proves platform ownership. Newly registered profiles are therefore created as:

- `identityStatus: self_declared`
- `identityConfidence: 0`
- `professionalStanding: unreviewed`
- `riskLevel: unreviewed`

Independent verification can be added later through a trusted verification process without weakening the security rules.

## Authentication

Cognitus does not collect real email addresses. A Discord ID is converted into an internal Firebase Authentication email:

```text
<discordId>@cognitus.local
```

Users log in with their Discord ID and Cognitus password. "Remember this device" uses Firebase Auth local persistence.

### Password changes and recovery

An authenticated user can change their own password from `#/settings` after reauthentication.

A fully locked-out user cannot be securely reset by this static web client. An Owner must handle that account through a trusted Firebase administrative environment. Cognitus intentionally does not pretend that a Firestore reset-request document can reset Firebase Authentication.

## Owner provisioning

The previous Discord-ID-based client bootstrap was removed because a client-controlled bootstrap creates an unacceptable privilege-escalation path.

Initial Owner provisioning must be done from a trusted Firebase administrative environment by setting the intended user's Firestore `users/{uid}.role` to `owner` after confirming the Firebase Auth UID out-of-band. Once an Owner exists, the portal allows Owners to manage other roles while Firestore rules prevent Admin-to-Owner escalation.

Do not reintroduce a public `#/owner-bootstrap` write flow.

## Main routes

Public:

```text
#/
#/features
#/about
#/terms
#/privacy
#/login
#/register
#/account-recovery
```

Authenticated:

```text
#/dashboard
#/search
#/history
#/reports/quick?checkId=<id>
#/reports/full?checkId=<id>
#/reports/submit
#/claims
#/appeals
#/organizations
#/settings
```

Reviewer/Admin/Owner:

```text
#/review
#/admin
```

The old `#/owner-bootstrap` route is intentionally non-operational and only explains that client-side bootstrap has been retired.

## Firestore deployment

Rules and indexes should be deployed together from an authenticated Firebase CLI environment:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

GitHub Pages continues to host the static site. Firebase Hosting and Cloud Functions are not required for this version.

## Important operational limitation

Because this version intentionally has no trusted backend, `auditLogs` are **authenticated activity events**, not a cryptographically tamper-evident audit trail. Security Rules prevent users from impersonating another actor in those events, but a truly authoritative audit system should eventually be written from a trusted server/Admin SDK environment.

## Pre-merge checklist

Before merging the secure V2 branch into `main`:

1. Deploy `firestore.rules` and `firestore.indexes.json` to the Cognitus Firebase project.
2. Confirm the intended Owner account already has `role: owner` in Firestore, or provision it through a trusted Firebase administrative environment.
3. Confirm Firebase Authentication Email/Password provider is enabled.
4. Test registration, login, logout, password change, search, check logging, quick/full reports, report submission, claim submission, appeal submission, reviewer decisions, organization creation, Admin role/status updates, and Owner-only role elevation.
5. Verify suspended/banned privileged accounts can no longer use reviewer/admin/owner functions.

## Security note

Firebase web configuration values in `src/firebase/firebaseConfig.js` are public client configuration, not server credentials. Do not place Admin SDK private keys, service-account JSON, secrets, or privileged tokens in this repository.
