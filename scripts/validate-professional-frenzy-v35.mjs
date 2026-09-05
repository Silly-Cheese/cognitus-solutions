import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const files = {
  entry: read("src/promotionalAccessV26.js"),
  professional: read("src/professionalCoreV35.js"),
  professionalCss: read("src/professionalCoreV35.css"),
  frenzy: read("src/frenzyV35.js"),
  frenzyCss: read("src/frenzyV35.css"),
  signalContrast: read("src/frenzySignalOverrideV35.css"),
  signalContrastJs: read("src/frenzySignalOverrideV35.js"),
  registry: read("src/promo/promotionalRegistryV35.js"),
  features: read("src/promo/promotionalFeaturesV35.js"),
  nav: read("src/promo/promotionalNavigationV27.js"),
  mobile: read("src/promo/promotionalMobileV29.js"),
  rules: read("firestore.rules")
};

const checks = [];
function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

check("production entry starts the professional V35 contract", files.entry.includes("startProfessionalCoreV35()"));
check("production entry starts Frenzy V35", files.entry.includes("startFrenzyV35()"));
check("production entry registers Signal Zero", files.entry.includes("startPromotionalRegistryV35()"));
check("production entry uses the V35 feature renderer", files.entry.includes("renderFeaturePageV35"));
check("production entry loads Signal Zero contrast authority", files.entry.includes('import "./frenzySignalOverrideV35.js"'));

check("professional contract applies a single Cognitus visual class", files.professional.includes('classList.add("cognitus-professional")'));
check("professional contract renames Relationship Mapping", files.professional.includes('name: "Relationship Analysis"'));
check("professional contract renames Deep History", files.professional.includes('name: "Historical Record Analysis"'));
check("professional contract removes oversized operational headings", files.professionalCss.includes("cognitus-operational .hero h1"));
check("professional contract standardizes promo workspaces", files.professionalCss.includes("promo26-feature-section"));
check("professional contract includes reduced-motion handling", files.professionalCss.includes("prefers-reduced-motion"));

check("Frenzy uses the existing settings/portal document", files.frenzy.includes('PORTAL_COLLECTION = "settings"') && files.frenzy.includes('PORTAL_DOC = "portal"'));
check("Frenzy activation requires Owner authority", files.frenzy.includes('userRecord?.role === "owner"'));
check("Executive_Eagle has a dedicated route", files.frenzy.includes('EXECUTIVE_ROUTE = "/executive"') && files.frenzy.includes('EXECUTIVE_HANDLE = "Executive_Eagle"'));
check("Frenzy activation has a finite configured end time", files.frenzy.includes("endsAt: Fire.Timestamp.fromMillis"));
check("Frenzy supports live level control", files.frenzy.includes("setFrenzyLevel"));
check("Frenzy supports announcements", files.frenzy.includes("sendAnnouncement"));
check("Frenzy supports event drops", files.frenzy.includes("updateDrop"));
check("Frenzy actions write audit records", files.frenzy.includes('targetType: "frenzy_event"'));
check("Frenzy UI is responsive", files.frenzyCss.includes("@media (max-width: 560px)"));

check("Signal Zero is a promotional feature", files.registry.includes('id: "signal_zero"'));
check("Signal Zero has its own route", files.registry.includes('route: "/signal-zero"'));
check("Signal Zero is explicitly Frenzy-exclusive", files.registry.includes("FRENZY EXCLUSIVE"));
check("Signal Zero requires an active Frenzy window", files.features.includes("!current.effectiveActive || !current.signalZeroEnabled"));
check("Signal Zero uses screening summaries for ordinary promo users", files.features.includes('"screeningReportSummaries"'));
check("Signal Zero uses full reports only for reviewer roles", files.features.includes("REVIEWER_ROLES"));
check("Signal Zero explains that convergence is not a risk score", files.features.includes("not a risk score"));
check("Signal Zero dark forms outrank the global professional contract", files.signalContrast.includes("body.cognitus-professional.cognitus-frenzy-active .signal35-panel input"));
check("Signal Zero contrast authority is mounted as a stylesheet", files.signalContrastJs.includes("frenzySignalOverrideV35.css"));

check("desktop promotional navigation is consolidated under Intelligence", files.nav.includes("Analysis & research") && !files.nav.includes('class="nav20-primary-link promo27-primary'));
check("mobile promotional navigation is consolidated under Intelligence", files.mobile.includes("<p>Intelligence</p>") && !files.mobile.includes("nav29-promo-primary"));
check("Owner navigation exposes Executive Control", files.nav.includes("Executive Control") && files.mobile.includes("Executive Control"));

const openBraces = (files.rules.match(/\{/g) || []).length;
const closeBraces = (files.rules.match(/\}/g) || []).length;
check("Firestore rules have balanced braces", openBraces === closeBraces);
check("Frenzy reuses a publicly readable portal settings document", files.rules.includes("match /settings/portal") && files.rules.includes("allow read: if true;"));
check(
  "portal settings remain Owner-write controlled",
  files.rules.includes("allow create: if isOwner()")
    && files.rules.includes("allow update: if isOwner()")
    && files.rules.includes("validPortalSettings(request.resource.data)")
    && files.rules.includes("allow delete: if false;")
);
check("repository still has default-deny Firestore boundary", files.rules.includes("match /{document=**}") && files.rules.includes("allow read, write: if false;"));

let failed = 0;
for (const item of checks) {
  if (item.ok) console.log(`PASS: ${item.name}`);
  else {
    failed += 1;
    console.error(`FAIL: ${item.name}`);
  }
}

if (failed) {
  console.error(`\nProfessional/Frenzy V35 validation failed: ${failed} check(s).`);
  process.exit(1);
}
console.log(`\nProfessional/Frenzy V35 validation passed (${checks.length} checks).`);
