import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
const nav = document.querySelector(".topnav");
let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let loading = false;
let cached = null;
let cacheAt = 0;

function clean(value){ return String(value ?? "").trim(); }
function safe(value){ return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function route(){ return location.hash.replace(/^#/,"").split("?")[0] || "/"; }
function timeMs(value){
  try { const d = value?.toDate?.() || (value ? new Date(value) : null); return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0; } catch { return 0; }
}
function formatDate(value){
  const ms=timeMs(value); return ms ? new Date(ms).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}) : "—";
}
function activeAssignment(item){
  if(item.revoked === true || item.status === "revoked") return false;
  if(!item.expiresAt) return true;
  return timeMs(item.expiresAt) > Date.now();
}

function injectStyles(){
  if(document.querySelector("#account-badges-v1-css")) return;
  const link=document.createElement("link");
  link.id="account-badges-v1-css";
  link.rel="stylesheet";
  link.href="./src/accountBadgesV1.css?v=20260924-v1";
  document.head.appendChild(link);
}

async function loadBadges(force=false){
  if(!authUser) return [];
  if(!force && cached && Date.now()-cacheAt < 12000) return cached;
  const [badgeSnap,assignmentSnap]=await Promise.all([
    Fire.getDocs(Fire.collection(db,"accountBadges")),
    Fire.getDocs(Fire.query(Fire.collection(db,"accountBadgeAssignments"),Fire.where("userUid","==",authUser.uid)))
  ]);
  const defs=new Map(badgeSnap.docs.map((doc)=>[doc.id,{...doc.data(),id:doc.id}]));
  cached=assignmentSnap.docs.map((doc)=>({...doc.data(),id:doc.id}))
    .filter(activeAssignment)
    .map((assignment)=>({assignment,badge:defs.get(assignment.badgeId)}))
    .filter((item)=>item.badge && item.badge.active !== false && item.badge.visibility !== "staff")
    .sort((a,b)=>{
      const featured=(b.assignment.featured === true ? 1 : 0)-(a.assignment.featured === true ? 1 : 0);
      return featured || timeMs(b.assignment.awardedAt)-timeMs(a.assignment.awardedAt);
    });
  cacheAt=Date.now();
  return cached;
}

function marker(item,compact=false){
  const b=item.badge;
  const title=(b.name || "Account badge") + (b.description ? " — " + b.description : "");
  return '<button class="cab-marker cab-accent-' + safe(b.accent || "slate") + (compact ? ' is-compact' : '') + '" type="button" data-cab-open="' + safe(item.assignment.id) + '" title="' + safe(title) + '" aria-label="' + safe(title) + '"><span class="cab-icon">' + safe(b.icon || "◆") + '</span>' + (compact ? '' : '<span>' + safe(b.name || "Badge") + '</span>') + '</button>';
}

function removeExisting(){
  document.querySelectorAll("[data-cab-profile-markers],[data-cab-profile-panel],[data-cab-nav-markers],[data-cab-dialog]").forEach((node)=>node.remove());
}

function openBadge(item){
  document.querySelector("[data-cab-dialog]")?.remove();
  const assignment=item.assignment;
  const badge=item.badge;
  const wrap=document.createElement("div");
  wrap.className="cab-dialog-backdrop";
  wrap.dataset.cabDialog="true";
  wrap.innerHTML='<section class="cab-dialog" role="dialog" aria-modal="true" aria-label="' + safe(badge.name || "Account badge") + '">' +
    '<button class="cab-dialog-close" type="button" data-cab-close aria-label="Close">×</button>' +
    '<div class="cab-dialog-icon cab-accent-' + safe(badge.accent || "slate") + '">' + safe(badge.icon || "◆") + '</div>' +
    '<p class="eyebrow">Cognitus Account Marker</p><h2>' + safe(badge.name || "Recognition") + '</h2><p>' + safe(badge.description || "Cognitus account recognition.") + '</p>' +
    '<dl><div><dt>Awarded</dt><dd>' + safe(formatDate(assignment.awardedAt || assignment.createdAt)) + '</dd></div>' +
    (assignment.reason ? '<div><dt>Recognition</dt><dd>' + safe(assignment.reason) + '</dd></div>' : '') +
    (assignment.expiresAt ? '<div><dt>Expires</dt><dd>' + safe(formatDate(assignment.expiresAt)) + '</dd></div>' : '<div><dt>Status</dt><dd>Permanent marker</dd></div>') +
    '</dl></section>';
  document.body.appendChild(wrap);
  const close=()=>wrap.remove();
  wrap.addEventListener("click",(event)=>{ if(event.target===wrap || event.target.closest("[data-cab-close]")) close(); });
  document.addEventListener("keydown",function esc(event){ if(event.key==="Escape"){ close(); document.removeEventListener("keydown",esc); } });
}

function bindMarkers(items){
  const byId=new Map(items.map((item)=>[item.assignment.id,item]));
  document.querySelectorAll("[data-cab-open]").forEach((button)=>button.addEventListener("click",()=>{ const item=byId.get(button.dataset.cabOpen); if(item) openBadge(item); }));
}

function renderNavMarkers(items){
  const navUser=nav?.querySelector(".nav-user");
  if(!navUser || !items.length || navUser.querySelector("[data-cab-nav-markers]")) return;
  const span=document.createElement("span");
  span.className="cab-nav-markers";
  span.dataset.cabNavMarkers="true";
  span.innerHTML=items.slice(0,3).map((item)=>marker(item,true)).join("") + (items.length>3 ? '<span class="cab-more">+' + (items.length-3) + '</span>' : '');
  navUser.appendChild(span);
}

function renderProfile(items){
  if(route() !== "/profile" || !root || !items.length) return;
  if(root.querySelector("[data-cab-profile-panel]")) return;
  const hero=root.querySelector(".hero");
  const heading=hero?.querySelector("h1") || root.querySelector("h1");
  if(heading && !heading.parentElement.querySelector("[data-cab-profile-markers]")){
    const row=document.createElement("div");
    row.className="cab-profile-markers";
    row.dataset.cabProfileMarkers="true";
    row.innerHTML=items.slice(0,5).map((item)=>marker(item,false)).join("") + (items.length>5 ? '<span class="cab-more">+' + (items.length-5) + ' more</span>' : '');
    heading.insertAdjacentElement("afterend",row);
  }

  const panel=document.createElement("section");
  panel.className="panel cab-panel";
  panel.dataset.cabProfilePanel="true";
  panel.innerHTML='<div class="panel-header"><div><p class="eyebrow">Recognition</p><h2>Account badges</h2></div><span>' + items.length + ' marker' + (items.length===1 ? '' : 's') + '</span></div>' +
    '<p class="cab-panel-copy">These markers recognize things you have done for Cognitus. They do not grant permissions or staff authority.</p>' +
    '<div class="cab-gallery">' + items.map((item)=>'<article class="cab-card"><div class="cab-card-icon cab-accent-' + safe(item.badge.accent || "slate") + '">' + safe(item.badge.icon || "◆") + '</div><div><strong>' + safe(item.badge.name || "Badge") + '</strong><p>' + safe(item.badge.description || "Cognitus account recognition.") + '</p><small>Awarded ' + safe(formatDate(item.assignment.awardedAt || item.assignment.createdAt)) + (item.assignment.reason ? ' · ' + safe(item.assignment.reason) : '') + '</small></div><button type="button" class="button button-light" data-cab-open="' + safe(item.assignment.id) + '">View</button></article>').join("") + '</div>';
  if(hero?.parentNode) hero.insertAdjacentElement("afterend",panel);
  else root.prepend(panel);
}

async function enhance(force=false){
  if(!authUser || loading) return;
  loading=true;
  try{
    const items=await loadBadges(force);
    if(force) removeExisting();
    renderNavMarkers(items);
    renderProfile(items);
    bindMarkers(items);
  }catch(error){
    console.warn("Cognitus account badges could not be loaded",error);
  }finally{ loading=false; }
}

function schedule(force=false){
  [30,220,700].forEach((delay,index)=>window.setTimeout(()=>enhance(force && index===0),delay));
}

async function init(){
  injectStyles();
  const services=await initializeFirebaseServices();
  if(!services.ready) return;
  auth=services.auth; db=services.db;
  [Auth,Fire]=await Promise.all([
    import(FIREBASE_CDN_BASE + "/firebase-auth.js"),
    import(FIREBASE_CDN_BASE + "/firebase-firestore.js")
  ]);
  Auth.onAuthStateChanged(auth,(user)=>{
    authUser=user;
    cached=null;
    cacheAt=0;
    schedule(true);
  });
  window.addEventListener("hashchange",()=>{ document.querySelector("[data-cab-dialog]")?.remove(); schedule(false); });
  if(root) new MutationObserver(()=>schedule(false)).observe(root,{childList:true,subtree:false});
  if(nav) new MutationObserver(()=>schedule(false)).observe(nav,{childList:true,subtree:true});
  schedule();
}

init().catch((error)=>console.warn("Cognitus Account Badges V1 failed to initialize",error));
