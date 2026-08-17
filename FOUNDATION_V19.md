# Cognitus Foundation V19

Foundation V19 consolidates the next generation of Cognitus platform controls around a single client-side Foundation kernel while preserving the existing GitHub Pages + Firebase Authentication + Cloud Firestore architecture.

## Included

- Action Center for pending decisions and workflow changes.
- Canonical Person Master Record.
- Owner duplicate-person detection and controlled canonical merge workflow.
- Owner System Health diagnostics and safe repair tooling.
- Organization member management with granular employer permissions.
- Admin/Owner Audit Center.
- Data & Privacy Center, personal data snapshot, correction/review/deletion requests.
- Owner-managed retention policy targets.
- Canonical profile/search-field normalization and Employer Status integrity repair.

## Employer permissions

Organization membership records can independently control:

- Run Checks
- Manage Talent
- Add Employment Records
- Request Full Reports
- Manage Members

Foundation V19 Firestore rules enforce these permissions. Legacy employer accounts without a membership document retain temporary compatibility access until a membership record is created. Foundation V19 attempts to create the signed-in employer's membership automatically, and System Health can repair missing membership records.

## Firestore rules

The committed `firestore.rules` remains the baseline rules source. `scripts/build-firestore-v19.mjs` generates `firestore.v19.rules` by applying Foundation V19 additions and permission enforcement to that baseline. The generated rules file is intentionally ignored by Git.

On Windows, deploy Foundation V19 rules from the repository root with:

```bat
deploy-rules-v19.cmd
```

Equivalent commands:

```bash
node scripts/build-firestore-v19.mjs
npx --yes firebase-tools@latest deploy --only firestore:rules --config firebase.v19.json
```

Do not deploy Firestore indexes. Foundation V19 does not use or require `firestore.indexes.json`, composite indexes, or Firestore `orderBy()` queries.

## Retention

Because Cognitus intentionally does not use Cloud Functions, retention periods are policy targets and review points rather than automatic background deletion jobs. The Owner can edit the targets from Data & Privacy.

## Audit limitation

Audit events are client-authenticated and useful for operational traceability, but without a trusted server environment they should not be represented as cryptographically tamper-proof or independently server-authenticated logs.
