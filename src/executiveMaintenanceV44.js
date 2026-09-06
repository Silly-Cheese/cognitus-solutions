import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const ROUTE = "/executive";
const START_KEY = "__COGNITUS_EXECUTIVE_MAINTENANCE_V44_STARTED__";
const PANEL_ID = "executive-maintenance-v44";
const STYLE_ID = "cognitus-executive-maintenance-v44";
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
    title: clean(data.title),
    message: clean(data.message),
    etaText: clean(data.etaText),
    startedAt: data.startedAt || null,
    scheduledEndAt: data.scheduledEndAt || null,
    updatedAt: data.updatedAt || null
  };
}

let maintenance = normalizeMaintenance(null);
let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userRecord = null;
let observer = null;
let portalUnsubscribe = null;
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
  link.href = "./src/executiveMaintenanceV44.css?v=20260906-v44";
}

function withTimeout(promise, message, timeoutMs = REQUEST_TIMEOUT_MS) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); })
  ]).finally(() => clearTimeout(timer));
}

function timestampMs(value) {
  try {
    const date = value?.toDate?.() || (value ? new Date(value) : null);
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  } catch { return 0; }
}

function formatDateTime(value) {
  const ms = timestampMs(value);
  return ms ? new Date(ms).toLocaleString() : "Manual restoration";
}

function createId(prefix = "AUD") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(7);
  crypto.getRandomValues(bytes);
  return `${prefix}-${String(new Date().getFullYear()).slice(-2)}-${Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("")}`;
}

async function loadFirebase() {
  if (Auth && Fire && auth && db) return;
  const services = await withTimeout(initializeFirebaseServices(), "Firebase initialization timed out.");
  if (!services?.ready) throw new Error("Firebase is not configured.");
  auth = services.auth;
  db = services.db;
  [Auth, Fire] = await withTimeout(Promise.all([
    import(`${FIREBASE_CDN_BASE}/firebase-auth.js`),
    import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`)
  ]), "Firebase modules took too long to load.");
}

async function verifyOwner() {
  await loadFirebase();
  authUser = auth.currentUser;
  if (!authUser) return false;
  const snap = await withTimeout(Fire.getDoc(Fire.doc(db, "users", authUser.uid)), "Owner account verification timed out.");
  userRecord = snap.exists() ? { ...snap.data(), id: snap.id } : null;
  return Boolean(userRecord?.status === "active" && userRecord?.role === "owner");
}

function portalRef() {
  return Fire.doc(db, "settings", "portal");
}

async function readMaintenance() {
  const snap = await withTimeout(Fire.getDoc(portalRef()), "Maintenance state took too long to load.");
  maintenance = normalizeMaintenance(snap.exists() ? snap.data()?.maintenance : null);
}

function effectiveActive() {
  if (!maintenance.active) return false;
  const end = timestampMs(maintenance.scheduledEndAt);
  return !end || end > Date.now();
}

async function writeAudit(action, summary, metadata = {}) {
  try {
    const ref = Fire.doc(Fire.collection(db, "auditLogs"));
    await Fire.setDoc(ref, {
      id: ref.id,
      cognitusId: createId("AUD"),
      actorUid: authUser.uid,
      actorCognitusId: userRecord?.cognitusId || "",
      actorRole: "owner",
      action,
      targetType: "site_control",
      targetId: "settings/portal",
      summary: clean(summary).slice(0, 500),
      metadata,
      createdAt: Fire.serverTimestamp()
    });
  } catch (error) {
    console.info("Executive maintenance audit unavailable", error?.code || error?.message);
  }
}

function statusMarkup() {
  const active = effectiveActive();
  if (!active && maintenance.active) {
    return `<div class="exec-maint44-status is-expired"><span>Scheduled window elapsed</span><strong>The client gate is no longer blocking users.</strong><p>Restore the website state below to clear the stale maintenance flag.</p></div>`;
  }
  if (!active) {
    return `<div class="exec-maint44-status"><span>Website status</span><strong>ONLINE</strong><p>Normal Cognitus portal access is available.</p></div>`;
  }
  return `<div class="exec-maint44-status ${maintenance.mode === "emergency" ? "is-emergency" : "is-active"}"><span>${maintenance.mode === "emergency" ? "Emergency site pause" : "Maintenance mode"}</span><strong>ACCESS PAUSED</strong><p>${safe(maintenance.title || "Cognitus is temporarily unavailable.")}</p><small>${maintenance.scheduledEndAt ? `Scheduled end ${safe(formatDateTime(maintenance.scheduledEndAt))}` : "Manual restoration required"}</small></div>`;
}

function panelMarkup() {
  const active = effectiveActive();
  return `<section class="exec-maint44" id="${PANEL_ID}" data-executive-maintenance-v44>
    <div class="exec-maint44-head"><div><p class="eyebrow">Owner-Only Site Control</p><h2>Maintenance & Emergency Access Gate</h2><p>Temporarily pause normal Cognitus access so users are not pushed into severe lag, broken workflows, or an unstable release. Your active Owner account keeps a recovery bypass.</p></div>${statusMarkup()}</div>
    ${active || maintenance.active ? `
      <div class="exec-maint44-live">
        <div><span>Mode</span><strong>${safe(maintenance.mode === "emergency" ? "Emergency Pause" : "Maintenance")}</strong></div>
        <div><span>Public message</span><strong>${safe(maintenance.message || "Portal access is temporarily paused.")}</strong></div>
        <div><span>ETA</span><strong>${safe(maintenance.etaText || (maintenance.scheduledEndAt ? formatDateTime(maintenance.scheduledEndAt) : "Manual restoration"))}</strong></div>
      </div>
      <div class="exec-maint44-danger"><div><strong>Restore Cognitus</strong><span>Immediately remove the public maintenance gate and return normal portal access.</span></div><button class="button button-dark" type="button" data-maint44-restore>Restore Website</button></div>
    ` : `
      <form class="exec-maint44-form" data-maint44-form>
        <div class="exec-maint44-grid">
          <label>Access mode<select name="mode"><option value="maintenance" selected>Maintenance</option><option value="emergency">Emergency Pause</option></select><small>Emergency uses stronger public messaging but the same secure Owner bypass.</small></label>
          <label>Planned duration<select name="durationMinutes"><option value="0" selected>Until I restore it manually</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="240">4 hours</option></select><small>A scheduled end automatically stops the client gate when reached.</small></label>
        </div>
        <label>Public title<input name="title" maxlength="80" value="Cognitus is under maintenance." required></label>
        <label>Public message<textarea name="message" maxlength="300" rows="4" required>We are temporarily pausing access while the portal is stabilized and checked. Please try again shortly.</textarea></label>
        <label>ETA / status note<input name="etaText" maxlength="120" placeholder="Example: Expected back online within 30 minutes"></label>
        <div class="exec-maint44-choice"><label><input type="checkbox" name="confirmOwnerBypass" required> I understand that normal users will be blocked from the portal, while my active Owner account and the login recovery route remain available.</label></div>
        <div class="exec-maint44-actions"><button class="button button-dark" type="submit">Pause Website Access</button><button class="button exec-maint44-emergency" type="button" data-maint44-emergency>Emergency Pause Now</button></div>
      </form>
    `}
    <div class="exec-maint44-note"><strong>What this does</strong><p>This is a site-wide client access gate, not a destructive shutdown. It does not delete data, change report visibility, change Firestore permissions, stop Firebase, or take GitHub Pages offline. It gives users a controlled maintenance screen while you retain a recovery path.</p></div>
    <div class="exec-maint44-message" data-maint44-message hidden></div>
  </section>`;
}

function showMessage(message, tone = "neutral") {
  const node = document.querySelector("[data-maint44-message]");
  if (!node) return;
  node.hidden = false;
  node.className = `exec-maint44-message is-${tone}`;
  node.textContent = message;
}

async function activateFromData(data, forcedEmergency = false) {
  const mode = forcedEmergency ? "emergency" : (clean(data.get("mode")) === "emergency" ? "emergency" : "maintenance");
  const durationMinutes = forcedEmergency ? 0 : Math.max(0, Math.min(1440, Number(data.get("durationMinutes") || 0)));
  const now = Date.now();
  const next = {
    active: true,
    mode,
    title: (forcedEmergency ? "Cognitus is temporarily unavailable." : clean(data.get("title"))).slice(0, 80) || "Cognitus is under maintenance.",
    message: (forcedEmergency ? "Cognitus access has been temporarily paused while an urgent operational issue is being addressed. Please try again shortly." : clean(data.get("message"))).slice(0, 300),
    etaText: (forcedEmergency ? "Service will resume after emergency checks are complete." : clean(data.get("etaText"))).slice(0, 120),
    startedAt: Fire.serverTimestamp(),
    scheduledEndAt: durationMinutes ? Fire.Timestamp.fromMillis(now + durationMinutes * 60 * 1000) : null,
    updatedAt: Fire.serverTimestamp()
  };
  const wording = mode === "emergency" ? "EMERGENCY PAUSE" : "MAINTENANCE MODE";
  if (!confirm(`Activate ${wording} for Cognitus now? Normal users will be shown the maintenance screen.`)) return false;
  await withTimeout(Fire.setDoc(portalRef(), { maintenance: next }, { merge: true }), "Site pause request timed out.");
  await writeAudit(mode === "emergency" ? "SITE_EMERGENCY_LOCKED" : "SITE_MAINTENANCE_STARTED", `Activated Cognitus ${mode} access gate.`, { mode, durationMinutes });
  maintenance = normalizeMaintenance({ ...next, startedAt: new Date(), updatedAt: new Date() });
  return true;
}

async function restoreWebsite() {
  if (!confirm("Restore normal Cognitus access for everyone now?")) return false;
  const next = {
    ...maintenance,
    active: false,
    scheduledEndAt: null,
    updatedAt: Fire.serverTimestamp()
  };
  await withTimeout(Fire.setDoc(portalRef(), { maintenance: next }, { merge: true }), "Website restoration timed out.");
  await writeAudit("SITE_MAINTENANCE_ENDED", "Restored normal Cognitus portal access.", { previousMode: maintenance.mode });
  maintenance = normalizeMaintenance({ ...next, updatedAt: new Date() });
  return true;
}

function bindPanel() {
  document.querySelector("[data-maint44-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    button.disabled = true;
    try {
      if (await activateFromData(data, false)) {
        showMessage("Maintenance access gate activated.", "success");
        await readMaintenance();
        injectPanel(true);
      }
    } catch (error) { showMessage(error?.message || "Maintenance mode could not be activated.", "error"); }
    finally { button.disabled = false; }
  });

  document.querySelector("[data-maint44-emergency]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const form = document.querySelector("[data-maint44-form]");
    button.disabled = true;
    try {
      if (!form) throw new Error("Maintenance controls changed before the emergency pause could start. Retry the Owner workspace.");
      if (await activateFromData(new FormData(form), true)) {
        await readMaintenance();
        injectPanel(true);
      }
    } catch (error) { showMessage(error?.message || "Emergency pause could not be activated.", "error"); }
    finally { button.disabled = false; }
  });

  document.querySelector("[data-maint44-restore]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (await restoreWebsite()) {
        await readMaintenance();
        injectPanel(true);
      }
    } catch (error) { showMessage(error?.message || "Website access could not be restored.", "error"); }
    finally { button.disabled = false; }
  });
}

function injectPanel(force = false) {
  if (!initialized || route() !== ROUTE || userRecord?.status !== "active" || userRecord?.role !== "owner") return;
  const workspace = document.querySelector(".exec43-workspace");
  if (!workspace) return;
  const existing = document.querySelector(`#${PANEL_ID}`);
  if (existing && !force) return;
  existing?.remove();
  workspace.insertAdjacentHTML("beforeend", panelMarkup());
  bindPanel();
}

function listenPortal() {
  portalUnsubscribe?.();
  portalUnsubscribe = Fire.onSnapshot(portalRef(), (snap) => {
    maintenance = normalizeMaintenance(snap.exists() ? snap.data()?.maintenance : null);
    injectPanel(true);
  }, (error) => console.info("Executive maintenance listener unavailable", error?.code || error?.message));
}

async function initialize() {
  if (initializing) return initializing;
  initializing = (async () => {
    try {
      mountStyles();
      if (!(await verifyOwner())) return false;
      await readMaintenance().catch(()=>null);
      initialized = true;
      injectPanel(true);
      listenPortal();
      return true;
    } catch (error) {
      console.info("Executive Maintenance V44 unavailable", error?.message || error);
      initialized = false;
      return false;
    } finally { initializing = null; }
  })();
  return initializing;
}

function installObserver() {
  const root = document.querySelector("#page-root");
  if (!root || observer) return;
  observer = new MutationObserver(() => {
    if (route() === ROUTE && initialized && !document.querySelector(`#${PANEL_ID}`)) queueMicrotask(() => injectPanel(false));
  });
  observer.observe(root, { childList: true, subtree: false });
}

export function startExecutiveMaintenanceV44() {
  mountStyles();
  installObserver();
  if (!window[START_KEY]) {
    window[START_KEY] = true;
    window.addEventListener("hashchange", () => { if (route() === ROUTE) initialize(); });
    window.addEventListener("pageshow", () => { if (route() === ROUTE) injectPanel(false); });
  }
  if (route() === ROUTE) initialize();
  return true;
}
