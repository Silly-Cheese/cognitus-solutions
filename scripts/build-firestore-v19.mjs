import fs from "node:fs";

const sourcePath = "firestore.rules";
const outputPath = "firestore.v19.rules";
let rules = fs.readFileSync(sourcePath, "utf8");

function fail(message) {
  throw new Error(`Foundation V19 rules build failed: ${message}`);
}

// firestore.rules is now the canonical deploy-ready ruleset. Older repository
// revisions used it as the pre-V19 source. Keep this builder compatible with
// both layouts so CI/deployment can safely run it more than once.
if (rules.includes("Foundation V19: canonical identities, organization membership, privacy, and repair tooling.")) {
  fs.writeFileSync(outputPath, rules);
  console.log("Foundation V19 rules already present; copied canonical firestore.rules to firestore.v19.rules.");
  process.exit(0);
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
            && request.resource.data.memberStatus in ['active', 'pending']
            && request.resource.data.permissions.runChecks == false
            && request.resource.data.permissions.manageTalent == false
            && request.resource.data.permissions.addEmploymentRecords == false
            && request.resource.data.permissions.requestReports == false
            && request.resource.data.permissions.manageMembers == false
            && request.resource.data.grantedByUid == null
          )
          || canManageMembers(request.resource.data.organizationId)
        )
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if canManageMembers(resource.data.organizationId)
        && request.resource.data.id == resource.data.id
        && request.resource.data.organizationId == resource.data.organizationId
        && request.resource.data.userUid == resource.data.userUid
        && request.resource.data.organizationCognitusId == resource.data.organizationCognitusId
        && request.resource.data.userCognitusId == resource.data.userCognitusId
        && request.resource.data.permissions is map
        && request.resource.data.permissions.keys().hasOnly([
          'runChecks', 'manageTalent', 'addEmploymentRecords', 'requestReports', 'manageMembers'
        ])
        && request.resource.data.memberStatus in ['active', 'pending', 'suspended', 'removal_requested', 'removed']
        && request.resource.data.updatedAt == request.time;

      allow update: if activeAccount()
        && resource.data.userUid == request.auth.uid
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'memberStatus', 'removalRequestedByUid', 'removalRequestedAt', 'updatedAt'
        ])
        && request.resource.data.memberStatus == 'removal_requested'
        && request.resource.data.removalRequestedByUid == request.auth.uid
        && request.resource.data.removalRequestedAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow delete: if isOwner();
    }

    match /privacySettings/{uid} {
      allow read: if isAdmin() || (activeAccount() && request.auth.uid == uid);
      allow create, update: if activeAccount()
        && request.auth.uid == uid
        && request.resource.data.keys().hasOnly([
          'uid', 'profileVisibility', 'showEmploymentHistory', 'showReportSummary',
          'showRiskAssessment', 'allowEmployerDiscovery', 'updatedAt'
        ])
        && request.resource.data.uid == uid
        && request.resource.data.profileVisibility in ['standard', 'limited']
        && request.resource.data.showEmploymentHistory is bool
        && request.resource.data.showReportSummary is bool
        && request.resource.data.showRiskAssessment is bool
        && request.resource.data.allowEmployerDiscovery is bool
        && request.resource.data.updatedAt == request.time;
      allow delete: if activeAccount() && request.auth.uid == uid;
    }

    match /accountRepairRequests/{repairId} {
      allow read: if isAdmin() || (activeAccount() && resource.data.uid == request.auth.uid);
      allow create: if activeAccount()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.status == 'pending'
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;
      allow update: if isAdmin()
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.status in ['pending', 'resolved', 'rejected']
        && request.resource.data.updatedAt == request.time;
      allow delete: if isOwner();
    }
`;

const closing = "\n  }\n}";
const closingIndex = rules.lastIndexOf(closing);
if (closingIndex < 0) fail("missing Firestore service closing braces");
rules = rules.slice(0, closingIndex) + foundationRules + rules.slice(closingIndex);

fs.writeFileSync(outputPath, rules);
console.log(`Foundation V19 rules written to ${outputPath}`);
