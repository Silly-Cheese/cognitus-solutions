import * as C from './promotionalCoreV26.js';
import { renderFeaturePage as renderFeaturePageV26 } from './promotionalFeaturesV26.js';

const SEVERITY_WEIGHT={Informational:0,Low:1,Moderate:2,High:3,Critical:4};
const REVIEWER_ROLES=new Set(['reviewer','admin','owner']);

function shell(feature,formHtml,resultId){
  C.setTitle(feature.name);
  C.root.innerHTML=`<section class="promo26-feature-hero" data-promo-v26-page><p class="eyebrow">Promotional Access · ${C.safe(feature.badge||'BETA')}</p><h1>${C.safe(feature.name)}</h1><p>${C.safe(feature.description)}</p></section><section class="promo26-feature-section promo30-tool-stage"><div class="promo30-stage-head"><div><span>COGNITUS ANALYSIS</span><h2>${C.safe(feature.short||feature.name)}</h2><p>${C.safe(feature.description)}</p></div><span class="promo30-stage-status"><i></i>Ready</span></div>${formHtml}<div class="promo30-result-stage" id="${resultId}"><div class="promo30-empty-state"><div class="promo30-empty-visual"><span></span><span></span><span></span></div><strong class="promo30-empty-title">No analysis loaded</strong><p>Choose the required records above to begin.</p></div></div></section>`;
}

function countBy(rows,key){const map=new Map();for(const row of rows){const value=C.clean(row?.[key])||'Unknown';map.set(value,(map.get(value)||0)+1);}return [...map.entries()].sort((a,b)=>b[1]-a[1]);}
function chart(rows){const max=Math.max(1,...rows.map(([,count])=>count));return `<div class="promo33-chart">${rows.map(([name,count])=>`<div class="promo33-chart-row"><span>${C.safe(name)}</span><i style="width:${Math.max(5,Math.round(count/max*100))}%"></i><strong>${count}</strong></div>`).join('')}</div>`;}

async function riskMatrix(feature){
  shell(feature,`<form class="promo26-searchbar promo30-primary-control" data-v33-risk-form><label>Subject<input name="subject" required placeholder="Profile ID, Cognitus ID, name, or username"></label><button class="button button-dark" type="submit">Analyze Signals</button></form>`,'promo33-risk-result');
  C.root.querySelector('[data-v33-risk-form]').addEventListener('submit',async(event)=>{
    event.preventDefault();const out=C.root.querySelector('#promo33-risk-result');out.innerHTML='<p>Analyzing authorized Cognitus records…</p>';
    const value=new FormData(event.currentTarget).get('subject');const profile=await C.findProfile(value);if(!profile){out.innerHTML=C.notice('No matching Cognitus profile was found.','error');return;}
    const staff=REVIEWER_ROLES.has(C.userRecord?.role);
    const [reports,employment]=await Promise.all([
      staff?C.safeReadWhere('reports','subjectProfileId','==',profile.id,250):C.safeReadWhere('screeningReportSummaries','subjectProfileId','==',profile.id,250),
      C.safeReadWhere('employmentRecords','profileId','==',profile.id,250)
    ]);
    const visible=staff?reports:reports.filter(row=>['screening','public'].includes(C.lower(row.visibility)));
    const approved=visible.filter(row=>['approved','published'].includes(C.lower(row.status)));
    const severe=approved.filter(row=>Number(SEVERITY_WEIGHT[row.severity]||0)>=3).length;
    const score=approved.length?Math.round(approved.reduce((sum,row)=>sum+Number(SEVERITY_WEIGHT[row.severity]||0),0)/(approved.length*4)*100):0;
    const categories=countBy(approved,'category');const severities=countBy(approved,'severity');
    out.innerHTML=`<div class="promo33-dashboard"><section class="promo26-feature-section promo30-subject-dossier"><div class="promo26-section-heading"><div><p class="eyebrow">Signal Subject</p><h2>${C.safe(profile.displayName||'Unnamed Profile')}</h2></div><span class="promo26-mini-badge">${C.safe(profile.cognitusId||profile.id)}</span></div><p>This matrix summarizes records your account is currently authorized to read. It is not an automated guilt or hiring decision.</p></section><div class="promo33-metrics"><article class="promo33-metric"><span>Authorized Reports</span><strong>${visible.length}</strong></article><article class="promo33-metric"><span>Approved / Published</span><strong>${approved.length}</strong></article><article class="promo33-metric"><span>High + Critical</span><strong>${severe}</strong></article><article class="promo33-metric"><span>Severity Index</span><strong>${score}</strong></article></div><div class="promo26-two-col"><section class="promo26-feature-section"><p class="eyebrow">Category Distribution</p><h2>Report patterns</h2>${categories.length?chart(categories):C.notice('No authorized approved reports are available for category analysis.')}</section><section class="promo26-feature-section"><p class="eyebrow">Severity Distribution</p><h2>Signal intensity</h2>${severities.length?chart(severities):C.notice('No authorized approved reports are available for severity analysis.')}</section></div><section class="promo26-feature-section"><p class="eyebrow">Context</p><h2>Employment footprint</h2><p>${employment.length} authorized employment record${employment.length===1?'':'s'} were available to this account. ${staff?'Reviewer-level report visibility is active.':'Only screening-visible report summaries are included for this account.'} Use the underlying records and context before making any decision.</p></section></div>`;
  });
}

async function overlapScanner(feature){
  const orgs=await C.safeReadCollection('organizations',250);
  shell(feature,`<form class="promo26-searchbar promo30-primary-control" data-v33-overlap-form><label>Organization A<select name="a" required><option value="">Select organization</option>${orgs.map(org=>`<option value="${C.safe(org.id)}">${C.safe(org.name||org.cognitusId||org.id)}</option>`).join('')}</select></label><label>Organization B<select name="b" required><option value="">Select organization</option>${orgs.map(org=>`<option value="${C.safe(org.id)}">${C.safe(org.name||org.cognitusId||org.id)}</option>`).join('')}</select></label><button class="button button-dark" type="submit">Scan Overlap</button></form>`,'promo33-overlap-result');
  C.root.querySelector('[data-v33-overlap-form]').addEventListener('submit',async(event)=>{
    event.preventDefault();const data=C.formObject(event.currentTarget);const out=C.root.querySelector('#promo33-overlap-result');if(data.a===data.b){out.innerHTML=C.notice('Choose two different organizations.','error');return;}out.innerHTML='<p>Scanning authorized employment records…</p>';
    const [aRows,bRows]=await Promise.all([C.safeReadWhere('employmentRecords','organizationId','==',data.a,300),C.safeReadWhere('employmentRecords','organizationId','==',data.b,300)]);
    const aMap=new Map(aRows.filter(row=>row.profileId).map(row=>[row.profileId,row]));const overlap=bRows.filter(row=>row.profileId&&aMap.has(row.profileId));const unique=[...new Map(overlap.map(row=>[row.profileId,row])).values()];
    const profiles=(await Promise.all(unique.slice(0,80).map(row=>C.readDoc('profiles',row.profileId).catch(()=>null)))).filter(Boolean);const aOrg=orgs.find(org=>org.id===data.a);const bOrg=orgs.find(org=>org.id===data.b);
    out.innerHTML=`<div class="promo33-dashboard"><div class="promo33-metrics"><article class="promo33-metric"><span>${C.safe(aOrg?.name||'Organization A')}</span><strong>${aRows.length}</strong></article><article class="promo33-metric"><span>${C.safe(bOrg?.name||'Organization B')}</span><strong>${bRows.length}</strong></article><article class="promo33-metric"><span>Shared Profiles</span><strong>${profiles.length}</strong></article><article class="promo33-metric"><span>Coverage</span><strong>${Math.max(aRows.length,bRows.length)?Math.round(profiles.length/Math.max(aRows.length,bRows.length)*100):0}%</strong></article></div><section class="promo26-feature-section"><p class="eyebrow">Cross-Organization Overlap</p><h2>People connected to both organizations</h2><div class="promo33-overlap-grid">${profiles.length?profiles.map(profile=>{const a=aMap.get(profile.id);const b=overlap.find(row=>row.profileId===profile.id);return `<article class="promo33-overlap-person"><h3>${C.safe(profile.displayName||profile.cognitusId||profile.id)}</h3><p>${C.safe(profile.cognitusId||profile.id)}</p><div class="promo33-overlap-tags"><span>${C.safe(a?.positionTitle||'Role')} · ${C.safe(aOrg?.name||'Org A')}</span><span>${C.safe(b?.positionTitle||'Role')} · ${C.safe(bOrg?.name||'Org B')}</span></div><div class="hero-actions">${C.buttonLink(`/intelligence?subject=${encodeURIComponent(profile.id)}`,'Open Intelligence')}</div></article>`;}).join(''):C.notice('No shared profiles were found in the employment records available to your account.')}</div></section><p class="promo26-privacy-note">Results are limited to employment records your current Cognitus role is permitted to read. Promotional Access does not expand underlying record permissions.</p></div>`;
  });
}

export async function renderFeaturePageV33(feature){
  if(feature.id==='risk_signal_matrix')return riskMatrix(feature);
  if(feature.id==='organization_overlap')return overlapScanner(feature);
  return renderFeaturePageV26(feature);
}
