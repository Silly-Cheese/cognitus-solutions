import fs from "node:fs";

const rules = fs.readFileSync("firestore.rules", "utf8");
const builder = fs.readFileSync("scripts/build-promotional-rules-v26.mjs", "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Firestore V36 validation failed: missing ${label}`);
}
function forbidText(source, text, label) {
  if (source.includes(text)) throw new Error(`Firestore V36 validation failed: ${label}`);
}

const featureIds = [
  "intelligence_center",
  "relationship_mapping",
  "deep_history",
  "advanced_search",
  "account_comparison",
  "network_explorer",
  "watchlist",
  "saved_investigations",
  "intelligence_reports",
  "change_comparison",
  "cognitus_labs",
  "enhanced_profile",
  "search_collections",
  "search_analytics",
  "early_access",
  "risk_signal_matrix",
  "organization_overlap",
  "signal_zero"
];

const lineCount = rules.split("\n").length;
if (lineCount < 1900) {
  throw new Error(`Firestore V36 validation failed: canonical rules look truncated (${lineCount} lines).`);
}

requireText(rules, "rules_version = '2';", "rules version");
requireText(rules, "service cloud.firestore", "Firestore service declaration");
requireText(rules, "V36: PROMOTIONAL ENTITLEMENT CATALOG VALIDATION", "V36 entitlement catalog validator");
requireText(rules, "function validPromoFeatureList(value)", "feature-list validator");
requireText(rules, "value.size() <= 18", "18-feature maximum");
requireText(rules, "function validPromoEligibleRoles(value)", "eligible-role validator");
requireText(rules, "function validPromoWorkspaceType(value)", "promo workspace validator");
requireText(rules, "PROMOTIONAL / FEATURE ACCESS — V36", "V36 promotional rules block");
requireText(rules, "match /promotionalCodes/{code}", "promotional code rules");
requireText(rules, "match /promoRedemptions/{redemptionId}", "redemption rules");
requireText(rules, "match /promoAccessGrants/{grantId}", "direct-grant rules");
requireText(rules, "match /promoUserData/{recordId}", "promo user-data rules");
requireText(rules, "function validFrenzyState(value)", "Frenzy state validator");
requireText(rules, "signalZeroEnabled", "Signal Zero Frenzy state field");
requireText(rules, "FINAL DEFAULT-DENY BOUNDARY", "final deny boundary");
requireText(rules, "match /{document=**}", "catch-all match");
requireText(rules, "allow read, write: if false;", "catch-all denial");

for (const id of featureIds) requireText(rules, `'${id}'`, `feature identifier ${id}`);
forbidText(rules, "request.resource.data.featureIds.size() <= 15", "legacy 15-feature limit remains in canonical rules");

requireText(builder, "featureIds.size() <= 18", "builder 18-feature limit");
forbidText(builder, "featureIds.size() <= 15", "legacy 15-feature limit remains in promotional builder");

console.log(`Firestore V36 canonical validation passed (${lineCount} lines, ${featureIds.length} promotional feature IDs).`);
