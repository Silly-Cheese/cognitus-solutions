import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
};

const index = read("index.html");
const app = read("src/app.js");
const rules = read("firestore.rules");
const firebase = JSON.parse(read("firebase.json"));
const indexes = JSON.parse(read("firestore.indexes.json"));

assert(index.includes('src/app.js?v='), "index.html loads the consolidated production router");
assert(!index.includes("appV1.js") && !index.includes("appSafe.js"), "legacy routers are not production entrypoints");
assert(!app.includes("OWNER_BOOTSTRAP") && !app.includes("ownerDiscordId"), "production app contains no client owner-bootstrap credential");
assert(app.includes('current === "/owner-bootstrap"') && app.includes("Client-side bootstrap has been retired"), "legacy bootstrap route is explicitly non-operational");
assert(app.includes('identityStatus: "self_declared"') && app.includes("identityConfidence: 0"), "new registrations do not claim verified identity");
assert(app.includes("resultCount: results.length") && app.includes("results.length === 1"), "search only attaches a target when exactly one record matches");

assert(rules.includes("currentUser().status == 'active'"), "privileged rule evaluation requires an active account");
assert(rules.includes("resource.data.role != 'owner'") && rules.includes("request.resource.data.role != 'owner'"), "admins cannot modify or create Owner role through user updates");
assert(rules.includes("request.resource.data.discordId == resource.data.discordId"), "Discord identity is immutable on user updates");
assert(rules.includes("request.resource.data.professionalStanding == resource.data.professionalStanding"), "self profile updates cannot rewrite professional standing");
assert(rules.includes("request.resource.data.riskLevel == resource.data.riskLevel"), "self profile updates cannot rewrite risk level");
assert(rules.includes("match /settings/bootstrap") && rules.includes("allow write: if false;"), "client-side owner bootstrap writes are disabled");
assert(rules.includes("match /passwordResetRequests") && rules.includes("allow read, write: if false;"), "public Firestore password-reset tickets are disabled");
assert(rules.includes("changedKeys().hasOnly") && rules.includes("'summary', 'details'"), "review workflows protect original report submission fields");
assert((rules.match(/{/g) || []).length === (rules.match(/}/g) || []).length, "Firestore rules have balanced braces");

assert(firebase?.firestore?.rules === "firestore.rules", "firebase.json points to Firestore rules");
assert(firebase?.firestore?.indexes === "firestore.indexes.json", "firebase.json points to Firestore indexes");
assert(Array.isArray(indexes.indexes) && indexes.indexes.length >= 8, "required composite indexes are declared");

if (process.exitCode) {
  console.error("\nCognitus validation failed.");
  process.exit(process.exitCode);
}

console.log("\nCognitus secure V2 validation passed.");
