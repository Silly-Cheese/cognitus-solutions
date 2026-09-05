import fs from "node:fs";

const rulesPath = "firestore.rules";
const builderPath = "scripts/build-promotional-rules-v26.mjs";
let rules = fs.readFileSync(rulesPath, "utf8");
let builder = fs.readFileSync(builderPath, "utf8");

function replaceOnce(source, needle, replacement, label) {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`Firestore V36 phase 2 failed: missing ${label}`);
  if (source.indexOf(needle, index + needle.length) >= 0) throw new Error(`Firestore V36 phase 2 failed: ambiguous ${label}`);
  return source.slice(0, index) + replacement + source.slice(index + needle.length);
}

if (!rules.includes("V36: PROMOTIONAL ENTITLEMENT CATALOG VALIDATION")) {
  const helpers = `    // ============================================================\n    // V36: PROMOTIONAL ENTITLEMENT CATALOG VALIDATION\n    //\n    // Promotional access never grants staff/admin authority. It only\n    // grants product feature identifiers. The catalog is explicit so\n    // malformed or invented feature IDs cannot be persisted.\n    // ============================================================\n\n    function validPromoFeatureList(value) {\n      return value is list\n        && value.size() >= 1\n        && value.size() <= 18\n        && value.hasOnly([\n          'intelligence_center',\n          'relationship_mapping',\n          'deep_history',\n          'advanced_search',\n          'account_comparison',\n          'network_explorer',\n          'watchlist',\n          'saved_investigations',\n          'intelligence_reports',\n          'change_comparison',\n          'cognitus_labs',\n          'enhanced_profile',\n          'search_collections',\n          'search_analytics',\n          'early_access',\n          'risk_signal_matrix',\n          'organization_overlap',\n          'signal_zero'\n        ]);\n    }\n\n    function validPromoEligibleRoles(value) {\n      return value is list\n        && value.size() >= 1\n        && value.size() <= 6\n        && value.hasOnly([\n          'user',\n          'verified_employer_member',\n          'org_admin',\n          'reviewer',\n          'admin',\n          'owner'\n        ]);\n    }\n\n    function validPromoWorkspaceType(value) {\n      return value in [\n        'watchlist',\n        'investigation',\n        'intelligence_report',\n        'snapshot',\n        'profile_customization',\n        'collection',\n        'search_event'\n      ];\n    }\n\n`;
  rules = replaceOnce(rules, "    function validDiscordId(value) {", helpers + "    function validDiscordId(value) {", "promo helper insertion point");
}

const promoValidation = `        && request.resource.data.featureIds is list\n        && request.resource.data.featureIds.size() >= 1\n        && request.resource.data.featureIds.size() <= 15\n        && request.resource.data.eligibleRoles is list\n        && request.resource.data.eligibleRoles.size() >= 1\n        && request.resource.data.eligibleRoles.size() <= 6\n`;
const promoValidationV36 = `        && validPromoFeatureList(request.resource.data.featureIds)\n        && validPromoEligibleRoles(request.resource.data.eligibleRoles)\n`;
while (rules.includes(promoValidation)) rules = rules.replace(promoValidation, promoValidationV36);

const grantValidation = `        && request.resource.data.featureIds is list\n        && request.resource.data.featureIds.size() >= 1\n        && request.resource.data.featureIds.size() <= 15\n`;
while (rules.includes(grantValidation)) rules = rules.replace(grantValidation, "        && validPromoFeatureList(request.resource.data.featureIds)\n");

const redemptionCreate = `        && request.resource.data.featureIds == get(promotionalCodePath(request.resource.data.promoId)).data.featureIds\n        && request.resource.data.status == 'active'\n`;
if (rules.includes(redemptionCreate)) rules = rules.replace(redemptionCreate, `        && request.resource.data.featureIds == get(promotionalCodePath(request.resource.data.promoId)).data.featureIds\n        && validPromoFeatureList(request.resource.data.featureIds)\n        && request.resource.data.status == 'active'\n`);

const redemptionUpdate = `        && request.resource.data.featureIds == get(promotionalCodePath(resource.data.promoId)).data.featureIds\n        && request.resource.data.status == 'active'\n`;
if (rules.includes(redemptionUpdate)) rules = rules.replace(redemptionUpdate, `        && request.resource.data.featureIds == get(promotionalCodePath(resource.data.promoId)).data.featureIds\n        && validPromoFeatureList(request.resource.data.featureIds)\n        && request.resource.data.status == 'active'\n`);

const workspaceTypes = `        && request.resource.data.type in [\n          'watchlist', 'investigation', 'intelligence_report', 'snapshot',\n          'profile_customization', 'collection', 'search_event'\n        ]\n`;
if (rules.includes(workspaceTypes)) rules = rules.replace(workspaceTypes, "        && validPromoWorkspaceType(request.resource.data.type)\n");

const promoHeader = "    // Promotional Access V26: codes, entitlements, redemptions, and private feature workspaces.\n";
if (rules.includes(promoHeader)) {
  rules = rules.replace(promoHeader, `    // ============================================================\n    // PROMOTIONAL / FEATURE ACCESS — V36\n    //\n    // These rules authorize entitlement records only. They DO NOT\n    // authorize access to protected reports, employment records,\n    // staff queues, organization administration, or Owner functions.\n    // Each underlying collection above remains authoritative.\n    //\n    // Signal Zero is deliberately only an entitlement here. Its\n    // Frenzy-time availability is controlled by settings/portal in\n    // the application, while all data reads still pass the ordinary\n    // report/employment/profile rules.\n    // ============================================================\n`);
}

const catchAll = `    match /{document=**} {\n      allow read, write: if false;\n    }\n`;
if (!rules.includes("FINAL DEFAULT-DENY BOUNDARY")) {
  rules = replaceOnce(rules, catchAll, `    // ============================================================\n    // FINAL DEFAULT-DENY BOUNDARY\n    //\n    // Any collection introduced by future Cognitus code is denied\n    // until a deliberate rule is added. This prevents new features\n    // from silently inheriting access.\n    // ============================================================\n${catchAll}`, "final catch-all");
}

builder = builder.replaceAll("request.resource.data.featureIds.size() <= 15", "request.resource.data.featureIds.size() <= 18");
if (!builder.includes("V36 feature catalog currently contains 18 entitlement identifiers")) {
  builder = builder.replace("import fs from \"node:fs\";", "import fs from \"node:fs\";\n\n// V36 feature catalog currently contains 18 entitlement identifiers, including Signal Zero.");
}

if (!rules.includes("'signal_zero'") || !rules.includes("value.size() <= 18")) {
  throw new Error("Firestore V36 phase 2 failed: 18-feature catalog was not materialized.");
}
if (rules.includes("request.resource.data.featureIds.size() <= 15")) {
  throw new Error("Firestore V36 phase 2 failed: legacy 15-feature cap remains in canonical rules.");
}

fs.writeFileSync(rulesPath, rules);
fs.writeFileSync(builderPath, builder);
console.log(`Firestore V36 phase 2 materialized (${rules.split("\\n").length} lines).`);
