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
const assessment = read("src/assessmentV4.js");
const profileV5 = read("src/profileV5.js");
const profileCss = read("src/profileV5.css");
const uxCss = read("src/uxV4.css");
const rules = read("firestore.rules");
const firebase = JSON.parse(read("firebase.json"));

assert(index.includes('src/app.js?v='), "index.html loads the consolidated production router");
assert(!index.includes("appV1.js") && !index.includes("appSafe.js"), "legacy routers are not production entrypoints");
assert(index.includes('src/navigationEnhancements.js?v='), "index.html cache-busts the production navigation enhancement layer");
assert(navigation.includes('import "./controlsV4.js"'), "navigation loads V4 operational controls");
assert(navigation.includes('import "./assessmentV4.js"'), "navigation loads editable profile assessment controls");
assert(navigation.includes('import "./profileV5.js"'), "navigation loads Profile V5 and smart appeal workflows");
assert(navigation.includes("uxV4.css") && uxCss.includes("#logout-button"), "fast V4 styling is loaded and keeps Logout visible");
assert(!navigation.includes("MutationObserver") && !controls.includes("MutationObserver") && !assessment.includes("MutationObserver") && !profileV5.includes("MutationObserver"), "production enhancements contain no DOM mutation observers");
assert(!navigation.includes("uxV3.js"), "observer-driven UX V3 is not loaded in production");
assert(navigation.includes('#/organizations?request=1') && navigation.includes('textContent = "New Organization"'), "New Organization is a direct navigation action");
assert(navigation.includes('#/profile') && navigation.includes('textContent = "Profile"'), "authenticated navigation exposes the Profile page");
assert(navigation.includes("#logout-button") && navigation.includes('logout.textContent = "Logout"'), "Logout remains an explicit visible navigation control");
assert(navigation.includes("v4-mobile-nav-toggle") && navigation.includes("v4-mobile-open"), "mobile navigation uses an explicit menu toggle");
assert(navigation.includes("window.innerWidth > 760") && navigation.includes("closeMobileMenu"), "mobile menu closes cleanly across navigation and desktop resize");
assert(uxCss.includes("@media (max-width: 760px)") && uxCss.includes("v4-mobile-nav-ready") && uxCss.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "mobile layout provides a two-column expandable navigation panel");
assert(uxCss.includes("dashboard-hero h1") && uxCss.includes("font-size: clamp(2.05rem, 11vw, 2.8rem)"), "mobile dashboard typography is bounded for phone screens");
assert(index.includes('rel="icon"') && index.includes("data:image/svg+xml"), "inline favicon prevents the GitHub Pages favicon 404");
assert(index.includes("secure-v2-no-index") || index.includes("v38-promo-router"), "index.html keeps the repaired no-index production app build");

assert(controls.includes("Verify my identity") && controls.includes("identityConfidence: 100"), "Owner self-verification control is present");
assert(controls.includes("data-v4-delete-report") && controls.includes("deleteReport"), "report deletion controls are present");
assert(controls.includes("deleteOrganization") && controls.includes("Delete organization"), "organization deletion controls are present");
assert(controls.includes("Delete My Account") && controls.includes("reauthenticateWithCredential") && controls.includes("deleteUser"), "self-account deletion reauthenticates and deletes Firebase Auth");
assert(controls.includes("Delete portal account") && controls.includes("firebaseAuthDeletionRequired"), "Owner portal-account removal clearly distinguishes Firebase Auth cleanup");
assert(!controls.includes("Fire.orderBy("), "V4 controls do not introduce ordered compound queries");

assert(assessment.includes("Professional Standing") && assessment.includes("Risk Level"), "standing and risk are editable through explicit assessment controls");
assert(assessment.includes("PROFILE_ASSESSMENT_UPDATED") && assessment.includes("lastReviewedAt"), "assessment changes are timestamped and audited");
assert(assessment.includes('new Set(["reviewer", "admin", "owner"])'), "assessment editing is restricted to reviewer/admin/owner roles");
assert(assessment.includes("mountSettingsAssessment") && assessment.includes("mountAdminAssessments"), "assessment editing is available in Settings and Admin user management");
assert(!assessment.includes("Fire.orderBy("), "assessment controls do not introduce ordered compound queries");

assert(profileV5.includes('route() !== "/profile"') && profileV5.includes("Reports about you") && profileV5.includes("Professional Standing") && profileV5.includes("Risk Level"), "Profile V5 presents identity, standing, risk, and reports");
assert(profileV5.includes('readWhere("reports", "subjectProfileId", "==", authUser.uid)') && profileV5.includes('readWhere("appeals", "submittedByUid", "==", authUser.uid)'), "Profile V5 loads only the signed-in user’s reports and appeals with single-field queries");
assert(profileV5.includes('input type="hidden" name="profileId"') && profileV5.includes('select name="reportId"'), "appeals auto-attach the signed-in profile and use a report selector");
assert(profileV5.includes("#/appeals?report=") && profileV5.includes("Appeal this report"), "Profile report cards deep-link directly into the appeal flow");
assert(profileCss.includes(".v5-profile-hero") && profileCss.includes("@media (max-width: 760px)"), "Profile V5 has dedicated responsive styling");
assert(!profileV5.includes("Fire.orderBy("), "Profile V5 introduces no ordered compound queries");

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
assert(rules.includes("request.resource.data.professionalStanding == resource.data.professionalStanding"), "ordinary self profile updates cannot rewrite professional standing");
assert(rules.includes("request.resource.data.riskLevel == resource.data.riskLevel"), "ordinary self profile updates cannot rewrite risk level");
assert(rules.includes("'professionalStanding',") && rules.includes("'riskLevel',") && rules.includes("allow update: if isReviewer()"), "reviewer/admin/owner profile updates can manage standing and risk");
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
  console.error("\nCognitus Profile V5 validation failed.");
  process.exit(process.exitCode);
}

console.log("\nCognitus Profile V5 validation passed with secure no-index architecture intact.");
