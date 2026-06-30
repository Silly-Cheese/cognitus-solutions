# Cognitus Solutions

Cognitus Solutions is a client-side employment intelligence and background check portal for Roblox and Discord-based organizations.

This project is designed for:

- GitHub Pages for hosting
- Firebase Authentication for accounts
- Cloud Firestore for data
- No Firebase Hosting
- No Cloud Functions for V1
- No Firebase Storage for V1

## V1 Direction

Cognitus V1 is intended to include the full portal experience:

- Account registration without collecting real emails
- Login using Discord ID and password
- Remember Me session persistence
- Required reason before every check
- People search by Roblox username, Discord username, or Discord ID
- Organization search by organization name
- Check logs
- Downloadable reports
- Profile claiming
- Appeals and correction requests
- Report submission and review
- Organization accounts
- Candidate tracker
- Saved people and organizations
- Private organization notes
- Password reset requests
- Owner bootstrap
- Admin and owner dashboards
- Audit logs
- Firestore self-initialization through app writes

## Hosting

This repository is intended to be deployed with GitHub Pages.

The app is written as a static JavaScript application using browser modules. Firebase setup will be completed in a later part.

## Authentication Model

Cognitus does not collect real email addresses.

Users enter:

```text
Discord ID
Password
```

The app converts the Discord ID into an internal Firebase Authentication email:

```text
<discordId>@cognitus.local
```

Remember Me is handled with Firebase Auth persistence:

- Checked: browser local persistence
- Unchecked: browser session persistence

## Owner Bootstrap

Owner bootstrap is configured in:

```text
src/config/bootstrapConfig.js
```

Before launch, replace:

```text
PASTE_OWNER_DISCORD_ID_HERE
```

with the real owner Discord ID. After the matching account logs in, visit:

```text
#/owner-bootstrap
```

The app will promote that account to Owner and create a locked bootstrap record in Firestore.

## Firestore Model

The Firestore data layer is documented in:

```text
docs/FIRESTORE_MODEL.md
```

Collections are created naturally by app writes. The core service modules live in:

```text
src/services
```

## Public Pages

Part 5 adds the public-facing portal pages:

```text
#/ 
#/features
#/about
#/terms
#/privacy
#/password-reset
```

The password reset page now submits admin-reviewed reset requests through Firestore when Firebase is configured.

## Dashboard

Part 6 adds the authenticated user dashboard:

```text
#/dashboard
#/search
#/claims
#/reports/submit
#/appeals
#/history
#/candidates
#/organizations/saved
#/notifications
```

The dashboard displays account information, quick actions, recent checks, saved candidates, saved organizations, and notifications.

## Search and Check Logging

Part 7 adds the logged check system:

```text
#/search
#/history
```

The search page supports person checks and organization checks. Every check requires a reason before running and creates a Firestore check log.

## Report Generation

Part 8 adds browser-generated reports:

```text
#/reports/quick?checkId=<checkDocumentId>
#/reports/full?checkId=<checkDocumentId>
```

Reports can be printed or saved as PDF through the browser print dialog. Downloads are logged as report download records when the user prints/saves.

## Claims, Appeals, and Reviews

Part 9 adds operational review workflows:

```text
#/claims
#/appeals
#/reports/submit
#/review
```

Users can submit profile claims, appeals/correction requests, and reports. Reviewers, admins, and owners can view pending reports, claims, and appeals from the review queue.

## Admin and Owner Dashboards

Part 10 adds management routes:

```text
#/admin
#/admin/users
#/admin/organizations
#/admin/audit
#/owner
#/owner/settings
```

Admins can review recent activity, manage user roles/statuses, manage organization verification/trust, and view activity logs. Owners can access portal settings and owner-level controls.

## Part Status

- Part 1: Project foundation — complete
- Part 2: Authentication and Remember Me — complete foundation
- Part 3: Owner bootstrap and roles — complete foundation
- Part 4: Firestore models and services — complete foundation
- Part 5: Public pages — complete foundation
- Part 6: User dashboard — complete foundation
- Part 7: Search and check logging — complete foundation
- Part 8: Report generation and downloads — complete foundation
- Part 9: Claims, appeals, and reviews — complete foundation
- Part 10: Admin and owner dashboards — complete foundation
- Part 11: Final integration and polish
- Part 12: Testing and deployment configuration

## Important Security Note

Because V1 does not use Cloud Functions or a traditional backend, Firestore Security Rules must enforce the real access boundaries. Frontend route protection is for user experience only and must never be treated as the only security layer.
