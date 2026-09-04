import fs from "node:fs";

const core=fs.readFileSync("src/promo/promotionalCoreV26.js","utf8");
const features=fs.readFileSync("src/promo/promotionalFeaturesV26.js","utf8");
const admin=fs.readFileSync("src/promo/promotionalAdminV26.js","utf8");
const css=fs.readFileSync("src/promotionalAccessV26.css","utf8");
const nav=fs.readFileSync("src/navigationEnhancements.js","utf8");
const rules=fs.readFileSync("scripts/build-promotional-rules-v26.mjs","utf8");
const deploy=fs.readFileSync("deploy-rules-v19.cmd","utf8");

function requireText(source,text,label){if(!source.includes(text))throw new Error(`Promotional Access V26 validation failed: missing ${label}`);}
const featureIds=[
  "intelligence_center","relationship_mapping","deep_history","advanced_search","account_comparison",
  "network_explorer","watchlist","saved_investigations","intelligence_reports","change_comparison",
  "cognitus_labs","enhanced_profile","search_collections","search_analytics","early_access"
];
for(const id of featureIds)requireText(core,`id:\"${id}\"`,`feature ${id}`);
requireText(core,"You do not currently have permission to view this!","exact locked-feature message");
requireText(core,"promo26-blurred-content","blurred locked page");
requireText(css,"filter:blur(13px)","locked page blur style");
requireText(core,"runTransaction","transactional redemption");
requireText(core,"promoRedemptions","redemption collection");
requireText(core,"promoAccessGrants","direct grants");
requireText(core,"promoUserData","private promotional workspaces");
requireText(admin,"maxTotalRedemptions","total redemption limit");
requireText(admin,"maxPerAccount","per-account redemption limit");
requireText(admin,"campaignExpiryBehavior","campaign expiry behavior");
requireText(admin,"Bulk Quantity","bulk promotional code generation");
requireText(features,"employmentRecords","authorized employment feature data");
requireText(features,"intelligence_report","saved intelligence reports");
requireText(features,"profile_customization","enhanced profile cards");
requireText(nav,'import \"./promotionalAccessV26.js\";',"production entry import");
requireText(rules,"match /promotionalCodes/{code}","promotional code rules");
requireText(rules,"match /promoRedemptions/{redemptionId}","redemption rules");
requireText(rules,"match /promoAccessGrants/{grantId}","grant rules");
requireText(rules,"match /promoUserData/{recordId}","workspace rules");
requireText(deploy,"build-promotional-rules-v26.mjs","promotional rules deployment step");
console.log("Promotional Access V26 regression checks passed.");
