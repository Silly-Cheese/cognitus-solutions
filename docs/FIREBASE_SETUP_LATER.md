# Firebase Setup Later

Firebase configuration is intentionally saved for the final setup and testing part.

## Manual Firebase Work Needed Later

You will manually do only the following:

1. Create a Firebase project.
2. Enable Firebase Authentication.
3. Enable the Email/Password provider.
4. Create the Firestore database.
5. Paste the Firebase web config into `src/firebase/firebaseConfig.js`.
6. Paste the completed Firestore Security Rules.
7. Add any Firestore indexes requested during testing.
8. Enable GitHub Pages from the repository settings.

## No Real Emails

The app will not ask users for real emails.

Users will enter:

```text
Discord ID
Password
```

The app will convert that to a synthetic Firebase Auth email internally:

```text
<discordId>@cognitus.local
```

Example:

```text
123456789012345678@cognitus.local
```

## Password Reset

Because real emails are not collected, Firebase email reset links will not be used for normal users.

Instead, Cognitus will use a password reset request workflow:

1. User submits a password reset request.
2. Admin or owner reviews the request.
3. Admin approves and marks reset required.
4. User sets a new password through the portal workflow.

The exact implementation will be added in a later part.

## Firestore Collections

Collections will not be manually created. They will be created naturally when the app writes its first documents.

Expected collections include:

```text
users
organizations
profiles
reports
checkLogs
appeals
claims
notifications
auditLogs
passwordResetRequests
savedCandidates
savedOrganizations
candidatePipelines
privateNotes
settings
```
