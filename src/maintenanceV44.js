import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const STYLE_ID = "cognitus-maintenance-v44";
const OVERLAY_ID = "cognitus-maintenance-overlay-v44";
const RIBBON_ID = "cognitus-maintenance-owner-ribbon-v44";
const PORTAL_COLLECTION = "settings";
const PORTAL_DOC = "portal";
const START_KEY = "__COGNITUS_MAINTENANCE_V44_STARTED__";
const REQUEST_TIMEOUT_MS = 9000;

const clean = (value) => String(value ?? "").trim();
const safe = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";

function normalizeMaintenance(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  return {
    active: data.active === true,
    mode: data.mode === "emergency" ? "emergency" : "maintenance",
    title: clean(data.title) || (data.mode === "emergency" ? "Cognitus is temporarily unavailable." : "Cognitus is under maintenance."),
    message: clean(data.message) || "We are temporarily pausing access while the portal is stabilized and checked. Please try again shortly.",
    etaText: clean(data.etaText),
    startedAt: data.startedAt || null,
    scheduledEndAt: data.scheduledEndAt || null,
    activatedByUid: clean(data.activatedByUid),
    activatedByCognitusId: clean(data.activatedByCognitusId),
    updatedAt: data.updatedAt || null
  };
}

let maintenanceState = normalizeMaintenance(null);
let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let activeOwner = false;
let portalUnsubscribe = null;
let authUnsubscribe = null;
let initialized = false;
let initializing = null;

function mountStyles() {
  let link = document.querySelector(`#${STYLE_ID}`);
  if (!link) {
    link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = "./src/maintenanceV44.css?v=20260906-v44";
}

function withTimeout(promise, message, timeoutMs = REQUEST_TIMEOUT_MS) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

function timestampMs(value) {
  try {
    const date = value?.toDate?.() || (value ? new Date(value) : null);
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  } catch {
    return 0;
  }
}

function formatDateTime(value) {
  const ms = timestampMs(value);
  return ms ? new Date(ms).toLocaleString() : "";
}

function effectiveMaintenance() {
  if (!maintenanceState.active) return false;
  const end = timestampMs(maintenanceState.scheduledEndAt);
  return !end || end > Date.now();
}

function isRecoveryRoute() {
  return route() === "/login";
}

function maintenanceMarkup() {
  const emergency = maintenanceState.mode === "emergency";
  const eta = maintenanceState.etaText || (maintenanceState.scheduledEndAt ? `Expected restoration: ${formatDateTime(maintenanceState.scheduledEndAt)}` : "Service will resume after operational checks are complete.");
  return `<div class="maintenance44-backdrop ${emergency ? "is-emergency" : "is-maintenance"}" role="dialog" aria-modal="true" aria-labelledby="maintenance44-title">
    <main class="maintenance44-card">
      <div class="maintenance44-brand"><span>CS</span><strong>Cognitus Solutions</strong></div>
      <p class="maintenance44-eyebrow">${emergency ? "Emergency Service Pause" : "Scheduled / Operational Maintenance"}</p>
      <h1 id="maintenance44-title">${safe(maintenanceState.title)}</h1>
      <p class="maintenance44-message">${safe(maintenanceState.message)}</p>
      <div class="maintenance44-status"><span></span><div><strong>Portal access is temporarily paused.</strong><small>${safe(eta)}</small></div></div>
      <p class="maintenance44-explainer">This pause protects users from unstable pages, severe lag, incomplete workflows, or active maintenance while Cognitus is being checked.</p>
      <div class="maintenance44-actions"><button type="button" data-maintenance44-check>Check Again</button><a href="#/login">Administrative Sign-in</a></div>
      <small class="maintenance44-foot">Your Cognitus records remain stored normally. This screen only pauses normal portal access.</small>
    </main>
  </div>`;
}

function recoveryNoticeMarkup() {
  return `<div class="maintenance44-recovery ${maintenanceState.mode === "emergency" ? "is-emergency" : ""}"><strong>${safe(maintenanceState.mode === "emergency" ? "Emergency pause active" : "Maintenance mode active")}</strong><span>Normal Cognitus access is paused. Owner sign-in remains available for recovery.</span></div>`;
}

function ownerRibbonMarkup() {
  return `<div class="maintenance44-owner-ribbon ${maintenanceState.mode === "emergency" ? "is-emergency" : ""}"><div><strong>${maintenanceState.mode === "emergency" ? "EMERGENCY PAUSE ACTIVE" : "MAINTENANCE MODE ACTIVE"}</strong><span>You are bypassing the site gate as the active Owner.</span></div><a href="#/executive">Executive Control</a></div>`;
}

function removeNode(id) {
  document.querySelector(`#${id}`)?.remove();
}

function applyGate() {
  const active = effectiveMaintenance();
  document.documentElement.toggleAttribute("data-cognitus-maintenance", active);
  document.documentElement.setAttribute("data-cognitus-maintenance-mode", active ? maintenanceState.mode : "off");

  if (!active) {
    removeNode(OVERLAY_ID);
    removeNode(RIBBON_ID);
    document.querySelector(".maintenance44-recovery")?.remove();
    return;
  }

  if (activeOwner) {
    removeNode(OVERLAY_ID);
    document.querySelector(".maintenance44-recovery")?.remove();
    let ribbon = document.querySelector(`#${RIBBON_ID}`);
    if (!ribbon) {
      ribbon = document.createElement("div");
      ribbon.id = RIBBON_ID;
      document.body.appendChild(ribbon);
    }
    ribbon.innerHTML = ownerRibbonMarkup();
    return;
  }

  removeNode(RIBBON_ID);
  if (isRecoveryRoute()) {
    removeNode(OVERLAY_ID);
    let notice = document.querySelector(".maintenance44-recovery");
    if (!notice) {
      notice = document.createElement("div");
      notice.className = "maintenance44-recovery";
      document.body.appendChild(notice);
    }
    notice.outerHTML = recoveryNoticeMarkup();
    return;
  }

  document.querySelector(".maintenance44-recovery")?.remove();
  let overlay = document.querySelector(`#${OVERLAY_ID}`);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = maintenanceMarkup();
  overlay.querySelector("[data-maintenance44-check]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try { await refreshPortalOnce(); }
    finally { event.currentTarget.disabled = false; }
  });
}

async function loadFirebase() {
  if (Auth && Fire && auth && db) return;
  const services = await withTimeout(initializeFirebaseServices(), "Maintenance status could not reach Firebase.");
  if (!services?.ready) throw new Error("Firebase is not configured.");
  auth = services.auth;
  db = services.db;
  [Auth, Fire] = await withTimeout(Promise.all([
    import(`${FIREBASE_CDN_BASE}/firebase-auth.js`),
    import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`)
  ]), "Maintenance status modules took too long to load.");
}

async function evaluateOwner(user) {
  authUser = user || null;
  activeOwner = false;
  if (!authUser || !db || !Fire) {
    applyGate();
    return;
  }
  try {
    const snap = await withTimeout(Fire.getDoc(Fire.doc(db, "users", authUser.uid)), "Owner bypass verification timed out.");
    const record = snap.exists() ? snap.data() : null;
    activeOwner = Boolean(record?.status === "active" && record?.role === "owner");
  } catch (error) {
    console.info("Maintenance V44 Owner bypass unavailable", error?.code || error?.message);
    activeOwner = false;
  }
  applyGate();
}

async function refreshPortalOnce() {
  if (!db || !Fire) await loadFirebase();
  try {
    const snap = await withTimeout(Fire.getDoc(Fire.doc(db, PORTAL_COLLECTION, PORTAL_DOC)), "Maintenance state refresh timed out.");
    maintenanceState = normalizeMaintenance(snap.exists() ? snap.data()?.maintenance : null);
  } catch (error) {
    console.info("Maintenance V44 state refresh unavailable", error?.code || error?.message);
  }
  applyGate();
}

function listenPortal() {
  portalUnsubscribe?.();
  portalUnsubscribe = Fire.onSnapshot(Fire.doc(db, PORTAL_COLLECTION, PORTAL_DOC), (snap) => {
    maintenanceState = normalizeMaintenance(snap.exists() ? snap.data()?.maintenance : null);
    applyGate();
  }, (error) => console.info("Maintenance V44 live state unavailable", error?.code || error?.message));
}

function listenAuth() {
  authUnsubscribe?.();
  authUnsubscribe = Auth.onAuthStateChanged(auth, (user) => evaluateOwner(user));
}

async function initialize() {
  if (initializing) return initializing;
  initializing = (async () => {
    mountStyles();
    try {
      await loadFirebase();
      await refreshPortalOnce();
      await evaluateOwner(auth.currentUser);
      listenPortal();
      listenAuth();
      initialized = true;
    } catch (error) {
      console.info("Maintenance V44 initialization unavailable", error?.message || error);
      initialized = false;
    } finally {
      initializing = null;
      applyGate();
    }
  })();
  return initializing;
}

export function startMaintenanceV44() {
  mountStyles();
  if (!window[START_KEY]) {
    window[START_KEY] = true;
    window.addEventListener("hashchange", applyGate);
    window.addEventListener("pageshow", applyGate);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && initialized) refreshPortalOnce();
    });
  }
  initialize();
  return true;
}

startMaintenanceV44();
