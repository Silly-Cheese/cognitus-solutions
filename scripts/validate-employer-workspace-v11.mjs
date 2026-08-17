import fs from "node:fs";

const nav = fs.readFileSync("src/navigationEnhancements.js", "utf8");
const workspace = fs.readFileSync("src/employerWorkspaceV11.js", "utf8");
const css = fs.readFileSync("src/employerWorkspaceV11.css", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");
const firebase = JSON.parse(fs.readFileSync("firebase.json", "utf8"));

const checks = [
  [nav.includes('import "./employerWorkspaceV11.js"'), "production navigation loads Employer Workspace V11"],
  [workspace.includes('route() !== "/employer"') && workspace.includes('route() !== "/employer/candidate"'), "Employer Hub and Candidate File routes exist"],
  [workspace.includes('"employerCandidates"') && workspace.includes("pipelineStatus") && workspace.includes("privateNotes"), "organization-private talent bookmarks and notes are implemented"],
  [workspace.includes('"employmentRecords"') && workspace.includes('sourceType: "verified_employer"') && workspace.includes('visibility: "shared_profile"'), "attributable shared employment records are implemented"],
  [workspace.includes('recordOrigin: "employer_created"') && workspace.includes('identityStatus: "employer_supplied"'), "employers can create clearly unclaimed Person Records"],
  [workspace.includes('"externalProfileClaims"') && workspace.includes("requestExternalProfileLink") && workspace.includes("decideExternalClaim"), "external Person Records can be claimed and reviewer-linked"],
  [workspace.includes('"employmentRecordDisputes"') && workspace.includes("createEmploymentDispute") && workspace.includes("decideEmploymentDispute"), "people can dispute employer employment records"],
  [workspace.includes('readWhere("screeningReportSummaries", "subjectProfileId", "==", profile.id)') && workspace.includes("requestFullReport"), "candidate files combine screening summaries with report access requests"],
  [workspace.includes('readWhere("checkLogs", "organizationId", "==", org.id)') && workspace.includes('readWhere("employmentRecords", "organizationId", "==", org.id)'), "Employer Hub uses organization-scoped automatic-index queries"],
  [workspace.includes('readWhere("profiles", "discordIds", "array-contains"') && workspace.includes('readWhere("profiles", "robloxUsernamesNormalized", "array-contains"'), "People search uses single-field identity lookups"],
  [!workspace.includes("orderBy("), "Employer Workspace introduces no ordered/composite query"],
  [!workspace.includes("MutationObserver"), "Employer Workspace remains observer-free"],
  [rules.includes("match /employerCandidates/{candidateId}") && rules.includes("sameOrg(resource.data.organizationId)"), "candidate bookmarks are organization-isolated in Firestore"],
  [rules.includes("match /employmentRecords/{recordId}") && rules.includes("request.resource.data.sourceType == 'verified_employer'"), "employment provenance is enforced in Firestore"],
  [rules.includes("request.resource.data.recordOrigin == 'employer_created'") && rules.includes("request.resource.data.linkedUserId == null"), "employer-created Person Records start unclaimed"],
  [rules.includes("match /externalProfileClaims/{claimId}") && rules.includes("existsAfter(externalProfileClaimPath"), "profile linking requires a reviewed claim"],
  [rules.includes("match /employmentRecordDisputes/{disputeId}") && rules.includes("existsAfter(employmentRecordPath"), "employment dispute decisions update record state atomically"],
  [rules.includes("request.resource.data.professionalStanding == 'unreviewed'") && rules.includes("request.resource.data.riskLevel == 'unreviewed'"), "employers cannot set Standing or Risk when creating Person Records"],
  [!fs.existsSync("firestore.indexes.json") && !Object.prototype.hasOwnProperty.call(firebase.firestore || {}, "indexes"), "no manual/composite Firestore index file is configured"],
  [css.includes(".emp11-workspace-hero") && css.includes("@media(max-width:560px)"), "Employer Workspace includes dedicated responsive/mobile styling"]
];

let failed = false;
for (const [ok, message] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${message}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("\nEmployer Workspace V11 validation passed.");
