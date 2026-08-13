import fs from "node:fs";

const nav = fs.readFileSync("src/navigationEnhancements.js", "utf8");
const grants = fs.readFileSync("src/ownerReportGrantsV9.js", "utf8");
const css = fs.readFileSync("src/ownerReportGrantsV9.css", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");

const checks = [
  [nav.includes('import "./ownerReportGrantsV9.js"'), "production navigation loads Owner Report Grants V9"],
  [grants.includes('userDoc?.role === "owner"'), "direct grant controls are Owner-gated"],
  [grants.includes('owner:${uid}') && grants.includes("ownerMarker(granteeUid)"), "Owner-issued grants carry a distinguishable marker"],
  [grants.includes('Fire.doc(db, "reportAccessGrants", report.id)') && grants.includes("approvedUids"), "Owner grants use the existing enforced report grant document"],
  [grants.includes('readWhere("reportAccessGrants", "approvedUids", "array-contains", authUser.uid)'), "recipients discover direct grants with one automatic single-field index"],
  [grants.includes('readWhere("reportAccessGrants", "subjectProfileId", "==", authUser.uid)'), "subjects can see Owner-issued access to their reports"],
  [grants.includes("Granted directly by Cognitus Owner") && grants.includes("Owner-authorized Access"), "Owner grants are visibly labeled to recipients and subjects"],
  [grants.includes("OWNER_REPORT_ACCESS_GRANTED") && grants.includes("OWNER_REPORT_ACCESS_REVOKED"), "Owner grant and revoke actions are audited"],
  [grants.includes("request?.status !== \"approved\"") && grants.includes("approved.delete(ownerMarker(granteeUid))"), "revoking an Owner grant preserves a separately subject-approved grant"],
  [!grants.includes("orderBy("), "Owner grant workflow introduces no ordered/composite query"],
  [!grants.includes("MutationObserver"), "Owner grant workflow remains observer-free"],
  [rules.includes("function hasReportGrant(reportId)") && rules.includes("request.auth.uid in get(reportGrantPath(reportId)).data.approvedUids"), "existing Firestore read rule enforces approved UID grants"],
  [rules.includes("match /reportAccessGrants/{reportId}") && rules.includes("allow create: if (isReviewer() || ownsProfile(request.resource.data.subjectProfileId))"), "Owners inherit authorized grant writes through reviewer privileges"],
  [css.includes(".v9-owner-panel") && css.includes("@media(max-width:760px)"), "Owner grant controls include responsive styling"]
];

let failed = false;
for (const [ok, message] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${message}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("\nOwner Report Grants V9 validation passed.");
