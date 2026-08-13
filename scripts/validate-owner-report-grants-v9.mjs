import fs from "node:fs";

const nav = fs.readFileSync("src/navigationEnhancements.js", "utf8");
const grants = fs.readFileSync("src/ownerReportGrantsV9.js", "utf8");
const css = fs.readFileSync("src/ownerReportGrantsV9.css", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");

const checks = [
  [nav.includes('import "./ownerReportGrantsV9.js"'), "production navigation loads Owner Report Grants V9"],
  [grants.includes('userDoc?.role === "owner"'), "direct grant controls are Owner-gated"],
  [grants.includes('ownerGrantId = (reportId, uid) => `${reportId}__${uid}`'), "Owner grants use deterministic report/user IDs"],
  [grants.includes('"ownerReportAccessGrants"'), "Owner grants use an independent protected collection"],
  [grants.includes('readWhere("ownerReportAccessGrants", "granteeUid", "==", authUser.uid)'), "recipients discover Owner grants through one single-field query"],
  [grants.includes('readWhere("ownerReportAccessGrants", "subjectProfileId", "==", authUser.uid)'), "subjects can see Owner-issued access to their reports"],
  [grants.includes("Granted directly by Cognitus Owner") && grants.includes("Owner-authorized Access"), "Owner grants are visibly labeled to recipients and subjects"],
  [grants.includes("OWNER_REPORT_ACCESS_GRANTED") && grants.includes("OWNER_REPORT_ACCESS_REVOKED"), "Owner grant and revoke actions are audited"],
  [grants.includes('status: "revoked"') && !grants.includes("preserveOwnerAuthorization"), "Owner revocation is independent and no timing workaround remains"],
  [grants.includes("migrateLegacyOwnerGrants") && grants.includes("legacyOwnerUids"), "legacy Owner markers are migrated into protected Owner grants"],
  [!grants.includes("orderBy("), "Owner grant workflow introduces no ordered/composite query"],
  [!grants.includes("MutationObserver"), "Owner grant workflow remains observer-free"],
  [rules.includes("function hasOwnerReportGrant(reportId)") && rules.includes("ownerReportAccessGrants"), "Firestore checks Owner authorization independently from subject grants"],
  [rules.includes("function hasReportGrant(reportId)") && rules.includes("hasSubjectReportGrant(reportId) || hasOwnerReportGrant(reportId)"), "full report access accepts either subject or Owner authority"],
  [rules.includes("match /ownerReportAccessGrants/{grantId}") && rules.includes("allow create: if isOwner()") && rules.includes("allow update: if isOwner()"), "only Owners can create or change Owner grants"],
  [rules.includes("resource.data.granteeUid == request.auth.uid") && rules.includes("ownsProfile(resource.data.subjectProfileId)"), "recipients and report subjects can see Owner grant records without being able to change them"],
  [rules.includes("('owner:' + request.auth.uid) in get(reportGrantPath(reportId)).data.approvedUids"), "legacy Owner markers continue authorizing access until migrated"],
  [css.includes(".v9-owner-panel") && css.includes("@media(max-width:760px)"), "Owner grant controls include responsive styling"]
];

let failed = false;
for (const [ok, message] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${message}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("\nOwner Report Grants V9 precedence validation passed.");
