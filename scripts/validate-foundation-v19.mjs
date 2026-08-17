import fs from "node:fs";

const core = fs.readFileSync("src/foundationCoreV19.js", "utf8");
const peopleSearch = fs.readFileSync("src/employerPeopleSearchV18.js", "utf8");
const builder = fs.readFileSync("scripts/build-firestore-v19.mjs", "utf8");
const css = fs.readFileSync("src/foundationV19.css", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`Foundation V19 validation failed: ${message}`);
}

for (const route of [
  "/actions",
  "/people/master",
  "/people-integrity",
  "/employer/members",
  "/system-health",
  "/audit",
  "/privacy-center"
]) assert(core.includes(`"${route}"`), `missing Foundation route ${route}`);

assert(peopleSearch.startsWith('import "./foundationCoreV19.js";'), "Foundation Core must load through the production V18 module chain");
assert(peopleSearch.includes("Master Record"), "Employer People Search must expose the Master Record");
assert(peopleSearch.includes("mergedIntoProfileId"), "Employer People Search must resolve merged profiles to their canonical person");

for (const forbidden of ["MutationObserver", "Fire.orderBy(", "firestore.indexes.json"]) {
  assert(!core.includes(forbidden), `Foundation Core contains forbidden ${forbidden}`);
  assert(!builder.includes(forbidden), `rules builder contains forbidden ${forbidden}`);
}

for (const permission of ["runChecks", "manageTalent", "addEmploymentRecords", "requestReports", "manageMembers"]) {
  assert(core.includes(permission), `missing organization permission ${permission}`);
  assert(builder.includes(permission), `rules builder does not enforce ${permission}`);
}

for (const collection of ["organizationMembers", "privacyRequests", "profileMergeMap"]) {
  assert(core.includes(collection), `Foundation Core does not use ${collection}`);
  assert(builder.includes(collection), `rules builder does not secure ${collection}`);
}

for (const helper of ["canRunChecks", "canManageTalent", "canAddEmploymentRecords", "canRequestReports", "canManageMembers"]) {
  assert(builder.includes(`function ${helper}`), `rules builder missing ${helper}`);
}

assert(core.includes("PROFILE_MERGED"), "profile merges must be audited");
assert(core.includes("mergedIntoProfileId"), "profile merge must preserve source provenance");
assert(core.includes("profileMergeMap"), "profile merge must create canonical merge mapping");
assert(!/mergeExecute[\s\S]*?professionalStanding\s*:/.test(core), "merge execution must not overwrite Professional Standing");
assert(!/mergeExecute[\s\S]*?riskLevel\s*:/.test(core), "merge execution must not overwrite Risk Level");

assert(core.includes("Action Center"), "Action Center is missing");
assert(core.includes("Audit Center"), "Audit Center is missing");
assert(core.includes("System Health"), "System Health is missing");
assert(core.includes("Data & Privacy"), "Data & Privacy is missing");
assert(core.includes("Retention policy"), "retention controls are missing");
assert(core.includes("Organization Members"), "organization member management is missing");
assert(core.includes("Canonical Person Record"), "person Master Record is missing");
assert(core.includes("private candidate notes") || core.includes("private employer"), "Master Record must explicitly preserve private employer data boundaries");

assert(core.includes('Fire.where("createdAt",">="'), "Audit date search must remain a simple indexed range query");
assert(core.includes("Fire.limit(500)"), "Audit Center must bound result volume");
assert(!core.includes("readAll(\"auditLogs\")"), "Audit Center must not load the entire audit log by default");

assert(css.includes(".f19-ops-menu"), "Foundation operations navigation styling is missing");
assert(css.includes("@media(max-width:720px)"), "Foundation mobile styling is missing");

assert(!fs.existsSync("firestore.indexes.json"), "manual/composite Firestore index file must not exist");
assert(fs.existsSync("firebase.v19.json"), "Foundation Firebase rules config is missing");
assert(fs.existsSync("deploy-rules-v19.cmd"), "one-command V19 rules deploy helper is missing");

console.log("Foundation V19 regression checks passed.");
