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

## Part Status

- Part 1: Project foundation — complete
- Part 2: Authentication and Remember Me — complete foundation
- Part 3: Owner bootstrap and roles
- Part 4: Firestore models and services
- Part 5: Public pages
- Part 6: User dashboard
- Part 7: Search and check logging
- Part 8: Report generation and downloads
- Part 9: Claims, appeals, and reviews
- Part 10: Admin and owner dashboards
- Part 11: Final integration and polish
- Part 12: Testing and deployment configuration

## Important Security Note

Because V1 does not use Cloud Functions or a traditional backend, Firestore Security Rules must enforce the real access boundaries. Frontend route protection is for user experience only and must never be treated as the only security layer.
