import fs from "node:fs";

const nav = fs.readFileSync("src/navigationEnhancements.js", "utf8");
const app = fs.readFileSync("src/employerStatusV10.js", "utf8");
const css = fs.readFileSync("src/employerStatusV10.css", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");

const checks = [
  [nav.includes('import "./employerStatusV10.js"'), "production navigation loads Employer Status V10"],
  [nav.includes('href: "#/employer-status"') && nav.includes("ensureEmployerStatusTab"), "Employer Status appears in authenticated navigation"],
  [app.includes('route() !== "/employer-status"'), "Employer Status has a dedicated application route"],
  [app.includes('verificationStatus === "verified"'), "application organization picker is limited to verified organizations"],
  [app.includes('Fire.doc(db, "employerStatusRequests", authUser.uid)'), "each account uses one trackable employer status request"],
  [app.includes('status: "pending"') && app.includes("Withdraw Request") && app.includes("Resubmit Application"), "request lifecycle supports pending, withdrawal, and reapplication"],
  [app.includes('role: "verified_employer_member"') && app.includes("organizationId: request.organizationId"), "approval assigns employer role and selected organization"],
  [app.includes("Fire.writeBatch(db)") && app.includes('batch.update(Fire.doc(db, "employerStatusRequests"') && app.includes('batch.update(Fire.doc(db, "users"'), "approval changes request and account atomically"],
  [app.includes('readWhere("employerStatusRequests", "status", "==", "pending")'), "staff queue uses one automatic single-field equality query"],
  [app.includes("EMPLOYER_STATUS_REQUESTED") && app.includes("EMPLOYER_STATUS_APPROVED") && app.includes("EMPLOYER_STATUS_DENIED"), "application and decisions are audit logged"],
  [rules.includes("match /employerStatusRequests/{requestId}"), "Firestore has dedicated employer request rules"],
  [rules.includes("requestId == request.auth.uid") && rules.includes("validCognitusId(request.resource.data.cognitusId, 'EMP')"), "applicant request identity is bound to the authenticated account"],
  [rules.includes("get(organizationPath(request.resource.data.organizationId)).data.verificationStatus == 'verified'"), "rules enforce verified organization selection"],
  [rules.includes("getAfter(userPath(resource.data.applicantUid)).data.role == 'verified_employer_member'") && rules.includes("getAfter(userPath(resource.data.applicantUid)).data.organizationId == resource.data.organizationId"), "approved request requires matching account promotion in the same write"],
  [!app.includes("orderBy("), "Employer Status introduces no ordered/composite query"],
  [!app.includes("MutationObserver"), "Employer Status remains observer-free"],
  [css.includes("@media(max-width:620px)") && css.includes(".emp10-hero"), "Employer Status includes mobile-first responsive styling"]
];

let failed = false;
for (const [ok, message] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${message}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("\nEmployer Status V10 validation passed.");
