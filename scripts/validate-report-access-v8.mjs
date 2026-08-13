import fs from "node:fs";

const access = fs.readFileSync("src/reportAccessV8.js", "utf8");
const css = fs.readFileSync("src/reportAccessV8.css", "utf8");
const nav = fs.readFileSync("src/navigationEnhancements.js", "utf8");
const rules = fs.readFileSync("firestore.rules", "utf8");

const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
};

assert(nav.includes('import "./reportAccessV8.js"'), "production navigation loads Report Access V8");
assert(nav.includes('href = "#/reports"') && nav.includes('textContent = "Reports"'), "Reports is a first-class authenticated destination");
assert(access.includes('route() !== "/reports"') && access.includes('route() !== "/reports/view"'), "V8 provides Reports hub and dedicated full-report routes");
assert(access.includes("Who has access") && access.includes("Approve Access") && access.includes("Revoke Access"), "subjects can see and manage full-report access");
assert(access.includes("Read complete report on this profile") && access.includes("Complete narrative"), "subjects can read full report narratives from their Profile page");
assert(access.includes("Request Full Report") && access.includes("requestReportAccess"), "employers can request a specific full report");
assert(access.includes("screeningReportSummaries") && access.includes("syncScreeningSummaries"), "screening summaries are separated from full report documents");
assert(access.includes('readWhere("reportAccessRequests", "requesterUid"') && access.includes('readWhere("reportAccessRequests", "subjectProfileId"'), "access dashboards use single-field queries");
assert(!access.includes("Fire.orderBy(") && !access.includes("MutationObserver"), "Report Access V8 adds no ordered compound queries or DOM observers");
assert(!access.includes("#/reports#who-has-access"), "Reports access links use a valid hash route");
assert(css.includes(".v8-full-report") && css.includes(".v8-access-dialog") && css.includes("@media(max-width:600px)"), "full report, access request, and mobile styling are present");
assert(css.includes("@media print"), "complete report pages have print styling");

assert(rules.includes("function hasReportGrant(reportId)"), "Firestore rules gate full person reports through explicit grants");
assert(rules.includes("match /screeningReportSummaries/{summaryId}"), "screening summary documents have dedicated rules");
assert(rules.includes("match /reportAccessRequests/{requestId}"), "report access requests have dedicated rules");
assert(rules.includes("match /reportAccessGrants/{reportId}"), "report grants have dedicated rules");
assert(rules.includes("resource.data.subjectOrganizationId != null") && rules.includes("hasReportGrant(reportId)"), "broad approved-report reads are retained only for organization reports while person reports require grants");
assert(rules.includes("requestId == request.resource.data.reportId + '__' + request.auth.uid"), "access request IDs are deterministic per report/requester");
assert(rules.includes("request.resource.data.approvedUids.size() <= 100"), "grant lists are bounded");
assert((rules.match(/{/g) || []).length === (rules.match(/}/g) || []).length, "Firestore rules remain brace-balanced");
assert(!fs.existsSync("firestore.indexes.json"), "no manual/composite index manifest exists");

if (process.exitCode) {
  console.error("\nReport Access V8 validation failed.");
  process.exit(process.exitCode);
}
console.log("\nReport Access V8 validation passed.");
