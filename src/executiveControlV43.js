import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
const ROUTE = "/executive";
const START_KEY = "__COGNITUS_EXECUTIVE_V43_STARTED__";
const PORTAL_COLLECTION = "settings";
const PORTAL_DOC = "portal";
const REQUEST_TIMEOUT_MS = 9000;

const clean = (value) => String(value ?? "").trim();
const safe = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";

let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userRecord = null;
let portalUnsubscribe = null;
let observer = null;
let countdownTimer = null;
let renderGeneration = 0;
let initialized = false;
let initializing = null;
let frenzyState = normalizeFrenzy(null);

function normalizeFrenzy(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  return {
    active: data.active === true,
    eventId: clean(data.eventId),
    title: clean(data.title) || "Frenzy Mode",
    message: clean(data.message) || "A Cognitus live event is active.",
    announcement: clean(data.announcement),
    level: Math.max(0, Math.min(100, Number(data.level || 0))),
    audience: clean(data.audience) || "all_active_accounts",
    signalZeroEnabled: data.signalZeroEnabled !== false,
    startedAt: data.startedAt || null,
    endsAt: data.endsAt || null,
    endedAt: data.endedAt || null,
    dropActive: data.dropActive === true,
    dropLabel: clean(data.dropLabel),
    dropCode: clean(data.dropCode),
    activatedByUid: clean(data.activatedByUid),
    activatedByCognitusId: clean(data.activatedByCognitusId),
    updatedAt: data.updatedAt || null
  };
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

function effectiveActive() {
  if (!frenzyState.active) return false;
  const end = timestampMs(frenzyState.endsAt);
  return !end || end > Date.now();
}

function remainingMs() {
  const end = timestampMs(frenzyState.endsAt);
  return end ? Math.max(0, end - Date.now()) : 0;
}

function formatRemaining(ms) {
  if (!ms) return "00:00";
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(value) {
  const ms = timestampMs(value);
  return ms ? new Date(ms).toLocaleString() : "—";
}

function createId(prefix, length = 7) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return `${prefix}-${String(new Date().getFullYear()).slice(-2)}-${Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("")}`;
}

function loadingMarkup(message = "Verifying the active Owner session and preparing live event controls.") {
  return `<section class="exec43-loading" data-executive-v43-page data-executive-v35-page>
    <p class="eyebrow">Executive Control</p>
    <h1>Opening Executive Control.</h1>
    <p>${safe(message)}</p>
    <div class="exec43-loading-bar" aria-hidden="true"><span></span></div>
  </section>`;
}

function failureMarkup(message) {
  return `<section class="exec43-loading" data-executive-v43-page data-executive-v35-page>
    <p class="eyebrow">Executive Control</p>
    <h1>Executive Control could not initialize.</h1>
    <p>${safe(message || "The secure Owner workspace did not finish loading.")}</p>
    <div class="hero-actions"><button class="button button-dark" type="button" data-exec43-retry>Retry Executive Control</button><a class="button button-light" href="#/dashboard">Dashboard</a></div>
  </section>`;
}

function restrictedMarkup() {
  return `<section class="exec43-loading" data-executive-v43-page data-executive-v35-page>
    <p class="eyebrow">Restricted Workspace</p>
    <h1>Executive Control</h1>
    <p>This workspace is available only to an active Cognitus Owner account.</p>
    <div class="hero-actions"><a class="button button-dark" href="#/dashboard">Return to Dashboard</a></div>
  </section>`;
}

function stat(label, value, note = "") {
  return `<article class="exec43-stat"><span>${safe(label)}</span><strong>${safe(value)}</strong>${note ? `<small>${safe(note)}</small>` : ""}</article>`;
}

function executiveMarkup() {
  const active = effectiveActive();
  const level = Math.round(frenzyState.level);
  const status = active ? "ACTIVE" : "INACTIVE";
  return `<div class="exec43-workspace" data-executive-v43-page data-executive-v35-page>
    <header class="exec43-hero">
      <div><p class="eyebrow">Owner Workspace · Executive Control</p><h1>Executive_Eagle</h1><p>Control site-wide Cognitus events from one restricted workspace. Frenzy changes presentation and temporary feature windows; it never changes protected-record permissions.</p></div>
      <aside class="exec43-owner"><span>Authenticated authority</span><strong>${safe(userRecord?.displayName || "Executive_Eagle")}</strong><small>${safe(userRecord?.cognitusId || authUser?.uid || "Owner")}</small></aside>
    </header>

    <section class="exec43-stats">
      ${stat("Frenzy status", status, frenzyState.eventId || "No active event")}
      ${stat("Frenzy level", `${level}%`, active ? "Live site value" : "Awaiting activation")}
      ${stat("Time remaining", active ? formatRemaining(remainingMs()) : "—", active ? `Ends ${formatDateTime(frenzyState.endsAt)}` : "No live countdown")}
      ${stat("Signal Zero", active && frenzyState.signalZeroEnabled ? "OPEN" : "DORMANT", "Entitlement + active Frenzy required")}
    </section>

    <section class="exec43-layout">
      <section class="exec43-panel ${active ? "is-live" : ""}">
        <div class="exec43-panel-head"><div><p class="eyebrow">${active ? "Live Event" : "Event Setup"}</p><h2>${active ? "Frenzy is live." : "Initiate Frenzy Mode"}</h2><p>${active ? "Changes publish to connected Cognitus sessions as the portal document updates." : "Configure a temporary event window, optional drop, and Signal Zero activation."}</p></div></div>
        ${active ? `
          <div class="exec43-live-card"><div><span>Event ID</span><strong>${safe(frenzyState.eventId)}</strong></div><p>${safe(frenzyState.announcement || frenzyState.message)}</p></div>
          <div class="exec43-actions" data-exec43-levels>
            <button class="button button-light" type="button" data-level="${Math.max(0, level - 5)}">−5%</button>
            <button class="button button-light" type="button" data-level="${Math.min(100, level + 5)}">+5%</button>
            <button class="button button-light" type="button" data-level="${Math.min(100, level + 10)}">+10%</button>
            <button class="button button-dark" type="button" data-level="100">Maximum Frenzy</button>
            <button class="button button-light" type="button" data-exec43-extend>Extend 10 min</button>
          </div>
          <form class="exec43-form" data-exec43-announcement>
            <label>Live announcement<textarea name="announcement" maxlength="240" rows="3" placeholder="Message shown in the Frenzy status bar">${safe(frenzyState.announcement)}</textarea></label>
            <button class="button button-dark" type="submit">Publish Announcement</button>
          </form>
          <form class="exec43-form" data-exec43-drop>
            <div class="exec43-form-row"><label>Drop label<input name="dropLabel" maxlength="80" value="${safe(frenzyState.dropLabel)}" placeholder="Frenzy Drop"></label><label>Drop code<input name="dropCode" maxlength="80" value="${safe(frenzyState.dropCode)}" placeholder="PROMO-CODE"></label></div>
            <label class="checkbox-line"><input type="checkbox" name="dropActive" ${frenzyState.dropActive ? "checked" : ""}> Show this drop in the Frenzy banner</label>
            <button class="button button-light" type="submit">Update Drop</button>
          </form>
          <div class="exec43-danger"><div><strong>Emergency shutdown</strong><span>Immediately ends the active Frenzy window.</span></div><button class="button button-light" type="button" data-exec43-end>End Frenzy</button></div>
        ` : `
          <form class="exec43-form" data-exec43-activate>
            <div class="exec43-form-row"><label>Duration<select name="durationMinutes"><option value="15">15 minutes</option><option value="30" selected>30 minutes</option><option value="60">1 hour</option><option value="90">90 minutes</option><option value="120">2 hours</option></select></label><label>Starting level<input name="level" type="number" min="0" max="100" value="0"></label></div>
            <label>Opening message<textarea name="message" maxlength="240" rows="4" placeholder="Executive_Eagle has initiated a Cognitus Frenzy event."></textarea></label>
            <label class="checkbox-line"><input type="checkbox" name="signalZeroEnabled" checked> Open the Signal Zero activation window during this event</label>
            <div class="exec43-form-row"><label>Optional drop label<input name="dropLabel" maxlength="80" placeholder="Frenzy Drop"></label><label>Optional drop code<input name="dropCode" maxlength="80" placeholder="PROMO-CODE"></label></div>
            <button class="button button-dark" type="submit">Initiate Frenzy Mode</button>
          </form>`}
        <div class="exec43-message" data-exec43-message hidden></div>
      </section>

      <aside class="exec43-panel exec43-guardrails">
        <p class="eyebrow">Operational Guardrails</p><h2>Frenzy does not override security.</h2>
        <div class="exec43-rule"><strong>Signal Zero</strong><span>Requires a valid promotional entitlement and an active Frenzy window.</span></div>
        <div class="exec43-rule"><strong>Protected records</strong><span>Existing roles, visibility states, and Firestore rules remain authoritative.</span></div>
        <div class="exec43-rule"><strong>Automatic expiry</strong><span>The client treats Frenzy as closed when the configured end time passes.</span></div>
        <div class="exec43-rule"><strong>Audit trail</strong><span>Executive event actions are written to the Cognitus audit log when permitted.</span></div>
        <div class="hero-actions"><a class="button button-light" href="#/admin/promotions">Feature Access Management</a><a class="button button-light" href="#/promotional-access">Feature Access</a></div>
      </aside>
    </section>
  </div>`;
}

function mountStyles() {
  let link = document.querySelector("#cognitus-executive-v43");
  if (!link) {
    link = document.createElement("link");
    link.id = "cognitus-executive-v43";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = "./src/executiveControlV43.css?v=20260906-v43";
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

async function waitForAuthState() {
  if (auth?.currentUser) return auth.currentUser;
  return withTimeout(new Promise((resolve) => {
    let unsubscribe = null;
    unsubscribe = Auth.onAuthStateChanged(auth, (user) => {
      unsubscribe?.();
      resolve(user || null);
    });
  }), "The Cognitus sign-in session took too long to verify.");
}

async function readOwnerSession() {
  await loadFirebase();
  authUser = await waitForAuthState();
  if (!authUser) {
    userRecord = null;
    return false;
  }
  const snap = await withTimeout(Fire.getDoc(Fire.doc(db, "users", authUser.uid)), "The Owner account record took too long to load.");
  userRecord = snap.exists() ? { ...snap.data(), id: snap.id } : null;
  return Boolean(userRecord?.status === "active" && userRecord?.role === "owner");
}

async function readPortalOnce() {
  const snap = await withTimeout(Fire.getDoc(Fire.doc(db, PORTAL_COLLECTION, PORTAL_DOC)), "The Frenzy event state took too long to load.");
  frenzyState = normalizeFrenzy(snap.exists() ? snap.data()?.frenzy : null);
}

function listenPortal() {
  portalUnsubscribe?.();
  portalUnsubscribe = Fire.onSnapshot(Fire.doc(db, PORTAL_COLLECTION, PORTAL_DOC), (snap) => {
    frenzyState = normalizeFrenzy(snap.exists() ? snap.data()?.frenzy : null);
    if (route() === ROUTE) renderWorkspace();
  }, (error) => console.info("Executive Control live event listener unavailable", error?.code || error?.message));
}

function portalRef() {
  return Fire.doc(db, PORTAL_COLLECTION, PORTAL_DOC);
}

async function writeAudit(action, summary, metadata = {}) {
  try {
    const ref = Fire.doc(Fire.collection(db, "auditLogs"));
    await Fire.setDoc(ref, {
      id: ref.id,
      cognitusId: createId("AUD"),
      actorUid: authUser.uid,
      actorCognitusId: userRecord?.cognitusId || "",
      actorRole: userRecord?.role || "owner",
      action,
      targetType: "frenzy_event",
      targetId: frenzyState.eventId || null,
      summary: clean(summary).slice(0, 500),
      metadata,
      createdAt: Fire.serverTimestamp()
    });
  } catch (error) {
    console.info("Executive audit event was not written", error?.code || error?.message);
  }
}

async function updateFrenzy(fields, action, summary) {
  const payload = {};
  for (const [key, value] of Object.entries(fields)) payload[`frenzy.${key}`] = value;
  payload["frenzy.updatedAt"] = Fire.serverTimestamp();
  await withTimeout(Fire.updateDoc(portalRef(), payload), "The Frenzy update timed out.");
  if (action) await writeAudit(action, summary, fields);
}

async function activateFrenzy(form) {
  const data = new FormData(form);
  const durationMinutes = Math.max(5, Math.min(720, Number(data.get("durationMinutes") || 30)));
  const level = Math.max(0, Math.min(100, Number(data.get("level") || 0)));
  const eventId = createId("FRZ", 6);
  const now = Date.now();
  const next = {
    active: true,
    eventId,
    title: "Frenzy Mode",
    message: clean(data.get("message")).slice(0, 240) || "Executive_Eagle has initiated a Cognitus Frenzy event.",
    announcement: "",
    level,
    audience: "all_active_accounts",
    signalZeroEnabled: data.get("signalZeroEnabled") === "on",
    startedAt: Fire.serverTimestamp(),
    endsAt: Fire.Timestamp.fromMillis(now + durationMinutes * 60 * 1000),
    endedAt: null,
    dropActive: Boolean(clean(data.get("dropCode"))),
    dropLabel: clean(data.get("dropLabel")).slice(0, 80),
    dropCode: clean(data.get("dropCode")).slice(0, 80),
    activatedByUid: authUser.uid,
    activatedByCognitusId: userRecord?.cognitusId || "",
    updatedAt: Fire.serverTimestamp()
  };
  await withTimeout(Fire.setDoc(portalRef(), { frenzy: next }, { merge: true }), "Frenzy activation timed out.");
  await writeAudit("FRENZY_ACTIVATED", `Activated Frenzy Mode ${eventId}.`, { durationMinutes, level, signalZeroEnabled: next.signalZeroEnabled });
}

function showMessage(message, tone = "neutral") {
  const node = root?.querySelector("[data-exec43-message]");
  if (!node) return;
  node.hidden = false;
  node.className = `exec43-message notice notice-${tone}`;
  node.textContent = message;
}

function bindControls() {
  root?.querySelector("[data-exec43-activate]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try { await activateFrenzy(form); showMessage("Frenzy Mode activated.", "success"); }
    catch (error) { showMessage(error?.message || "Frenzy Mode could not be activated.", "error"); }
    finally { button.disabled = false; }
  });

  root?.querySelectorAll("[data-level]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    const level = Math.max(0, Math.min(100, Number(button.dataset.level || 0)));
    try { await updateFrenzy({ level }, "FRENZY_LEVEL_CHANGED", `Set Frenzy level to ${level}%.`); }
    catch (error) { showMessage(error?.message || "The Frenzy level could not be updated.", "error"); }
    finally { button.disabled = false; }
  }));

  root?.querySelector("[data-exec43-extend]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const end = Math.max(Date.now(), timestampMs(frenzyState.endsAt) || Date.now()) + 10 * 60 * 1000;
      await updateFrenzy({ endsAt: Fire.Timestamp.fromMillis(end) }, "FRENZY_EXTENDED", "Extended Frenzy Mode by 10 minutes.");
    } catch (error) { showMessage(error?.message || "Frenzy could not be extended.", "error"); }
    finally { button.disabled = false; }
  });

  root?.querySelector("[data-exec43-announcement]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const announcement = clean(new FormData(form).get("announcement")).slice(0, 240);
    button.disabled = true;
    try {
      await updateFrenzy({ announcement }, "FRENZY_ANNOUNCEMENT", "Updated the Frenzy announcement.");
      showMessage("Announcement published.", "success");
    } catch (error) { showMessage(error?.message || "The announcement could not be published.", "error"); }
    finally { button.disabled = false; }
  });

  root?.querySelector("[data-exec43-drop]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await updateFrenzy({
        dropActive: data.get("dropActive") === "on",
        dropLabel: clean(data.get("dropLabel")).slice(0, 80),
        dropCode: clean(data.get("dropCode")).slice(0, 80)
      }, "FRENZY_DROP_UPDATED", "Updated the Frenzy event drop.");
      showMessage("Frenzy drop updated.", "success");
    } catch (error) { showMessage(error?.message || "The drop could not be updated.", "error"); }
    finally { button.disabled = false; }
  });

  root?.querySelector("[data-exec43-end]")?.addEventListener("click", async (event) => {
    if (!confirm("End Frenzy Mode for the entire site now?")) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await updateFrenzy({ active: false, endedAt: Fire.serverTimestamp() }, "FRENZY_ENDED", `Ended Frenzy Mode ${frenzyState.eventId || ""}.`);
      showMessage("Frenzy Mode ended.", "success");
    } catch (error) { showMessage(error?.message || "Frenzy Mode could not be ended.", "error"); }
    finally { button.disabled = false; }
  });
}

function startCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = null;
  if (!effectiveActive()) return;
  countdownTimer = setInterval(() => {
    if (route() !== ROUTE) return;
    const cards = root?.querySelectorAll(".exec43-stat") || [];
    if (cards[2]) cards[2].querySelector("strong").textContent = formatRemaining(remainingMs());
    if (!effectiveActive()) renderWorkspace();
  }, 1000);
}

function renderWorkspace() {
  if (!root || route() !== ROUTE || !initialized) return;
  root.innerHTML = executiveMarkup();
  bindControls();
  startCountdown();
  document.title = "Executive Control · Cognitus Solutions";
}

function bindRetry() {
  root?.querySelector("[data-exec43-retry]")?.addEventListener("click", () => initialize(true));
}

async function initialize(force = false) {
  if (!root || route() !== ROUTE) return false;
  const generation = ++renderGeneration;
  root.innerHTML = loadingMarkup(force ? "Retrying the secure Owner session and Frenzy state." : undefined);
  if (initializing && !force) return initializing;
  initializing = (async () => {
    try {
      const owner = await readOwnerSession();
      if (generation !== renderGeneration || route() !== ROUTE) return false;
      if (!owner) {
        initialized = false;
        root.innerHTML = restrictedMarkup();
        return false;
      }
      await readPortalOnce().catch((error) => console.info("Executive initial Frenzy state unavailable", error?.message || error));
      if (generation !== renderGeneration || route() !== ROUTE) return false;
      initialized = true;
      renderWorkspace();
      listenPortal();
      return true;
    } catch (error) {
      initialized = false;
      if (generation === renderGeneration && route() === ROUTE) {
        root.innerHTML = failureMarkup(error?.message || "Executive Control could not initialize.");
        bindRetry();
      }
      return false;
    } finally {
      initializing = null;
    }
  })();
  return initializing;
}

function claimRoute() {
  if (!root || route() !== ROUTE) return;
  if (initialized) {
    if (!root.querySelector("[data-executive-v43-page]")) renderWorkspace();
    return;
  }
  if (!root.querySelector("[data-executive-v43-page]")) initialize(false);
}

function installObserver() {
  if (!root || observer) return;
  observer = new MutationObserver(() => {
    if (route() !== ROUTE) return;
    if (!root.querySelector("[data-executive-v43-page]")) queueMicrotask(claimRoute);
  });
  observer.observe(root, { childList: true, subtree: false });
}

export function startExecutiveControlV43() {
  mountStyles();
  installObserver();
  if (!window[START_KEY]) {
    window[START_KEY] = true;
    window.addEventListener("hashchange", claimRoute);
    window.addEventListener("pageshow", claimRoute);
    document.addEventListener("DOMContentLoaded", claimRoute);
  }
  claimRoute();
  return true;
}
