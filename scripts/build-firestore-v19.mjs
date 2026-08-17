import fs from "node:fs";

const sourcePath = "firestore.rules";
const outputPath = "firestore.v19.rules";
let rules = fs.readFileSync(sourcePath, "utf8");

function fail(message) {
  throw new Error(`Foundation V19 rules build failed: ${message}`);
}

function replaceOnce(needle, replacement, label) {
  const index = rules.indexOf(needle);
  if (index < 0) fail(`missing ${label}`);
  if (rules.indexOf(needle, index + needle.length) >= 0) fail(`ambiguous ${label}`);
  rules = rules.slice(0, index) + replacement + rules.slice(index + needle.length);
}

function transformMatch(marker, transform) {
  const startNeedle = `    match /${marker}`;
  const start = rules.indexOf(startNeedle);
  if (start < 0) fail(`missing match /${marker}`);
  const next = rules.indexOf("\n    match /", start + startNeedle.length);
  const end = next < 0 ? rules.lastIndexOf("\n  }\n}") : next;
  if (end < 0) fail(`could not bound match /${marker}`);
  const original = rules.slice(start, end);
  const updated = transform(original);
  if (updated === original) fail(`match /${marker} was not transformed`);
  rules = rules.slice(0, start) + updated + rules.slice(end);
}

const memberHelpers = `    function organizationMemberPath(orgId, uid) {
      return /databases/$(database)/documents/organizationMembers/$(orgId + '__' + uid);
    }

    function hasOrganizationMember(orgId) {
      return activeAccount()
        && orgId != null
        && exists(organizationMemberPath(orgId, request.auth.uid));
    }

    function activeOrganizationMember(orgId) {
      return hasOrganizationMember(orgId)
        && get(organizationMemberPath(orgId, request.auth.uid)).data.memberStatus == 'active';
    }

    function canRunChecks(orgId) {
      return isAdmin()
        || (sameOrg(orgId) && (
          role() in ['org_admin', 'reviewer']
          || !hasOrganizationMember(orgId)
          || (activeOrganizationMember(orgId)
            && get(organizationMemberPath(orgId, request.auth.uid)).data.permissions.runChecks == true)
        ));
    }

    function canManageTalent(orgId) {
      return isAdmin()
        || (sameOrg(orgId) && (
          role() in ['org_admin', 'reviewer']
          || !hasOrganizationMember(orgId)
          || (activeOrganizationMember(orgId)
            && get(organizationMemberPath(orgId, request.auth.uid)).data.permissions.manageTalent == true)
        ));
    }

    function canAddEmploymentRecords(orgId) {
      return isAdmin()
        || (sameOrg(orgId) && (
          role() in ['org_admin', 'reviewer']
          || !hasOrganizationMember(orgId)
          || (activeOrganizationMember(orgId)
            && get(organizationMemberPath(orgId, request.auth.uid)).data.permissions.addEmploymentRecords == true)
        ));
    }

    function canRequestReports(orgId) {
      return isAdmin()
        || (sameOrg(orgId) && (
          role() in ['org_admin', 'reviewer']
          || !hasOrganizationMember(orgId)
          || (activeOrganizationMember(orgId)
            && get(organizationMemberPath(orgId, request.auth.uid)).data.permissions.requestReports == true)
        ));
    }

    function canManageMembers(orgId) {
      return isAdmin()
        || (sameOrg(orgId) && (
          role() == 'org_admin'
          || (activeOrganizationMember(orgId)
            && get(organizationMemberPath(orgId, request.auth.uid)).data.permissions.manageMembers == true)
        ));
    }

`;

replaceOnce(
  "    function validDiscordId(value) {",
  memberHelpers + "    function validDiscordId(value) {",
  "member permission helper insertion point"
);

transformMatch("checkLogs/{checkId}", (segment) => segment.replace(
  "      allow create: if activeAccount()\n        && request.resource.data.keys().hasOnly([",
  "      allow create: if activeAccount()\n        && (request.resource.data.organizationId == null || canRunChecks(request.resource.data.organizationId))\n        && request.resource.data.keys().hasOnly(["
));

transformMatch("reportAccessRequests/{requestId}", (segment) => segment.replace(
  "      allow create: if isEmployerMember()\n        && request.resource.data.keys().hasOnly([",
  "      allow create: if canRequestReports(currentUser().organizationId)\n        && request.resource.data.keys().hasOnly(["
));

transformMatch("employerCandidates/{candidateId}", (segment) => {
  let out = segment;
  out = out.replace(
    "      allow read: if isOwner()\n        || (isEmployerMember() && sameOrg(resource.data.organizationId));",
    "      allow read: if isOwner() || canManageTalent(resource.data.organizationId);"
  );
  out = out.replace(
    "      allow create: if isEmployerMember()\n        && sameOrg(request.resource.data.organizationId)\n        && request.resource.data.keys().hasOnly([",
    "      allow create: if canManageTalent(request.resource.data.organizationId)\n        && request.resource.data.keys().hasOnly(["
  );
  out = out.replace(
    "      allow update: if isEmployerMember()\n        && sameOrg(resource.data.organizationId)\n        && request.resource.data.diff(resource.data).changedKeys().hasOnly([",
    "      allow update: if canManageTalent(resource.data.organizationId)\n        && request.resource.data.diff(resource.data).changedKeys().hasOnly(["
  );
  out = out.replace(
    "      allow delete: if isOwner()\n        || (isEmployerMember() && sameOrg(resource.data.organizationId));",
    "      allow delete: if isOwner() || canManageTalent(resource.data.organizationId);"
  );
  return out;
});

transformMatch("employmentRecords/{recordId}", (segment) => {
  let out = segment;
  out = out.replace(
    "      allow create: if isEmployerMember()\n        && sameOrg(request.resource.data.organizationId)\n        && request.resource.data.keys().hasOnly([",
    "      allow create: if canAddEmploymentRecords(request.resource.data.organizationId)\n        && request.resource.data.keys().hasOnly(["
  );
  out = out.replace(
    "      allow update: if isEmployerMember()\n        && sameOrg(resource.data.organizationId)\n        && (resource.data.createdByUid == request.auth.uid || role() == 'org_admin' || isAdmin())",
    "      allow update: if canAddEmploymentRecords(resource.data.organizationId)\n        && (resource.data.createdByUid == request.auth.uid || role() == 'org_admin' || isAdmin())"
  );
  return out;
});

const foundationRules = `
    // Foundation V19: canonical identities, organization membership, privacy, and repair tooling.
    match /organizationMembers/{memberId} {
      allow read: if isAdmin()
        || (activeAccount() && sameOrg(resource.data.organizationId));

      allow create: if activeAccount()
        && request.resource.data.keys().hasOnly([
          'id', 'organizationId', 'organizationCognitusId', 'userUid', 'userCognitusId',
          'displayName', 'positionTitle', 'memberStatus', 'permissions', 'grantedByUid',
          'removalRequestedByUid', 'removalRequestedAt', 'removedByUid', 'removedAt',
          'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == memberId
        && memberId == request.resource.data.organizationId + '__' + request.resource.data.userUid
        && exists(organizationPath(request.resource.data.organizationId))
        && exists(userPath(request.resource.data.userUid))
        && get(userPath(request.resource.data.userUid)).data.organizationId == request.resource.data.organizationId
        && request.resource.data.organizationCognitusId == get(organizationPath(request.resource.data.organizationId)).data.cognitusId
        && request.resource.data.userCognitusId == get(userPath(request.resource.data.userUid)).data.cognitusId
        && request.resource.data.permissions is map
        && request.resource.data.permissions.keys().hasOnly([
          'runChecks', 'manageTalent', 'addEmploymentRecords', 'requestReports', 'manageMembers'
        ])
        && request.resource.data.permissions.runChecks is bool
        && request.resource.data.permissions.manageTalent is bool
        && request.resource.data.permissions.addEmploymentRecords is bool
        && request.resource.data.permissions.requestReports is bool
        && request.resource.data.permissions.manageMembers is bool
        && request.resource.data.memberStatus in ['active', 'pending', 'suspended', 'removal_requested', 'removed']
        && (
          (
            request.resource.data.userUid == request.auth.uid
            && sameOrg(request.resource.data.organizationId)
            && isEmployerMember()
            && request.resource.data.memberStatus == 'active'
            && request.resource.data.permissions.runChecks == true
            && request.resource.data.permissions.manageTalent == true
            && request.resource.data.permissions.addEmploymentRecords == true
            && request.resource.data.permissions.requestReports == true
            && request.resource.data.permissions.manageMembers == false
            && request.resource.data.grantedByUid == request.auth.uid
          )
          || canManageMembers(request.resource.data.organizationId)
        )
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if isAdmin()
        && request.resource.data.id == resource.data.id
        && request.resource.data.organizationId == resource.data.organizationId
        && request.resource.data.userUid == resource.data.userUid
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.permissions is map
        && request.resource.data.permissions.keys().hasOnly([
          'runChecks', 'manageTalent', 'addEmploymentRecords', 'requestReports', 'manageMembers'
        ])
        && request.resource.data.memberStatus in ['active', 'pending', 'suspended', 'removal_requested', 'removed']
        && request.resource.data.updatedAt == request.time;

      allow update: if canManageMembers(resource.data.organizationId)
        && sameOrg(resource.data.organizationId)
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'displayName', 'positionTitle', 'memberStatus', 'permissions',
          'removalRequestedByUid', 'removalRequestedAt', 'updatedAt'
        ])
        && request.resource.data.id == resource.data.id
        && request.resource.data.organizationId == resource.data.organizationId
        && request.resource.data.userUid == resource.data.userUid
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.permissions is map
        && request.resource.data.permissions.manageMembers == resource.data.permissions.manageMembers
        && request.resource.data.memberStatus in ['active', 'suspended', 'removal_requested']
        && request.resource.data.updatedAt == request.time;

      allow delete: if isOwner();
    }

    match /privacyRequests/{privacyId} {
      allow read: if isAdmin()
        || (signedIn() && resource.data.requesterUid == request.auth.uid);

      allow create: if activeAccount()
        && request.resource.data.keys().hasOnly([
          'id', 'cognitusId', 'requesterUid', 'requesterCognitusId', 'requestType',
          'statement', 'status', 'reviewedByUid', 'reviewerNotes', 'decidedAt',
          'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == privacyId
        && validCognitusId(request.resource.data.cognitusId, 'PVR')
        && request.resource.data.requesterUid == request.auth.uid
        && request.resource.data.requesterCognitusId == currentUser().cognitusId
        && request.resource.data.requestType in ['correction', 'deletion', 'data_review']
        && shortString(request.resource.data.statement, 3000)
        && request.resource.data.statement.size() >= 10
        && request.resource.data.status == 'pending'
        && request.resource.data.reviewedByUid == null
        && request.resource.data.reviewerNotes == ''
        && request.resource.data.decidedAt == null
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if isAdmin()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'reviewedByUid', 'reviewerNotes', 'decidedAt', 'updatedAt'
        ])
        && request.resource.data.status in ['pending', 'accepted', 'denied', 'completed']
        && request.resource.data.reviewedByUid == request.auth.uid
        && shortString(request.resource.data.reviewerNotes, 1500)
        && request.resource.data.decidedAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow delete: if isOwner() && resource.data.status == 'completed';
    }

    match /profileMergeMap/{sourceProfileId} {
      allow read: if activeAccount();
      allow create: if isOwner()
        && request.resource.data.keys().hasOnly([
          'sourceProfileId', 'targetProfileId', 'sourceCognitusId', 'targetCognitusId',
          'reason', 'mergedByUid', 'mergedAt'
        ])
        && request.resource.data.sourceProfileId == sourceProfileId
        && request.resource.data.sourceProfileId != request.resource.data.targetProfileId
        && exists(profilePath(request.resource.data.sourceProfileId))
        && exists(profilePath(request.resource.data.targetProfileId))
        && request.resource.data.sourceCognitusId == get(profilePath(request.resource.data.sourceProfileId)).data.cognitusId
        && request.resource.data.targetCognitusId == get(profilePath(request.resource.data.targetProfileId)).data.cognitusId
        && request.resource.data.mergedByUid == request.auth.uid
        && shortString(request.resource.data.reason, 1000)
        && request.resource.data.mergedAt == request.time;
      allow update, delete: if false;
    }

    // Owner-only canonical profile creation/repair and merge metadata.
    match /profiles/{profileId} {
      allow create: if isOwner()
        && exists(userPath(profileId))
        && request.resource.data.id == profileId
        && request.resource.data.linkedUserId == profileId
        && request.resource.data.claimedByUid == profileId
        && request.resource.data.discordIds == [get(userPath(profileId)).data.discordId]
        && request.resource.data.type == 'person'
        && validCognitusId(request.resource.data.cognitusId, 'PRF')
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if isOwner()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'displayName', 'discordUsernames', 'discordUsernamesNormalized', 'discordIds',
          'robloxUsernames', 'robloxUsernamesNormalized', 'knownAliases', 'canonicalProfileId',
          'mergedIntoProfileId', 'mergedAt', 'mergedByUid', 'identityStatus', 'updatedAt'
        ])
        && request.resource.data.cognitusId == resource.data.cognitusId
        && request.resource.data.id == resource.data.id
        && request.resource.data.updatedAt == request.time;
    }

    // Owner-only profile-reference rewrites used by the merge tool.
    match /reports/{reportId} {
      allow update: if isOwner()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['subjectProfileId', 'updatedAt'])
        && request.resource.data.subjectOrganizationId == resource.data.subjectOrganizationId
        && request.resource.data.subjectProfileId != null
        && exists(profilePath(request.resource.data.subjectProfileId))
        && request.resource.data.updatedAt == request.time;
    }

    match /screeningReportSummaries/{summaryId} {
      allow update: if isOwner()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['subjectProfileId', 'updatedAt'])
        && request.resource.data.subjectProfileId != null
        && exists(profilePath(request.resource.data.subjectProfileId))
        && request.resource.data.updatedAt == request.time;
    }

    match /employmentRecords/{recordId} {
      allow update: if isOwner()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['profileId', 'profileCognitusId', 'updatedAt'])
        && exists(profilePath(request.resource.data.profileId))
        && request.resource.data.profileCognitusId == get(profilePath(request.resource.data.profileId)).data.cognitusId
        && request.resource.data.updatedAt == request.time;
    }

    match /employmentRecordDisputes/{disputeId} {
      allow update: if isOwner()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['profileId', 'updatedAt'])
        && exists(profilePath(request.resource.data.profileId))
        && request.resource.data.updatedAt == request.time;
    }

    match /reportAccessRequests/{requestId} {
      allow update: if isOwner()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['subjectProfileId', 'updatedAt'])
        && exists(profilePath(request.resource.data.subjectProfileId))
        && request.resource.data.updatedAt == request.time;
    }

    match /reportAccessGrants/{reportId} {
      allow update: if isOwner()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['subjectProfileId', 'updatedAt'])
        && exists(profilePath(request.resource.data.subjectProfileId))
        && request.resource.data.updatedAt == request.time;
    }

    match /claims/{claimId} {
      allow update: if isOwner()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['profileId', 'updatedAt'])
        && exists(profilePath(request.resource.data.profileId))
        && request.resource.data.updatedAt == request.time;
    }

    match /appeals/{appealId} {
      allow update: if isOwner()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['profileId', 'updatedAt'])
        && exists(profilePath(request.resource.data.profileId))
        && request.resource.data.updatedAt == request.time;
    }

    match /checkLogs/{checkId} {
      allow update: if isOwner()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['targetProfileId', 'updatedAt'])
        && request.resource.data.targetProfileId != null
        && exists(profilePath(request.resource.data.targetProfileId))
        && request.resource.data.updatedAt == request.time;
    }

    match /employerCandidates/{candidateId} {
      allow create: if isOwner()
        && request.resource.data.id == candidateId
        && candidateId == request.resource.data.organizationId + '__' + request.resource.data.profileId
        && exists(profilePath(request.resource.data.profileId))
        && exists(organizationPath(request.resource.data.organizationId))
        && request.resource.data.profileCognitusId == get(profilePath(request.resource.data.profileId)).data.cognitusId
        && request.resource.data.profileDisplayName == get(profilePath(request.resource.data.profileId)).data.displayName
        && validPipelineStatus(request.resource.data.pipelineStatus)
        && shortString(request.resource.data.privateNotes, 3000)
        && request.resource.data.updatedAt == request.time;

      allow update: if isOwner()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['pipelineStatus', 'privateNotes', 'updatedAt'])
        && validPipelineStatus(request.resource.data.pipelineStatus)
        && shortString(request.resource.data.privateNotes, 3000)
        && request.resource.data.updatedAt == request.time;
    }

`;

const catchAll = "    match /{document=**} {\n      allow read, write: if false;\n    }";
replaceOnce(catchAll, foundationRules + catchAll, "catch-all insertion point");

fs.writeFileSync(outputPath, rules);
console.log(`Foundation V19 rules built: ${outputPath}`);
