import fs from 'node:fs';

const entry=fs.readFileSync('src/promotionalAccessV26.js','utf8');
const registry=fs.readFileSync('src/promo/promotionalRegistryV33.js','utf8');
const features=fs.readFileSync('src/promo/promotionalFeaturesV33.js','utf8');
const contrast=fs.readFileSync('src/promotionalContrastV33.css','utf8');
const guard=fs.readFileSync('src/promo/promotionalContrastV33.js','utf8');

function requireText(source,text,label){if(!source.includes(text))throw new Error(`Promotional Access V33 validation failed: missing ${label}`);}
function rejectText(source,text,label){if(source.includes(text))throw new Error(`Promotional Access V33 validation failed: unexpected ${label}`);}

requireText(entry,'startPromotionalContrastV33();','early contrast startup');
requireText(entry,'startPromotionalRegistryV33();','V33 feature registry startup');
requireText(entry,'renderFeaturePageV33','V33 feature renderer');
requireText(registry,"id:'risk_signal_matrix'",'Risk Signal Matrix registration');
requireText(registry,"route:'/risk-matrix'",'Risk Signal Matrix route');
requireText(registry,"id:'organization_overlap'",'Organization Overlap Scanner registration');
requireText(registry,"route:'/overlap-scanner'",'Organization Overlap Scanner route');
requireText(registry,"C.FEATURE_BY_ROUTE.set",'runtime route registration');
requireText(registry,"input[name=\"featureIds\"]",'Promotion Management feature injection');
requireText(features,'screeningReportSummaries','safe non-reviewer report source');
requireText(features,"REVIEWER_ROLES",'reviewer-aware visibility handling');
requireText(features,'employmentRecords','authorized overlap source');
requireText(features,'data-promo-v26-page','V33 promo surface marker');
requireText(guard,'promo33-active','contrast activation class');
requireText(contrast,'--promo33-on-dark:#f8fafc','dark-surface foreground token');
requireText(contrast,'.promo30-network-result h2','dark network heading override');
requireText(contrast,'input::placeholder','readable form placeholder override');
requireText(contrast,'.button-dark','explicit dark button foreground');
requireText(contrast,'.promo33-metrics','new feature responsive metrics');
rejectText(guard,'temp','temporary placeholder in contrast guard');
rejectText(features,'temp','temporary placeholder in V33 features');
rejectText(contrast,'temp','temporary placeholder in V33 CSS');

console.log('Promotional Access V33 contrast and feature checks passed.');
