import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "../firebase/firebaseApp.js";

export const FEATURES = Object.freeze([
  { id:"intelligence_center", route:"/intelligence", name:"Cognitus Intelligence Center", short:"Intelligence", badge:"BETA", description:"Build an organized intelligence view from Cognitus identity, screening, employment, and organization records you are already authorized to read." },
  { id:"relationship_mapping", route:"/relationships", name:"Relationship Mapping", short:"Relationship Map", badge:"BETA", description:"Visualize authorized links between a person, organizations, usernames, and known employment relationships." },
  { id:"deep_history", route:"/deep-history", name:"Deep History", short:"Deep History", badge:"BETA", description:"Turn available Cognitus records into a chronological subject timeline." },
  { id:"advanced_search", route:"/advanced-search", name:"Advanced Search", short:"Advanced Search", badge:"BETA", description:"Search and filter profiles across identity, standing, risk, aliases, and usernames without composite indexes." },
  { id:"account_comparison", route:"/compare", name:"Cognitus Comparison", short:"Comparison", badge:"BETA", description:"Compare two Cognitus profiles side-by-side and surface meaningful differences." },
  { id:"network_explorer", route:"/network", name:"Network Explorer", short:"Network Explorer", badge:"ALPHA", description:"Explore organizations and authorized employment-network records from one workspace." },
  { id:"watchlist", route:"/watchlist", name:"Watchlist", short:"Watchlist", badge:"BETA", description:"Save profiles you need to revisit and keep private notes on why they matter." },
  { id:"saved_investigations", route:"/investigations", name:"Saved Investigations", short:"Investigations", badge:"BETA", description:"Create private research workspaces with subjects, notes, and related organizations." },
  { id:"intelligence_reports", route:"/intelligence-reports", name:"Intelligence Reports", short:"Intel Reports", badge:"BETA", description:"Generate polished, printable intelligence summaries from records you are permitted to view." },
  { id:"change_comparison", route:"/change-comparison", name:"Account Change Comparison", short:"Change Compare", badge:"ALPHA", description:"Capture authorized profile snapshots and compare how a Cognitus profile changes over time." },
  { id:"cognitus_labs", route:"/labs", name:"Cognitus Labs", short:"Labs", badge:"ALPHA", description:"Access experimental Cognitus capabilities and preview tools before broad release." },
  { id:"enhanced_profile", route:"/enhanced-profile", name:"Enhanced Profile Cards", short:"Profile Studio", badge:"BETA", description:"Customize your Cognitus profile card and promotional-access presentation." },
  { id:"search_collections", route:"/collections", name:"Search Collections", short:"Collections", badge:"BETA", description:"Organize profiles and organizations into reusable private collections." },
  { id:"search_analytics", route:"/analytics", name:"Search Analytics", short:"Analytics", badge:"BETA", description:"Understand your Cognitus check activity, search patterns, and recent usage." },
  { id:"early_access", route:"/early-access", name:"Priority / Early Access", short:"Early Access", badge:"EARLY", description:"See preview releases and access programs reserved for promotional and early-access accounts." }
]);

export const FEATURE_BY_ID = new Map(FEATURES.map((feature)=>[feature.id,feature]));
export const FEATURE_BY_ROUTE = new Map(FEATURES.map((feature)=>[feature.route,feature]));
export const PROMO_ROUTES = new Set(["/promotional-access","/admin/promotions",...FEATURES.map((feature)=>feature.route)]);
export const USER_DATA_TYPES = Object.freeze(["watchlist","investigation","intelligence_report","snapshot","profile_customization","collection","search_event"]);

export const root = document.querySelector("#page-root");
export const nav = document.querySelector(".topnav");
export let auth = null;
export let db = null;
export let Auth = null;
export let Fire = null;
export let authUser = null;
export let userRecord = null;
export let profileRecord = null;
let sessionReady = false;
let accessCache = null;
let accessCacheAt = 0;
let syncTimers = [];
let handlers = null;

export const clean = (value)=>String(value ?? "").trim();
export const lower = (value)=>clean(value).toLowerCase();
export const safe = (value)=>String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
export const currentRoute = ()=>location.hash.replace(/^#/,"").split("?")[0] || "/";
export const hashParams = ()=>new URLSearchParams(location.hash.split("?")[1] || "");
export const normalizePromoCode = (value)=>clean(value).toUpperCase().replace(/\s+/g,"").replace(/[^A-Z0-9_-]/g,"").slice(0,40);
export const humanize = (value)=>clean(value).replaceAll("_"," ").replace(/\b\w/g,(letter)=>letter.toUpperCase());

export function timestampMs(value){
  try { const date=value?.toDate?.() || (value ? new Date(value) : null); return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0; }
  catch { return 0; }
}
export function formatTimestamp(value,fallback="—"){ const ms=timestampMs(value); return ms ? new Date(ms).toLocaleString() : fallback; }
export function formatDate(value,fallback="—"){ const ms=timestampMs(value); return ms ? new Date(ms).toLocaleDateString() : fallback; }
export function setTitle(title){ document.title=`${title} · Cognitus Solutions`; }
export function buttonLink(route,label,primary=false){ return `<a class="button ${primary?"button-dark":"button-light"}" href="#${safe(route)}">${safe(label)}</a>`; }
export function notice(message,tone="neutral"){ return `<div class="promo26-notice is-${safe(tone)}">${safe(message)}</div>`; }
export function formObject(form){ return Object.fromEntries(new FormData(form).entries()); }
export function selectedValues(form,name){ return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((input)=>input.value); }
export function setMessage(element,text,tone="neutral"){ if(!element)return; element.hidden=false; element.className=`promo26-notice is-${tone}`; element.textContent=text; }
export function setBusy(button,busy,busyText,normalText){ if(!button)return; button.disabled=busy; button.textContent=busy?busyText:normalText; }
export function toTimestampFromInput(value){ if(!clean(value))return null; const ms=new Date(value).getTime(); return Number.isFinite(ms)?Fire.Timestamp.fromMillis(ms):null; }
export function toDatetimeLocal(value){ const ms=timestampMs(value); if(!ms)return ""; const date=new Date(ms); return new Date(ms-date.getTimezoneOffset()*60000).toISOString().slice(0,16); }
export function randomCode(prefix="COG"){
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes=new Uint32Array(8); crypto.getRandomValues(bytes);
  const token=Array.from(bytes,(value)=>alphabet[value%alphabet.length]).join("");
  return `${normalizePromoCode(prefix).slice(0,12)||"COG"}-${token.slice(0,4)}-${token.slice(4)}`;
}

export function isAdmin(){ return userRecord?.status==="active" && ["admin","owner"].includes(userRecord?.role); }
export function isOwner(){ return userRecord?.status==="active" && userRecord?.role==="owner"; }
export function isActiveAccount(){ return Boolean(authUser && userRecord?.status==="active"); }

export async function loadFirebase(){
  if(Auth && Fire)return;
  const services=await initializeFirebaseServices();
  if(!services.ready)throw new Error("Firebase is not configured.");
  auth=services.auth; db=services.db;
  [Auth,Fire]=await Promise.all([import(`${FIREBASE_CDN_BASE}/firebase-auth.js`),import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`)]);
}
export async function readDoc(collectionName,id){ if(!id)return null; const snap=await Fire.getDoc(Fire.doc(db,collectionName,id)); return snap.exists()?{...snap.data(),id:snap.id}:null; }
export async function readWhere(collectionName,field,op,value,limit=250){
  const constraints=[Fire.where(field,op,value)]; if(limit)constraints.push(Fire.limit(limit));
  const snap=await Fire.getDocs(Fire.query(Fire.collection(db,collectionName),...constraints));
  return snap.docs.map((doc)=>({...doc.data(),id:doc.id}));
}
export async function safeReadWhere(collectionName,field,op,value,limit=250){ try{return await readWhere(collectionName,field,op,value,limit);}catch(error){console.info(`Promotional Access: ${collectionName} query unavailable`,error?.code||error?.message);return [];} }
export async function readCollection(collectionName,limit=250){ const snap=await Fire.getDocs(Fire.query(Fire.collection(db,collectionName),Fire.limit(limit))); return snap.docs.map((doc)=>({...doc.data(),id:doc.id})); }
export async function safeReadCollection(collectionName,limit=250){ try{return await readCollection(collectionName,limit);}catch(error){console.info(`Promotional Access: ${collectionName} unavailable`,error?.code||error?.message);return [];} }

export async function refreshSession(force=false){
  await loadFirebase();
  authUser=auth.currentUser;
  if(!authUser){ userRecord=null; profileRecord=null; sessionReady=true; accessCache=null; return null; }
  if(sessionReady && !force)return userRecord;
  [userRecord,profileRecord]=await Promise.all([readDoc("users",authUser.uid),readDoc("profiles",authUser.uid).catch(()=>null)]);
  sessionReady=true;
  return userRecord;
}
function timedActive(record){
  if(!record || record.status!=="active")return false;
  const expires=timestampMs(record.expiresAt); if(expires && expires<=Date.now())return false;
  if(record.campaignExpiryBehavior==="revoke_on_campaign_end"){
    const end=timestampMs(record.campaignEndsAt); if(end && end<=Date.now())return false;
  }
  return true;
}
export function invalidateAccess(){ accessCache=null; accessCacheAt=0; }
export async function loadAccess(force=false){
  await refreshSession(force);
  if(!authUser || !userRecord)return {features:new Set(),redemptions:[],grants:[],staffBypass:false};
  if(!force && accessCache && Date.now()-accessCacheAt<8000)return accessCache;
  const [redemptions,grants]=await Promise.all([
    safeReadWhere("promoRedemptions","uid","==",authUser.uid,200),
    safeReadWhere("promoAccessGrants","uid","==",authUser.uid,200)
  ]);
  const activeRedemptions=redemptions.filter(timedActive);
  const activeGrants=grants.filter(timedActive);
  const features=new Set();
  [...activeRedemptions,...activeGrants].forEach((row)=>(row.featureIds||[]).forEach((id)=>FEATURE_BY_ID.has(id)&&features.add(id)));
  const staffBypass=isAdmin();
  if(staffBypass)FEATURES.forEach((feature)=>features.add(feature.id));
  accessCache={features,redemptions:activeRedemptions,grants:activeGrants,staffBypass}; accessCacheAt=Date.now(); return accessCache;
}
export async function hasFeature(featureId){ const access=await loadAccess(); return access.features.has(featureId); }

export async function redeemCode(rawCode){
  await refreshSession(true);
  if(!isActiveAccount())throw new Error("An active Cognitus account is required.");
  const code=normalizePromoCode(rawCode); if(code.length<4)throw new Error("Enter a valid promotional code.");
  const promoRef=Fire.doc(db,"promotionalCodes",code);
  const redemptionRef=Fire.doc(db,"promoRedemptions",`${code}__${authUser.uid}`);
  const result=await Fire.runTransaction(db,async(transaction)=>{
    const promoSnap=await transaction.get(promoRef);
    if(!promoSnap.exists())throw new Error("That promotional code is not valid.");
    const existingSnap=await transaction.get(redemptionRef);
    const promo=promoSnap.data(); const now=Date.now();
    if(promo.status!=="active")throw new Error("That promotional code is not currently active.");
    if(timestampMs(promo.startsAt) && now<timestampMs(promo.startsAt))throw new Error("That promotional code is not active yet.");
    if(timestampMs(promo.redeemUntil) && now>timestampMs(promo.redeemUntil))throw new Error("That promotional code has expired.");
    if(Number(promo.maxTotalRedemptions||0)>0 && Number(promo.redeemedCount||0)>=Number(promo.maxTotalRedemptions))throw new Error("That promotional code has reached its redemption limit.");
    if(Array.isArray(promo.eligibleRoles) && !promo.eligibleRoles.includes(userRecord.role))throw new Error("Your Cognitus account is not eligible for this promotional code.");
    if(clean(promo.eligibleOrganizationId) && clean(userRecord.organizationId)!==clean(promo.eligibleOrganizationId))throw new Error("This code is restricted to another organization.");
    const previous=existingSnap.exists()?existingSnap.data():null;
    const redemptionCount=Number(previous?.redemptionCount||0)+1;
    if(redemptionCount>Number(promo.maxPerAccount||1))throw new Error("You have reached this code's per-account redemption limit.");
    let expiresAt=null;
    if(promo.accessMode==="duration")expiresAt=Fire.Timestamp.fromMillis(now+Math.max(3600,Number(promo.accessDurationSeconds||604800))*1000);
    if(promo.accessMode==="fixed_end"){
      expiresAt=promo.accessEndsAt||null;
      if(!expiresAt || timestampMs(expiresAt)<=now)throw new Error("The access period for this code has ended.");
    }
    const redemption={
      id:redemptionRef.id,promoId:code,code,uid:authUser.uid,userCognitusId:userRecord.cognitusId||"",redemptionCount,
      featureIds:Array.isArray(promo.featureIds)?promo.featureIds:[],status:"active",source:"promotional_code",
      grantedAt:previous?.grantedAt||Fire.serverTimestamp(),expiresAt,campaignEndsAt:promo.redeemUntil||null,
      campaignExpiryBehavior:promo.campaignExpiryBehavior||"preserve_access",lastRedeemedAt:Fire.serverTimestamp(),
      createdAt:previous?.createdAt||Fire.serverTimestamp(),updatedAt:Fire.serverTimestamp()
    };
    transaction.update(promoRef,{redeemedCount:Number(promo.redeemedCount||0)+1,updatedAt:Fire.serverTimestamp()});
    transaction.set(redemptionRef,redemption);
    return {promo,redemption};
  });
  invalidateAccess();
  await writePromoAudit("PROMO_REDEEMED",code,`Redeemed promotional code ${code}.`,{featureCount:result.redemption.featureIds.length});
  return result;
}

export async function writePromoAudit(action,targetId,summary,metadata={}){
  if(!authUser || !userRecord)return;
  try{
    const ref=Fire.doc(Fire.collection(db,"auditLogs"));
    const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789", bytes=new Uint32Array(7); crypto.getRandomValues(bytes);
    const token=Array.from(bytes,(value)=>alphabet[value%alphabet.length]).join("");
    await Fire.setDoc(ref,{id:ref.id,cognitusId:`AUD-${String(new Date().getFullYear()).slice(-2)}-${token}`,actorUid:authUser.uid,actorCognitusId:userRecord.cognitusId,actorRole:userRecord.role,action,targetType:"promotion",targetId:targetId||null,summary:clean(summary).slice(0,500),metadata,createdAt:Fire.serverTimestamp()});
  }catch(error){ console.info("Promotional audit event was not written",error?.code||error?.message); }
}

export async function loadUserData(type=null){
  if(!authUser)return [];
  const rows=await safeReadWhere("promoUserData","ownerUid","==",authUser.uid,500);
  return rows.filter((row)=>!type || row.type===type).sort((a,b)=>timestampMs(b.updatedAt)-timestampMs(a.updatedAt));
}
export async function createUserData(type,{title="",subjectId=null,organizationId=null,payload={}}={}){
  if(!USER_DATA_TYPES.includes(type))throw new Error("Unsupported promotional workspace record type.");
  const ref=Fire.doc(Fire.collection(db,"promoUserData"));
  await Fire.setDoc(ref,{id:ref.id,ownerUid:authUser.uid,type,title:clean(title).slice(0,120),subjectId:clean(subjectId)||null,organizationId:clean(organizationId)||null,payload,createdAt:Fire.serverTimestamp(),updatedAt:Fire.serverTimestamp()});
  return ref.id;
}
export async function updateUserData(id,changes){
  const allowed={}; ["title","subjectId","organizationId","payload"].forEach((key)=>{if(Object.hasOwn(changes,key))allowed[key]=changes[key];});
  allowed.updatedAt=Fire.serverTimestamp(); await Fire.updateDoc(Fire.doc(db,"promoUserData",id),allowed);
}
export async function deleteUserData(id){ await Fire.deleteDoc(Fire.doc(db,"promoUserData",id)); }

export async function findProfile(input){
  const value=clean(input); if(!value)return null;
  const byId=await readDoc("profiles",value).catch(()=>null); if(byId)return byId;
  const rows=await safeReadCollection("profiles",250);
  const needle=lower(value);
  return rows.find((profile)=>lower(profile.cognitusId)===needle || lower(profile.displayName)===needle || (profile.discordUsernamesNormalized||[]).includes(needle) || (profile.robloxUsernamesNormalized||[]).includes(needle)) || null;
}
export async function findOrganization(input){
  const value=clean(input); if(!value)return null;
  const byId=await readDoc("organizations",value).catch(()=>null); if(byId)return byId;
  const rows=await safeReadCollection("organizations",250); const needle=lower(value);
  return rows.find((org)=>lower(org.cognitusId)===needle || lower(org.name)===needle) || null;
}

function bindRedeemForms(){
  root?.querySelectorAll("[data-promo-redeem-form]").forEach((form)=>form.addEventListener("submit",async(event)=>{
    event.preventDefault(); const data=formObject(form); const button=form.querySelector('button[type="submit"]'); const message=form.querySelector("[data-promo-message]") || root.querySelector("[data-promo-message]");
    try{ setBusy(button,true,"Checking…","Redeem Code"); const result=await redeemCode(data.code); setMessage(message,`Unlocked ${result.redemption.featureIds.length} promotional feature${result.redemption.featureIds.length===1?"":"s"}.`,`success`); setTimeout(()=>scheduleSync(true),250); }
    catch(error){ setMessage(message,error?.message||"The code could not be redeemed.","error"); }
    finally{ setBusy(button,false,"Checking…","Redeem Code"); }
  }));
}

export function renderLockedFeature(feature){
  setTitle(`${feature.name} · Locked`);
  root.innerHTML=`<div class="promo26-locked-page" data-promo-v26-page>
    <div class="promo26-blurred-content" aria-hidden="true"><section class="promo26-preview-hero"><p class="eyebrow">${safe(feature.badge)}</p><h1>${safe(feature.name)}</h1><p>${safe(feature.description)}</p></section><section class="promo26-preview-grid">${["Subject intelligence","Authorized history","Connected records","Analysis workspace","Saved findings","Report output"].map((name)=>`<article class="promo26-preview-panel"><span>${safe(name)}</span><h3>Restricted Cognitus data</h3><p>Promotional Access required.</p></article>`).join("")}</section></div>
    <div class="promo26-lock-backdrop" role="dialog" aria-modal="true" aria-labelledby="promo26-lock-title"><section class="promo26-lock-modal"><div class="promo26-lock-icon" aria-hidden="true">🔒</div><p class="eyebrow">Restricted Feature</p><h2 id="promo26-lock-title">You do not currently have permission to view this!</h2><p class="promo26-lock-message">${safe(feature.name)} requires Promotional Access. The blurred page is only a synthetic preview; protected Cognitus records are not loaded until your access is verified.</p><form class="promo26-lock-form" data-promo-redeem-form><label>Promotional Code<input name="code" maxlength="40" autocomplete="off" placeholder="ENTER CODE" required></label><button class="button button-dark" type="submit">Redeem Code</button><div data-promo-message hidden></div></form><div class="promo26-lock-actions">${buttonLink("/promotional-access","Promotional Access")}<button class="button button-light" data-promo-back type="button">Go Back</button></div></section></div></div>`;
  bindRedeemForms();
  root.querySelector("[data-promo-back]")?.addEventListener("click",()=>history.length>1?history.back():location.hash="#/dashboard");
}

function mountStyles(){
  if(document.querySelector("#cognitus-promotional-v26"))return;
  const link=document.createElement("link"); link.id="cognitus-promotional-v26"; link.rel="stylesheet"; link.href="./src/promotionalAccessV26.css?v=20260904-v26"; document.head.appendChild(link);
}
function loginRequired(){
  setTitle("Promotional Access"); root.innerHTML=`<section class="hero hero-wide" data-promo-v26-page><p class="eyebrow">Login Required</p><h1>Sign in to continue.</h1><p>Promotional Access is attached to your Cognitus account.</p><div class="hero-actions">${buttonLink("/login","Login",true)}${buttonLink("/register","Create Account")}</div></section>`;
}

async function syncNav(){
  if(!nav)return; await refreshSession().catch(()=>null);
  nav.querySelectorAll("[data-promo26-nav]").forEach((node)=>node.remove());
  if(!nav.querySelector('a[href="#/dashboard"]') || !authUser || !userRecord)return;
  const access=await loadAccess().catch(()=>({features:new Set()}));
  const anchor=nav.querySelector('a[href="#/settings"]') || nav.querySelector("#logout-button");
  const nodes=[];
  const intelligence=document.createElement("a"); intelligence.href="#/intelligence"; intelligence.dataset.promo26Nav="intelligence"; intelligence.textContent=access.features.has("intelligence_center")?"Intelligence":"Intelligence 🔒"; nodes.push(intelligence);
  const accessLink=document.createElement("a"); accessLink.href="#/promotional-access"; accessLink.dataset.promo26Nav="access"; accessLink.textContent="Promotional Access"; nodes.push(accessLink);
  if(isAdmin()){ const adminLink=document.createElement("a"); adminLink.href="#/admin/promotions"; adminLink.dataset.promo26Nav="admin"; adminLink.textContent="Promotions"; nodes.push(adminLink); }
  nodes.forEach((node)=>anchor?nav.insertBefore(node,anchor):nav.appendChild(node));
}

async function renderPromoRoute(){
  if(!root || !PROMO_ROUTES.has(currentRoute()))return;
  await refreshSession();
  if(!authUser || !userRecord)return loginRequired();
  const route=currentRoute();
  if(route==="/promotional-access")return handlers.renderAccessHub();
  if(route==="/admin/promotions")return handlers.renderAdmin();
  const feature=FEATURE_BY_ROUTE.get(route); if(!feature)return;
  if(!(await hasFeature(feature.id)))return renderLockedFeature(feature);
  return handlers.renderFeature(feature);
}

export function scheduleSync(force=false){
  syncTimers.forEach(clearTimeout);
  if(force){sessionReady=false;invalidateAccess();}
  syncTimers=[0,100,280,650,1200,1900].map((delay)=>setTimeout(async()=>{ await renderPromoRoute().catch((error)=>{console.error("Promotional Access V26",error); if(PROMO_ROUTES.has(currentRoute()))root.innerHTML=`<section class="hero" data-promo-v26-page><p class="eyebrow">Promotional Access</p><h1>This page could not load.</h1>${notice(error?.message||"Unknown error","error")}</section>`;}); await syncNav().catch(()=>null); },delay));
}

export async function startPromotionalAccessV26(routeHandlers){
  handlers=routeHandlers; mountStyles(); await loadFirebase().catch(()=>null);
  if(Auth && auth)Auth.onAuthStateChanged(auth,(user)=>{authUser=user;sessionReady=false;invalidateAccess();scheduleSync(true);});
  window.addEventListener("hashchange",()=>scheduleSync(false));
  window.addEventListener("pageshow",()=>scheduleSync(false));
  window.addEventListener("DOMContentLoaded",()=>scheduleSync(false));
  scheduleSync(false);
}
