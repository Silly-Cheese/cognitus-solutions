from pathlib import Path

RULES_PATH = Path("firestore.rules")
rules = RULES_PATH.read_text(encoding="utf-8")

MARKER = "    // ============================================================\n    // COGNITUS STAFF / COMMAND — GENERATION 1"
SECTION_MARKER = "    // ============================================================\n    // MAIN COGNITUS — PART 1 COMPLETION"

if MARKER not in rules:
    raise RuntimeError("Could not locate Staff / Command Generation 1 insertion point")

# These are the canonical main-site collections declared by src/firebase/collections.js
# that did not yet have a dedicated match block. Live surfaces receive strict,
# schema-aware rules. Reserved/dormant surfaces are explicitly sealed until a
# production client workflow and schema exist; this is safer than relying on an
# accidental broad match or inventing write authority.
block = r'''
    // ============================================================
    // MAIN COGNITUS — PART 1 COMPLETION
    //
    // Canonical V1 collections that were declared by the main product but did
    // not previously have an explicit security boundary. These rules belong in
    // this authoritative main-project ruleset because Main Cognitus and
    // Staff / Command share the same Firestore database.
    // ============================================================

    // ------------------------------------------------------------
    // USER NOTIFICATIONS
    // Recipient-scoped reads. Main Cognitus reviewers may create workflow
    // notifications for another user; ordinary accounts may only create their
    // own notification records. Recipients may only mark a record read.
    // ------------------------------------------------------------
    match /notifications/{notificationId} {
      allow read: if activeAccount()
        && (
          resource.data.userId == request.auth.uid
          || isReviewer()
        );

      allow create: if activeAccount()
        && request.resource.data.keys().hasOnly([
          'id', 'cognitusId', 'userId', 'title', 'message', 'type', 'link',
          'read', 'readAt', 'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == notificationId
        && request.resource.data.cognitusId is string
        && request.resource.data.cognitusId.matches('^NTF-[0-9]{2}-[A-Z2-9]{6,7}$')
        && request.resource.data.userId is string
        && exists(userPath(request.resource.data.userId))
        && (
          request.resource.data.userId == request.auth.uid
          || isReviewer()
        )
        && shortString(request.resource.data.title, 160)
        && request.resource.data.title.size() > 0
        && shortString(request.resource.data.message, 2000)
        && shortString(request.resource.data.type, 50)
        && shortString(request.resource.data.link, 500)
        && request.resource.data.read == false
        && request.resource.data.readAt == null
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if activeAccount()
        && resource.data.userId == request.auth.uid
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'read', 'readAt', 'updatedAt'
        ])
        && request.resource.data.read == true
        && request.resource.data.readAt != null
        && (
          request.resource.data.readAt is timestamp
          || shortString(request.resource.data.readAt, 80)
        )
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
    }

    // ------------------------------------------------------------
    // SAVED CANDIDATES
    // Entirely user-owned. Organization context is captured at save time but
    // never grants another member access to a user's personal saved list.
    // ------------------------------------------------------------
    match /savedCandidates/{savedId} {
      allow read: if activeAccount()
        && resource.data.userId == request.auth.uid;

      allow create: if activeAccount()
        && request.resource.data.keys().hasOnly([
          'id', 'userId', 'organizationId', 'profileId', 'label', 'status',
          'notesCount', 'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == savedId
        && request.resource.data.userId == request.auth.uid
        && (
          request.resource.data.organizationId == null
          || request.resource.data.organizationId == currentUser().organizationId
        )
        && request.resource.data.profileId is string
        && exists(profilePath(request.resource.data.profileId))
        && shortString(request.resource.data.label, 120)
        && request.resource.data.label.size() > 0
        && shortString(request.resource.data.status, 60)
        && request.resource.data.notesCount is int
        && request.resource.data.notesCount >= 0
        && request.resource.data.notesCount <= 100000
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if activeAccount()
        && resource.data.userId == request.auth.uid
        && request.resource.data.id == resource.data.id
        && request.resource.data.userId == resource.data.userId
        && request.resource.data.organizationId == resource.data.organizationId
        && request.resource.data.profileId == resource.data.profileId
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'label', 'status', 'notesCount', 'updatedAt'
        ])
        && shortString(request.resource.data.label, 120)
        && request.resource.data.label.size() > 0
        && shortString(request.resource.data.status, 60)
        && request.resource.data.notesCount is int
        && request.resource.data.notesCount >= 0
        && request.resource.data.notesCount <= 100000
        && request.resource.data.updatedAt == request.time;

      allow delete: if activeAccount()
        && resource.data.userId == request.auth.uid;
    }

    // ------------------------------------------------------------
    // SAVED ORGANIZATIONS
    // ------------------------------------------------------------
    match /savedOrganizations/{savedId} {
      allow read: if activeAccount()
        && resource.data.userId == request.auth.uid;

      allow create: if activeAccount()
        && request.resource.data.keys().hasOnly([
          'id', 'userId', 'organizationId', 'savedOrganizationId', 'label',
          'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == savedId
        && request.resource.data.userId == request.auth.uid
        && (
          request.resource.data.organizationId == null
          || request.resource.data.organizationId == currentUser().organizationId
        )
        && request.resource.data.savedOrganizationId is string
        && exists(organizationPath(request.resource.data.savedOrganizationId))
        && shortString(request.resource.data.label, 120)
        && request.resource.data.label.size() > 0
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if activeAccount()
        && resource.data.userId == request.auth.uid
        && request.resource.data.id == resource.data.id
        && request.resource.data.userId == resource.data.userId
        && request.resource.data.organizationId == resource.data.organizationId
        && request.resource.data.savedOrganizationId == resource.data.savedOrganizationId
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'label', 'updatedAt'
        ])
        && shortString(request.resource.data.label, 120)
        && request.resource.data.label.size() > 0
        && request.resource.data.updatedAt == request.time;

      allow delete: if activeAccount()
        && resource.data.userId == request.auth.uid;
    }

    // ------------------------------------------------------------
    // ORGANIZATION-PRIVATE NOTES
    // Private notes are never globally readable. The query must be scoped to
    // the caller's organization and the caller must have talent-management
    // authority for that organization.
    // ------------------------------------------------------------
    match /privateNotes/{noteId} {
      allow read: if activeAccount()
        && resource.data.organizationId != null
        && canManageTalent(resource.data.organizationId);

      allow create: if activeAccount()
        && request.resource.data.keys().hasOnly([
          'id', 'organizationId', 'createdByUid', 'profileId',
          'organizationTargetId', 'note', 'visibility', 'archived',
          'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == noteId
        && request.resource.data.organizationId != null
        && request.resource.data.organizationId == currentUser().organizationId
        && canManageTalent(request.resource.data.organizationId)
        && request.resource.data.createdByUid == request.auth.uid
        && (
          (request.resource.data.profileId is string
            && request.resource.data.organizationTargetId == null
            && exists(profilePath(request.resource.data.profileId)))
          ||
          (request.resource.data.profileId == null
            && request.resource.data.organizationTargetId is string
            && exists(organizationPath(request.resource.data.organizationTargetId)))
        )
        && shortString(request.resource.data.note, 5000)
        && request.resource.data.note.size() > 0
        && request.resource.data.visibility == 'organization_private'
        && request.resource.data.archived == false
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if activeAccount()
        && canManageTalent(resource.data.organizationId)
        && request.resource.data.id == resource.data.id
        && request.resource.data.organizationId == resource.data.organizationId
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.profileId == resource.data.profileId
        && request.resource.data.organizationTargetId == resource.data.organizationTargetId
        && request.resource.data.visibility == resource.data.visibility
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'archived', 'updatedAt'
        ])
        && request.resource.data.archived is bool
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
    }

    // ------------------------------------------------------------
    // RESERVED MAIN-PRODUCT COLLECTIONS
    // These names are part of the canonical V1 model, but the current main
    // client has no production write workflow/schema for them. Explicit deny
    // makes their status intentional and prevents future accidental exposure.
    // They must be opened only alongside the feature that defines their schema.
    // ------------------------------------------------------------
    match /candidatePipelines/{pipelineId} {
      allow read, write: if false;
    }

    match /duplicateReviews/{reviewId} {
      allow read, write: if false;
    }

    match /employmentHistory/{historyId} {
      allow read, write: if false;
    }

    match /certifications/{certificationId} {
      allow read, write: if false;
    }

'''

if SECTION_MARKER not in rules:
    rules = rules.replace(MARKER, block + MARKER, 1)

# Part 1 invariants. These are intentionally checked after insertion so a
# repeated run remains idempotent and safe.
required_matches = [
    'users', 'organizations', 'organizationMembers', 'profiles', 'reports',
    'checkLogs', 'appeals', 'claims', 'notifications', 'auditLogs',
    'passwordResetRequests', 'savedCandidates', 'savedOrganizations',
    'candidatePipelines', 'privateNotes', 'downloads', 'duplicateReviews',
    'employmentHistory', 'certifications', 'settings/bootstrap',
    'settings/portal', 'employmentRecords', 'employmentRecordDisputes',
    'externalProfileClaims', 'reportAccessRequests', 'reportAccessGrants',
    'ownerReportAccessGrants', 'employerStatusRequests', 'employerCandidates',
    'privacyRequests', 'profileMergeMap', 'screeningReportSummaries',
    'promotionalCodes', 'promoRedemptions', 'promoAccessGrants', 'promoUserData'
]

missing = []
for name in required_matches:
    if name.startswith('settings/'):
        needle = f'match /{name} '
    else:
        needle = f'match /{name}/'
    if needle not in rules:
        missing.append(name)

checks = {
    'Part 1 completion marker': SECTION_MARKER in rules,
    'default deny remains': 'match /{document=**}' in rules and 'allow read, write: if false;' in rules,
    'background check path remains': 'match /checkLogs/{checkId}' in rules and 'canRunChecks(' in rules,
    'notifications recipient-scoped': 'resource.data.userId == request.auth.uid' in rules,
    'private notes org-scoped': 'canManageTalent(resource.data.organizationId)' in rules,
    'reserved collections sealed': rules.count('allow read, write: if false;') >= 5,
}
failed = [label for label, ok in checks.items() if not ok]
if missing:
    failed.append('missing explicit matches: ' + ', '.join(missing))

if failed:
    raise RuntimeError('Main Firestore Part 1 finalization failed: ' + '; '.join(failed))

RULES_PATH.write_text(rules, encoding='utf-8')
print(f'Finalized Main Cognitus Firestore Part 1. Source bytes: {RULES_PATH.stat().st_size}')
