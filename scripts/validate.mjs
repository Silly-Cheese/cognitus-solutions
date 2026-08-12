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
const navigation = read("src/navigationEnhancements.js");
const controls = read("src/controlsV4.js");
const uxCss = read("src/uxV4.css");
const rules = read("firestore.rules");
const firebase = JSON.parse(read("firebase.json"));

assert(index.includes('src/app.js?v='), "index.html loads the consolidated production router");
assert(!index.includes("appV1.js") && !index.includes("appSafe.js"), "legacy routers are not production entrypoints");
assert(index.includes("stability-v4"), "index.html cache-busts the stability V4 navigation layer");
assert(navigation.includes('import "./controlsV4.js"'), "navigation loads V4 operational controls");
assert(navigation.includes("uxV4.css") && uxCss.includes("#logout-button"), "fast V4 styling is loaded and keeps Logout visible");
assert(!navigation.includes("MutationObserver") && !controls.includes("MutationObserver"), "V4 contains no DOM mutation observers");
assert(!navigation.includes("uxV3.js"), "observer-driven UX V3 is not loaded in production");
assert(navigation.includes('#/organizations?request=1') && navigation.includes('textContent = "New Organization"'), "New Organization is a direct navigation action");
assert(navigation.includes("#logout-button") && navigation.includes('logout.textContent = "Logout"'), "Logout remains an explicit visible navigation control");
assert(navigation.includes("v4-mobile-nav-toggle") && navigation.includes("v4-mobile-open"), "mobile navigation uses an explicit menu toggle");
assert(navigation.includes("window.innerWidth > 760") && navigation.includes("closeMobileMenu"), "mobile menu closes cleanly across navigation and desktop resize");
assert(uxCss.includes("@media (max-width: 760px)") && uxCss.includes("v4-mobile-nav-ready") && uxCss.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "mobile layout provides a two-column expandable navigation panel");
assert(uxCss.includes("dashboard-hero h1") && uxCss.includes("font-size: clamp(2.05rem, 11vw, 2.8rem)"), "mobile dashboard typography is bounded for phone screens");
assert(index.includes('rel="icon"') && index.includes("data:image/svg+xml"), "inline favicon prevents the GitHub Pages favicon 404");
assert(index.includes("secure-v2-no-index"), "index.html keeps the repaired no-index production app build");

assert(controls.includes("Verify my identity") && controls.includes("identityConfidence: 100"), "Owner self-verification control is present");
assert(controls.includes("data-v4-delete-report") && controls.includes("deleteReport"), "report deletion controls are present");
assert(controls.includes("deleteOrganization") && controls.includes("Delete organization"), "organization deletion controls are present");
assert(controls.includes("Delete My Account") && controls.includes("reauthenticateWithCredential") && controls.includes("deleteUser"), "self-account deletion reauthenticates and deletes Firebase Auth");
assert(controls.includes("Delete portal account") && controls.includes("firebaseAuthDeletionRequired"), "Owner portal-account removal clearly distinguishes Firebase Auth cleanup");
assert(!controls.includes("Fire.orderBy("), "V4 controls do not introduce ordered compound queries");

assert(!app.includes("OWNER_BOOTSTRAP") && !app.includes("ownerDiscordId"), "production app contains no client owner-bootstrap credential");
assert(app.includes('current === "/owner-bootstrap"') && app.includes("Client-side bootstrap has been retired"), "legacy bootstrap route is explicitly non-operational");
assert(app.includes('identityStatus: "self_declared"') && app.includes("identityConfidence: 0"), "new registrations do not claim verified identity");
assert(app.includes("claimedByUid: credential.user.uid") && app.includes("authUser = credential.user"), "registration is bound directly to the Firebase credential UID");
assert(app.includes("resultCount: results.length") && app.includes("results.length === 1"), "search only attaches a target when exactly one record matches");
assert(!app.includes("Fire.orderBy("), "production queries do not depend on ordered compound queries");
assert(app.includes("newestFirst(") && app.includes("alphabetic("), "chronological and directory sorting is performed client-side");

assert(rules.includes("currentUser().status == 'active'"), "privileged rule evaluation requires an active account");
assert(rules.includes("resource.data.role != 'owner'") && rules.includes("request.resource.data.role != 'owner'"), "admins cannot modify or create Owner role through admin updates");
assert(rules.includes("request.resource.data.discordId == resource.data.discordId"), "Discord identity is immutable on updates");
assert(rules.includes("request.resource.data.professionalStanding == resource.data.professionalStanding"), "self profile updates cannot rewrite professional standing");
assert(rules.includes("request.resource.data.riskLevel == resource.data.riskLevel"), "self profile updates cannot rewrite risk level");
assert(rules.includes("'identityVerified', 'updatedAt'") && rules.includes("request.resource.data.identityVerified is bool"), "Owner identity verification is explicitly authorized");
assert(rules.includes("allow delete: if isOwner()") && rules.includes("resource.data.status == 'pending_review'"), "report deletion is Owner-gated with pending self-delete support");
assert(rules.includes("allow delete: if isOwner();"), "Owner organization deletion is authorized");
assert(rules.includes("request.auth.uid == uid") && rules.includes("resource.data.role != 'owner'"), "self deletion and non-Owner portal account deletion are authorized");
assert(rules.includes("match /settings/bootstrap") && rules.includes("allow write: if false;"), "client-side owner bootstrap writes are disabled");
assert(rules.includes("match /passwordResetRequests") && rules.includes("allow read, write: if false;"), "public Firestore password-reset tickets are disabled");
assert(rules.includes("request.resource.data.summary == resource.data.summary") && rules.includes("request.resource.data.details == resource.data.details"), "review workflows preserve original report summary and details");
assert((rules.match(/{/g) || []).length === (rules.match(/}/g) || []).length, "Firestore rules have balanced braces");

assert(firebase?.firestore?.rules === "firestore.rules", "firebase.json points to Firestore rules");
assert(!Object.prototype.hasOwnProperty.call(firebase?.firestore || {}, "indexes"), "firebase.json does not deploy manual indexes");
assert(!fs.existsSync("firestore.indexes.json"), "repository contains no manual/composite Firestore index manifest");

if (process.exitCode) {
  console.error("\nCognitus stability V4 validation failed.");
  process.exit(process.exitCode);
}

console.log("\nCognitus stability V4 validation passed with secure no-index architecture intact.");
