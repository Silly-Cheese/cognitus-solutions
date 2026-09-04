import * as C from "./promotionalCoreV26.js";

function hero(feature,body=""){
  C.setTitle(feature.name);
  return `<section class="promo26-feature-hero"><p class="eyebrow">Promotional Access · ${C.safe(feature.badge)}</p><h1>${C.safe(feature.name)}</h1><p>${C.safe(feature.description)}</p>${body}</section>`;
}
function card(title,body,meta=""){
  return `<article class="promo26-record-card"><div class="promo26-record-head"><h3>${C.safe(title)}</h3>${meta}</div><p>${C.safe(body)}</p></article>`;
}
function profileSummary(profile){
  if(!profile)return "";
  return `<section class="promo26-feature-section"><div class="promo26-section-heading"><div><p class="eyebrow">Subject</p><h2>${C.safe(profile.displayName||"Unnamed Profile")}</h2></div><span class="promo26-mini-badge">${C.safe(profile.cognitusId||profile.id)}</span></div><dl class="promo26-detail-list"><div><dt>Identity</dt><dd>${C.safe(C.humanize(profile.identityStatus||"unreviewed"))}</dd></div><div><dt>Standing</dt><dd>${C.safe(C.humanize(profile.professionalStanding||"unreviewed"))}</dd></div><div><dt>Risk</dt><dd>${C.safe(C.humanize(profile.riskLevel||"unreviewed"))}</dd></div><div><dt>Discord</dt><dd>${C.safe((profile.discordUsernames||[]).join(", ")||"None listed")}</dd></div><div><dt>Roblox</dt><dd>${C.safe((profile.robloxUsernames||[]).join(", ")||"None listed")}</dd></div><div><dt>Aliases</dt><dd>${C.safe((profile.knownAliases||[]).join(", ")||"None listed")}</dd></div></dl></section>`;
}
async function saveSearchEvent(featureId,query,resultCount=0){
  try{await C.createUserData("search_event",{title:featureId,payload:{featureId,query:C.clean(query).slice(0,120),resultCount:Number(resultCount||0)}});}catch{}
}

async function intelligenceCenter(feature){
  const subject=C.hashParams().get("subject")||"";
  C.root.innerHTML=`${hero(feature)}<section class="promo26-feature-section"><form class="promo26-searchbar" data-intel-search><label>Profile / Cognitus ID / exact name<input name="subject" value="${C.safe(subject)}" required></label><button class="button button-dark" type="submit">Build Intelligence View</button></form><div data-intel-result class="empty-state"><p>Choose a subject to assemble an authorized intelligence view.</p></div></section>`;
  const run=async(value)=>{
    const out=C.root.querySelector("[data-intel-result]"); out.className=""; out.innerHTML="<p>Building intelligence view…</p>";
    const profile=await C.findProfile(value); if(!profile){out.innerHTML=C.notice("No matching Cognitus profile was found.","error");return;}
    const [reports,employment,checks]=await Promise.all([
      C.safeReadWhere("reports","subjectProfileId","==",profile.id,100),
      C.safeReadWhere("employmentRecords","profileId","==",profile.id,100),
      C.safeReadWhere("checkLogs","targetProfileId","==",profile.id,100)
    ]);
    await saveSearchEvent(feature.id,value,1);
    out.innerHTML=`${profileSummary(profile)}<section class="promo26-metric-grid"><article><span>Authorized Reports</span><strong>${reports.length}</strong></article><article><span>Employment Records</span><strong>${employment.length}</strong></article><article><span>Matching Check Records</span><strong>${checks.length}</strong></article></section><section class="promo26-two-col"><article class="promo26-feature-section"><p class="eyebrow">Employment</p><h2>Known authorized records</h2>${employment.length?employment.slice(0,12).map((row)=>card(row.positionTitle||"Employment record",`${row.organizationName||"Organization"} · ${row.startedOn||"Unknown start"}${row.endedOn?` → ${row.endedOn}`:""}`)).join(""):C.notice("No employment records are available to this account.")}</article><article class="promo26-feature-section"><p class="eyebrow">Screening</p><h2>Records you can read</h2>${reports.length?reports.slice(0,12).map((row)=>card(row.category||"Report",row.summary||"No summary",`<span class="promo26-mini-badge">${C.safe(row.severity||"Informational")}</span>`)).join(""):C.notice("No screening reports are available to this account.")}</article></section>`;
  };
  C.root.querySelector("[data-intel-search]").addEventListener("submit",(event)=>{event.preventDefault();run(new FormData(event.currentTarget).get("subject"));});
  if(subject)run(subject);
}

async function relationshipMapping(feature){
  C.root.innerHTML=`${hero(feature)}<section class="promo26-feature-section"><form class="promo26-searchbar" data-map-search><label>Subject<input name="subject" required placeholder="Profile ID, Cognitus ID, or exact name"></label><button class="button button-dark">Map Relationships</button></form><div data-map-result class="empty-state"><p>Search a profile to build a relationship graph from records you can read.</p></div></section>`;
  C.root.querySelector("[data-map-search]").addEventListener("submit",async(event)=>{
    event.preventDefault(); const value=new FormData(event.currentTarget).get("subject"); const profile=await C.findProfile(value); const out=C.root.querySelector("[data-map-result]");
    if(!profile){out.innerHTML=C.notice("No matching profile found.","error");return;}
    const employment=await C.safeReadWhere("employmentRecords","profileId","==",profile.id,50); const orgIds=[...new Set(employment.map((row)=>row.organizationId).filter(Boolean))];
    const orgs=(await Promise.all(orgIds.slice(0,10).map((id)=>C.readDoc("organizations",id).catch(()=>null)))).filter(Boolean);
    const nodes=[...(profile.discordUsernames||[]).slice(0,2).map((name)=>`Discord · ${name}`),...(profile.robloxUsernames||[]).slice(0,2).map((name)=>`Roblox · ${name}`),...orgs.slice(0,4).map((org)=>org.name||org.cognitusId),...(profile.knownAliases||[]).slice(0,2).map((name)=>`Alias · ${name}`)];
    await saveSearchEvent(feature.id,value,nodes.length);
    out.className=""; out.innerHTML=`<section class="promo26-network-map"><div class="promo26-network-ring"></div><div class="promo26-network-center"><strong>${C.safe(profile.displayName||"Subject")}</strong><small>${C.safe(profile.cognitusId||"")}</small></div>${nodes.slice(0,8).map((name)=>`<div class="promo26-network-node">${C.safe(name)}</div>`).join("")}</section><p class="promo26-privacy-note">This map contains only relationships supported by Cognitus records your account is already permitted to read.</p>`;
  });
}

async function deepHistory(feature){
  C.root.innerHTML=`${hero(feature)}<section class="promo26-feature-section"><form class="promo26-searchbar" data-history-search><label>Subject<input name="subject" required></label><button class="button button-dark">Build Timeline</button></form><div data-history-result class="empty-state"><p>No timeline loaded.</p></div></section>`;
  C.root.querySelector("[data-history-search]").addEventListener("submit",async(event)=>{
    event.preventDefault(); const value=new FormData(event.currentTarget).get("subject"); const profile=await C.findProfile(value); const out=C.root.querySelector("[data-history-result]"); if(!profile){out.innerHTML=C.notice("Profile not found.","error");return;}
    const [employment,reports]=await Promise.all([C.safeReadWhere("employmentRecords","profileId","==",profile.id,100),C.safeReadWhere("reports","subjectProfileId","==",profile.id,100)]);
    const events=[{date:profile.createdAt,title:"Profile created",body:profile.cognitusId||profile.id},...employment.map((row)=>({date:row.createdAt,title:`Employment: ${row.positionTitle||"Record"}`,body:`${row.organizationName||"Organization"} · ${row.startedOn||"Unknown start"}${row.endedOn?` to ${row.endedOn}`:""}`})),...reports.map((row)=>({date:row.createdAt,title:`Report: ${row.category||"Record"}`,body:row.summary||"No summary"}))].sort((a,b)=>C.timestampMs(b.date)-C.timestampMs(a.date));
    await saveSearchEvent(feature.id,value,events.length); out.className=""; out.innerHTML=`${profileSummary(profile)}<section class="promo26-feature-section"><p class="eyebrow">Timeline</p><div class="promo26-timeline">${events.length?events.map((item)=>`<article><small>${C.safe(C.formatTimestamp(item.date))}</small><h3>${C.safe(item.title)}</h3><p>${C.safe(item.body)}</p></article>`).join(""):C.notice("No authorized historical events were found.")}</div></section>`;
  });
}

async function advancedSearch(feature){
  const profiles=await C.safeReadCollection("profiles",250);
  C.root.innerHTML=`${hero(feature)}<section class="promo26-feature-section"><form data-advanced-search><div class="promo26-filter-grid"><label>Name / username / alias<input name="query"></label><label>Identity<select name="identity"><option value="">Any</option><option>verified</option><option>claimed</option><option>self_declared</option><option>employer_supplied</option></select></label><label>Standing<input name="standing" placeholder="e.g. unreviewed"></label><label>Risk<input name="risk" placeholder="e.g. moderate"></label></div><button class="button button-dark" type="submit">Search ${profiles.length} Available Profiles</button></form><div data-advanced-results class="promo26-record-grid"></div></section>`;
  const render=(form)=>{
    const data=C.formObject(form); const q=C.lower(data.query); const results=profiles.filter((profile)=>{
      const text=[profile.displayName,profile.cognitusId,...(profile.discordUsernames||[]),...(profile.robloxUsernames||[]),...(profile.knownAliases||[])].map(C.lower).join(" ");
      return (!q||text.includes(q)) && (!data.identity||profile.identityStatus===data.identity) && (!C.clean(data.standing)||C.lower(profile.professionalStanding)===C.lower(data.standing)) && (!C.clean(data.risk)||C.lower(profile.riskLevel)===C.lower(data.risk));
    }).slice(0,75);
    C.root.querySelector("[data-advanced-results]").innerHTML=results.length?results.map((profile)=>`<article class="promo26-record-card"><h3>${C.safe(profile.displayName||"Unnamed")}</h3><p>${C.safe(profile.cognitusId||profile.id)}</p><div class="promo26-record-meta"><span>${C.safe(C.humanize(profile.identityStatus||"unreviewed"))}</span><span>${C.safe(C.humanize(profile.professionalStanding||"unreviewed"))}</span><span>Risk: ${C.safe(C.humanize(profile.riskLevel||"unreviewed"))}</span></div><div class="hero-actions">${C.buttonLink(`/intelligence?subject=${encodeURIComponent(profile.id)}`,"Intelligence")}</div></article>`).join(""):C.notice("No profiles match those filters.");
    saveSearchEvent(feature.id,data.query,results.length);
  };
  C.root.querySelector("[data-advanced-search]").addEventListener("submit",(event)=>{event.preventDefault();render(event.currentTarget);}); render(C.root.querySelector("[data-advanced-search]"));
}

async function comparison(feature){
  C.root.innerHTML=`${hero(feature)}<section class="promo26-feature-section"><form class="promo26-searchbar" data-compare-form><label>Profile A<input name="a" required></label><label>Profile B<input name="b" required></label><button class="button button-dark">Compare</button></form><div data-compare-result class="empty-state"><p>Choose two Cognitus profiles.</p></div></section>`;
  C.root.querySelector("[data-compare-form]").addEventListener("submit",async(event)=>{
    event.preventDefault(); const data=C.formObject(event.currentTarget); const [a,b]=await Promise.all([C.findProfile(data.a),C.findProfile(data.b)]); const out=C.root.querySelector("[data-compare-result]"); if(!a||!b){out.innerHTML=C.notice("Both profiles must be found.","error");return;}
    const rows=[["Display Name",a.displayName,b.displayName],["Cognitus ID",a.cognitusId,b.cognitusId],["Identity",C.humanize(a.identityStatus),C.humanize(b.identityStatus)],["Standing",C.humanize(a.professionalStanding),C.humanize(b.professionalStanding)],["Risk",C.humanize(a.riskLevel),C.humanize(b.riskLevel)],["Discord",(a.discordUsernames||[]).join(", "),(b.discordUsernames||[]).join(", ")],["Roblox",(a.robloxUsernames||[]).join(", "),(b.robloxUsernames||[]).join(", ")]];
    out.className=""; out.innerHTML=`<div class="promo26-compare-table"><div class="promo26-compare-head"><strong>Field</strong><strong>${C.safe(a.displayName||"Profile A")}</strong><strong>${C.safe(b.displayName||"Profile B")}</strong></div>${rows.map(([label,av,bv])=>`<div><span>${C.safe(label)}</span><span class="${C.clean(av)!==C.clean(bv)?"is-different":""}">${C.safe(av||"—")}</span><span class="${C.clean(av)!==C.clean(bv)?"is-different":""}">${C.safe(bv||"—")}</span></div>`).join("")}</div>`; saveSearchEvent(feature.id,`${data.a} | ${data.b}`,2);
  });
}

async function networkExplorer(feature){
  const orgs=await C.safeReadCollection("organizations",250);
  C.root.innerHTML=`${hero(feature)}<section class="promo26-feature-section"><form class="promo26-searchbar" data-network-form><label>Organization<select name="organizationId"><option value="">Select organization</option>${orgs.map((org)=>`<option value="${C.safe(org.id)}">${C.safe(org.name||org.cognitusId||org.id)}</option>`).join("")}</select></label><button class="button button-dark">Explore Network</button></form><div data-network-result class="empty-state"><p>Select an organization.</p></div></section>`;
  C.root.querySelector("[data-network-form]").addEventListener("submit",async(event)=>{
    event.preventDefault(); const id=new FormData(event.currentTarget).get("organizationId"); const org=orgs.find((item)=>item.id===id); const out=C.root.querySelector("[data-network-result]"); if(!org){out.innerHTML=C.notice("Choose an organization.","error");return;}
    const records=await C.safeReadWhere("employmentRecords","organizationId","==",id,100); const profileIds=[...new Set(records.map((row)=>row.profileId).filter(Boolean))]; const profiles=(await Promise.all(profileIds.slice(0,30).map((pid)=>C.readDoc("profiles",pid).catch(()=>null)))).filter(Boolean);
    out.className=""; out.innerHTML=`<section class="promo26-feature-section"><div class="promo26-section-heading"><div><p class="eyebrow">Organization Network</p><h2>${C.safe(org.name||"Organization")}</h2></div><span>${profiles.length} authorized profile link${profiles.length===1?"":"s"}</span></div><div class="promo26-record-grid">${profiles.length?profiles.map((profile)=>card(profile.displayName||"Profile",profile.cognitusId||profile.id,`<a class="button button-light" href="#/intelligence?subject=${encodeURIComponent(profile.id)}">Open</a>`)).join(""):C.notice("No employment-linked profiles are available to this account.")}</div></section>`; saveSearchEvent(feature.id,org.name||id,profiles.length);
  });
}

async function watchlist(feature){
  const rows=await C.loadUserData("watchlist");
  C.root.innerHTML=`${hero(feature)}<section class="promo26-two-col"><form class="promo26-feature-section form-stack" data-watch-form><p class="eyebrow">Add Subject</p><label>Profile<input name="subject" required></label><label>Private Note<textarea name="note" maxlength="500" rows="4"></textarea></label><button class="button button-dark">Add to Watchlist</button><div data-watch-message hidden></div></form><section class="promo26-feature-section"><p class="eyebrow">Saved</p><h2>Your Watchlist</h2><div class="promo26-workspace-list">${rows.length?rows.map((row)=>`<article><strong>${C.safe(row.title||row.subjectId||"Watchlist item")}</strong><p>${C.safe(row.payload?.note||"No private note")}</p><div class="hero-actions">${row.subjectId?C.buttonLink(`/intelligence?subject=${encodeURIComponent(row.subjectId)}`,"Open Intelligence"):""}<button class="button button-light" data-user-delete="${C.safe(row.id)}">Remove</button></div></article>`).join(""):C.notice("Your watchlist is empty.")}</div></section></section>`;
  C.root.querySelector("[data-watch-form]").addEventListener("submit",async(event)=>{event.preventDefault();const data=C.formObject(event.currentTarget);const profile=await C.findProfile(data.subject);if(!profile)return C.setMessage(C.root.querySelector("[data-watch-message]"),"Profile not found.","error");await C.createUserData("watchlist",{title:profile.displayName||profile.cognitusId,subjectId:profile.id,payload:{note:C.clean(data.note).slice(0,500),baseline:{displayName:profile.displayName,identityStatus:profile.identityStatus,professionalStanding:profile.professionalStanding,riskLevel:profile.riskLevel}}});C.scheduleSync(true);});
  bindDeletes();
}

async function investigations(feature){
  const rows=await C.loadUserData("investigation");
  C.root.innerHTML=`${hero(feature)}<section class="promo26-two-col"><form class="promo26-feature-section form-stack" data-investigation-form><p class="eyebrow">New Investigation</p><label>Title<input name="title" maxlength="120" required></label><label>Primary Subject<input name="subject"></label><label>Organization<input name="organization"></label><label>Notes<textarea name="notes" maxlength="2000" rows="6"></textarea></label><button class="button button-dark">Create Investigation</button><div data-investigation-message hidden></div></form><section class="promo26-feature-section"><p class="eyebrow">Workspace</p><h2>Saved Investigations</h2><div class="promo26-workspace-list">${rows.length?rows.map((row)=>`<article><strong>${C.safe(row.title)}</strong><p>${C.safe(row.payload?.notes||"No notes")}</p><small>${C.safe(C.formatTimestamp(row.updatedAt))}</small><div class="hero-actions">${row.subjectId?C.buttonLink(`/intelligence?subject=${encodeURIComponent(row.subjectId)}`,"Open Subject"):""}<button class="button button-light" data-user-delete="${C.safe(row.id)}">Delete</button></div></article>`).join(""):C.notice("No investigations saved.")}</div></section></section>`;
  C.root.querySelector("[data-investigation-form]").addEventListener("submit",async(event)=>{event.preventDefault();const data=C.formObject(event.currentTarget);const profile=C.clean(data.subject)?await C.findProfile(data.subject):null;const org=C.clean(data.organization)?await C.findOrganization(data.organization):null;await C.createUserData("investigation",{title:data.title,subjectId:profile?.id||null,organizationId:org?.id||null,payload:{notes:C.clean(data.notes).slice(0,2000),subjectName:profile?.displayName||"",organizationName:org?.name||""}});C.scheduleSync(true);}); bindDeletes();
}

async function intelligenceReports(feature){
  const saved=await C.loadUserData("intelligence_report");
  C.root.innerHTML=`${hero(feature)}<section class="promo26-feature-section"><form class="promo26-searchbar" data-report-form><label>Subject<input name="subject" required></label><button class="button button-dark">Generate Report</button></form><div data-report-output class="empty-state"><p>Generate an intelligence report from records your account is authorized to read.</p></div></section><section class="promo26-feature-section"><p class="eyebrow">Saved Reports</p><div class="promo26-workspace-list">${saved.length?saved.map((row)=>`<article><strong>${C.safe(row.title)}</strong><small>${C.safe(C.formatTimestamp(row.createdAt))}</small><button class="button button-light" data-user-delete="${C.safe(row.id)}">Delete</button></article>`).join(""):C.notice("No reports saved yet.")}</div></section>`;
  C.root.querySelector("[data-report-form]").addEventListener("submit",async(event)=>{event.preventDefault();const value=new FormData(event.currentTarget).get("subject");const profile=await C.findProfile(value);const out=C.root.querySelector("[data-report-output]");if(!profile){out.innerHTML=C.notice("Profile not found.","error");return;}const [reports,employment]=await Promise.all([C.safeReadWhere("reports","subjectProfileId","==",profile.id,50),C.safeReadWhere("employmentRecords","profileId","==",profile.id,50)]);out.className="";out.innerHTML=`<div class="promo26-report-toolbar"><button class="button button-light" data-print-report>Print / Save PDF</button><button class="button button-dark" data-save-report>Save Report</button></div><article class="promo26-intel-report promo26-print-area"><p class="eyebrow">Cognitus Solutions · Intelligence Report</p><h1>${C.safe(profile.displayName||"Subject")}</h1><p>${C.safe(profile.cognitusId||profile.id)}</p>${profileSummary(profile)}<section><h2>Authorized Employment Records</h2>${employment.map((row)=>`<p><strong>${C.safe(row.positionTitle||"Position")}</strong> · ${C.safe(row.organizationName||"Organization")}</p>`).join("")||"<p>None available.</p>"}</section><section><h2>Authorized Screening Records</h2>${reports.map((row)=>`<p><strong>${C.safe(row.category||"Report")}</strong> · ${C.safe(row.summary||"")}</p>`).join("")||"<p>None available.</p>"}</section><p class="promo26-privacy-note">This report is decision-support material and includes only records this account was permitted to read at generation time.</p></article>`;out.querySelector("[data-print-report]").addEventListener("click",()=>window.print());out.querySelector("[data-save-report]").addEventListener("click",async()=>{await C.createUserData("intelligence_report",{title:`${profile.displayName||profile.cognitusId} Intelligence Report`,subjectId:profile.id,payload:{reportCount:reports.length,employmentCount:employment.length,generatedAt:new Date().toISOString()}});C.scheduleSync(true);});}); bindDeletes();
}

async function changeComparison(feature){
  const snapshots=await C.loadUserData("snapshot");
  C.root.innerHTML=`${hero(feature)}<section class="promo26-two-col"><form class="promo26-feature-section form-stack" data-snapshot-form><p class="eyebrow">Capture</p><label>Subject<input name="subject" required></label><button class="button button-dark">Capture Current Snapshot</button><div data-snapshot-message hidden></div></form><section class="promo26-feature-section"><p class="eyebrow">Snapshots</p><div class="promo26-workspace-list">${snapshots.length?snapshots.map((row)=>`<article><strong>${C.safe(row.title)}</strong><small>${C.safe(C.formatTimestamp(row.createdAt))}</small><p>${C.safe(C.humanize(row.payload?.riskLevel||"unreviewed"))} risk · ${C.safe(C.humanize(row.payload?.professionalStanding||"unreviewed"))}</p><button class="button button-light" data-user-delete="${C.safe(row.id)}">Delete</button></article>`).join(""):C.notice("No snapshots yet.")}</div></section></section>`;
  C.root.querySelector("[data-snapshot-form]").addEventListener("submit",async(event)=>{event.preventDefault();const profile=await C.findProfile(new FormData(event.currentTarget).get("subject"));if(!profile)return C.setMessage(C.root.querySelector("[data-snapshot-message]"),"Profile not found.","error");await C.createUserData("snapshot",{title:`${profile.displayName||profile.cognitusId} snapshot`,subjectId:profile.id,payload:{displayName:profile.displayName,identityStatus:profile.identityStatus,professionalStanding:profile.professionalStanding,riskLevel:profile.riskLevel,discordUsernames:profile.discordUsernames||[],robloxUsernames:profile.robloxUsernames||[]}});C.scheduleSync(true);});bindDeletes();
}

async function labs(feature){
  C.root.innerHTML=`${hero(feature)}<section class="promo26-feature-section"><p class="eyebrow">Experimental Surface</p><h2>Cognitus Labs</h2><div class="promo26-record-grid">${C.FEATURES.filter((item)=>item.badge!=="EARLY").map((item)=>`<article class="promo26-record-card"><div class="promo26-record-head"><h3>${C.safe(item.short)}</h3><span class="promo26-mini-badge">${C.safe(item.badge)}</span></div><p>${C.safe(item.description)}</p><div class="hero-actions">${C.buttonLink(item.route,"Open")}</div></article>`).join("")}</div></section><section class="promo26-feature-section"><p class="promo26-privacy-note">Labs features remain subject to the same Cognitus privacy and role restrictions as standard tools. Promotional Access never creates administrative authority.</p></section>`;
}

async function enhancedProfile(feature){
  const current=(await C.loadUserData("profile_customization"))[0]; const p=current?.payload||{};
  C.root.innerHTML=`${hero(feature)}<section class="promo26-two-col"><form class="promo26-feature-section form-stack" data-profile-style><p class="eyebrow">Profile Card Studio</p><label>Badge Label<input name="badgeLabel" maxlength="40" value="${C.safe(p.badgeLabel||"Promotional Access")}"></label><label>Headline<input name="headline" maxlength="80" value="${C.safe(p.headline||"Cognitus Promotional Member")}"></label><label>Card Style<select name="cardStyle"><option value="classic" ${p.cardStyle!=="compact"?"selected":""}>Classic</option><option value="compact" ${p.cardStyle==="compact"?"selected":""}>Compact</option></select></label><button class="button button-dark">Save Profile Card</button></form><section class="promo26-profile-preview"><header><p>${C.safe(p.headline||"Cognitus Promotional Member")}</p><h2>${C.safe(C.profileRecord?.displayName||C.userRecord?.displayName||"Cognitus User")}</h2><span class="promo26-mini-badge">${C.safe(p.badgeLabel||"Promotional Access")}</span></header><section><p>Your active promotional features can be displayed as part of your private Cognitus profile experience.</p></section></section></section>`;
  C.root.querySelector("[data-profile-style]").addEventListener("submit",async(event)=>{event.preventDefault();const data=C.formObject(event.currentTarget);const payload={badgeLabel:C.clean(data.badgeLabel).slice(0,40),headline:C.clean(data.headline).slice(0,80),cardStyle:data.cardStyle==="compact"?"compact":"classic"};if(current)await C.updateUserData(current.id,{payload,title:"Enhanced Profile Card"});else await C.createUserData("profile_customization",{title:"Enhanced Profile Card",payload});C.scheduleSync(true);});
}

async function collections(feature){
  const rows=await C.loadUserData("collection");
  C.root.innerHTML=`${hero(feature)}<section class="promo26-two-col"><form class="promo26-feature-section form-stack" data-collection-form><p class="eyebrow">New Collection</p><label>Name<input name="title" maxlength="120" required></label><label>Profile IDs / Cognitus IDs<textarea name="subjects" rows="6" placeholder="One per line"></textarea></label><label>Organization IDs<textarea name="organizations" rows="4" placeholder="One per line"></textarea></label><button class="button button-dark">Create Collection</button></form><section class="promo26-feature-section"><p class="eyebrow">Saved</p><div class="promo26-workspace-list">${rows.length?rows.map((row)=>`<article><strong>${C.safe(row.title)}</strong><p>${Number(row.payload?.subjects?.length||0)} profiles · ${Number(row.payload?.organizations?.length||0)} organizations</p><button class="button button-light" data-user-delete="${C.safe(row.id)}">Delete</button></article>`).join(""):C.notice("No collections yet.")}</div></section></section>`;
  C.root.querySelector("[data-collection-form]").addEventListener("submit",async(event)=>{event.preventDefault();const data=C.formObject(event.currentTarget);const subjects=C.clean(data.subjects).split(/\n+/).map(C.clean).filter(Boolean).slice(0,100);const organizations=C.clean(data.organizations).split(/\n+/).map(C.clean).filter(Boolean).slice(0,100);await C.createUserData("collection",{title:data.title,payload:{subjects,organizations}});C.scheduleSync(true);});bindDeletes();
}

async function analytics(feature){
  const [checks,events]=await Promise.all([C.safeReadWhere("checkLogs","checkedByUid","==",C.authUser.uid,500),C.loadUserData("search_event")]);
  const reasons=new Map(); checks.forEach((row)=>reasons.set(row.reason,(reasons.get(row.reason)||0)+1)); const max=Math.max(1,...reasons.values());
  C.root.innerHTML=`${hero(feature)}<section class="promo26-metric-grid"><article><span>Logged Checks</span><strong>${checks.length}</strong></article><article><span>Promo Feature Searches</span><strong>${events.length}</strong></article><article><span>Features Used</span><strong>${new Set(events.map((row)=>row.payload?.featureId).filter(Boolean)).size}</strong></article></section><section class="promo26-two-col"><article class="promo26-feature-section"><p class="eyebrow">Check Reasons</p><h2>Your usage mix</h2><div class="promo26-bars">${[...reasons.entries()].sort((a,b)=>b[1]-a[1]).map(([reason,count])=>`<article><span>${C.safe(reason)}</span><i style="width:${Math.max(5,Math.round(count/max*100))}%"></i><strong>${count}</strong></article>`).join("")||C.notice("No logged checks yet.")}</div></article><article class="promo26-feature-section"><p class="eyebrow">Recent Promotional Tools</p><h2>Feature activity</h2>${events.slice(0,12).map((row)=>card(C.FEATURE_BY_ID.get(row.payload?.featureId)?.short||C.humanize(row.payload?.featureId||"Feature"),row.payload?.query||"Activity",`<small>${C.safe(C.formatTimestamp(row.createdAt))}</small>`)).join("")||C.notice("No promotional feature activity yet.")}</article></section>`;
}

async function earlyAccess(feature){
  C.root.innerHTML=`${hero(feature)}<section class="promo26-feature-section"><p class="eyebrow">Release Channel</p><h2>Early Access Board</h2><div class="promo26-release-list"><article><span class="promo26-mini-badge">AVAILABLE</span><h3>Promotional Access V26</h3><p>Entitlement-based feature gates, campaign codes, direct grants, private workspaces, and fifteen promotional tools.</p></article><article><span class="promo26-mini-badge">PREVIEW</span><h3>Cognitus Labs Channel</h3><p>Experimental interfaces can appear here before they are made available to standard Cognitus accounts.</p></article><article><span class="promo26-mini-badge">POLICY</span><h3>Access without authority</h3><p>Early Access can unlock product capabilities, but it never grants staff roles, review authority, or access to otherwise restricted records.</p></article></div></section>`;
}

function bindDeletes(){
  C.root.querySelectorAll("[data-user-delete]").forEach((button)=>button.addEventListener("click",async()=>{if(!confirm("Remove this saved promotional item?"))return;await C.deleteUserData(button.dataset.userDelete);C.scheduleSync(true);}));
}

export async function renderFeaturePage(feature){
  if(feature.id==="intelligence_center")return intelligenceCenter(feature);
  if(feature.id==="relationship_mapping")return relationshipMapping(feature);
  if(feature.id==="deep_history")return deepHistory(feature);
  if(feature.id==="advanced_search")return advancedSearch(feature);
  if(feature.id==="account_comparison")return comparison(feature);
  if(feature.id==="network_explorer")return networkExplorer(feature);
  if(feature.id==="watchlist")return watchlist(feature);
  if(feature.id==="saved_investigations")return investigations(feature);
  if(feature.id==="intelligence_reports")return intelligenceReports(feature);
  if(feature.id==="change_comparison")return changeComparison(feature);
  if(feature.id==="cognitus_labs")return labs(feature);
  if(feature.id==="enhanced_profile")return enhancedProfile(feature);
  if(feature.id==="search_collections")return collections(feature);
  if(feature.id==="search_analytics")return analytics(feature);
  if(feature.id==="early_access")return earlyAccess(feature);
}
