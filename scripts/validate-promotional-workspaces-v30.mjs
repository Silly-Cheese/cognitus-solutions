import fs from "node:fs";

const entry=fs.readFileSync("src/promotionalAccessV26.js","utf8");
const js=fs.readFileSync("src/promo/promotionalWorkspacesV30.js","utf8");
const css=fs.readFileSync("src/promotionalWorkspacesV30.css","utf8");

function requireText(source,text,label){if(!source.includes(text))throw new Error(`Promotional Workspaces V30 validation failed: missing ${label}`);}

const features=[
  "intelligence_center","relationship_mapping","deep_history","advanced_search","account_comparison",
  "network_explorer","watchlist","saved_investigations","intelligence_reports","change_comparison",
  "cognitus_labs","enhanced_profile","search_collections","search_analytics","early_access"
];
for(const id of features)requireText(js,`${id}: {`,`workspace metadata for ${id}`);
requireText(entry,'startPromotionalWorkspacesV30','V30 production startup');
requireText(js,'promo30-command-strip','workspace command strip');
requireText(js,'promo30-stage-head','tool stage headers');
requireText(js,'promo30-subject-dossier','Intelligence Center dossier treatment');
requireText(js,'promo30-graph-canvas','relationship graph treatment');
requireText(js,'promo30-history-stream','Deep History timeline treatment');
requireText(js,'promo30-filter-console','Advanced Search console treatment');
requireText(js,'promo30-comparison-board','Comparison board treatment');
requireText(js,'promo30-report-document','Report Studio document treatment');
requireText(js,'promo30-workspace-composer','saved workspace composer treatment');
requireText(js,'promo30-labs-deck','Labs treatment');
requireText(js,'promo30-profile-studio','Profile Studio treatment');
requireText(js,'promo30-analytics-cockpit','analytics cockpit treatment');
requireText(js,'promo30-release-board','Early Access release board treatment');
requireText(css,'[data-promo30-feature="intelligence_center"]','feature-specific Intelligence styles');
requireText(css,'[data-promo30-feature="relationship_mapping"]','feature-specific Relationship Mapping styles');
requireText(css,'@media(max-width:720px)','mobile workspace styling');
requireText(css,'.promo30-report-document','report document CSS');
requireText(css,'.promo30-saved-workspace','saved workspace CSS');
requireText(css,'.promo30-lab-card','Labs card CSS');
console.log("Promotional Access V30 workspace regression checks passed.");
