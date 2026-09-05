import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
const topbar = document.querySelector(".topbar");
const STYLE_ID = "cognitus-frenzy-v35";
const PORTAL_COLLECTION = "settings";
const PORTAL_DOC = "portal";
const EXECUTIVE_ROUTE = "/executive";
const EXECUTIVE_HANDLE = "Executive_Eagle";

let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userRecord = null;
let portalUnsubscribe = null;
let rootObserver = null;
let countdownTimer = null;
let sessionReady = false;
let portalReady = false;
let frenzyState = normalizeFrenzy(null);
let resolveReady;
const frenzyReady = new Promise((resolve) => { resolveReady = resolve; });

const clean = (value) => String(value ?? "").trim();
const safe = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";

function timestampMs(value) {
  try {
    const date = value?.toDate?.() || (value ? new Date(value) : null);
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  } catch {
    return 0;
  }
}

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

function effectiveActive(state = frenzyState) {
  if (!state?.active) return false;
  const end = timestampMs(state.endsAt);
  return !end || end > Date.now();
}

function remainingMs(state = frenzyState) {
  const end = timestampMs(state.endsAt);
  if (!end) return 0;
  return Math.max(0, end - Date.now());
}

function formatRemaining(ms) {
  if (!ms) return "00:00";
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function createEventId() {
  const bytes = new Uint32Array(6);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const token = Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
  return `FRZ-${String(new Date().getFullYear()).slice(-2)}-${token}`;
}

function createAuditId() {
  const bytes = new Uint32Array(7);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const token = Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
  return `AUD-${String(new Date().getFullYear()).slice(-2)}-${token}`;
}

function mountStyles() {
  let link = document.querySelector(`#${STYLE_ID}`);
  if (!link) {
    link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = "./src/frenzyV35.css?v=20260905-v35";
}

async function loadFirebase() {
  if (Auth && Fire) return;
  const services = await initializeFirebaseServices();
  if (!services.ready) throw new Error("Firebase is not configured.");
  auth = services.auth;
  db = services.db;
  [Auth, Fire] = await Promise.all([
    import(`${FIREBASE_CDN_BASE}/firebase-auth.js`),
    import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`)
  ]);
}

async function refreshUser() {
  authUser = auth?.currentUser || null;
  userRecord = null;
  if (!authUser || !Fire || !db) {
    sessionReady = true;
    return null;
  }
  try {
    const snap = await Fire.getDoc(Fire.doc(db, "users", authUser.uid));
    userRecord = snap.exists() ? { ...snap.data(), id: snap.id } : null;
  } catch {
    userRecord = null;
  }
  sessionReady = true;
  return userRecord;
}

function isOwner() {
  return Boolean(authUser && userRecord?.status === "active" && userRecord?.role === "owner");
}

function ensureBanner() {
  if (!topbar) return null;
  let banner = document.querySelector("#cognitus-frenzy-banner-v35");
  if (!banner) {
    banner = document.createElement("section");
    banner.id = "cognitus-frenzy-banner-v35";
    banner.className = "frenzy35-banner";
    banner.hidden = true;
    banner.setAttribute("aria-live", "polite");
    topbar.insertAdjacentElement("afterend", banner);
  }
  return banner;
}

function bannerMarkup() {
  const level = Math.round(frenzyState.level);
  const message = frenzyState.announcement || frenzyState.message;
  const drop = frenzyState.dropActive && frenzyState.dropCode
    ? `<div class="frenzy35-drop"><span><strong>${safe(frenzyState.dropLabel || "Frenzy Drop")}</strong> · available while this event remains active</span><code>${safe(frenzyState.dropCode)}</code></div>`
    : "";
  return `
    <div class="frenzy35-flag"><i aria-hidden="true"></i>Frenzy Active</div>
    <div class="frenzy35-copy"><strong>${safe(frenzyState.title)}</strong><span>${safe(message)}</span></div>
    <div class="frenzy35-meter" aria-label="Frenzy level ${level} percent">
      <div class="frenzy35-meter-top"><span>Frenzy level</span><strong>${level}%</strong></div>
      <div class="frenzy35-meter-track"><span style="--frenzy-level:${level}%"></span></div>
    </div>
    <div class="frenzy35-countdown"><strong data-frenzy35-countdown>${formatRemaining(remainingMs())}</strong><span>remaining</span></div>
    ${drop}`;
}

function maybeShowActivation() {
  if (!effectiveActive() || !frenzyState.eventId) return;
  const key = `cognitus.frenzy.seen.${frenzyState.eventId}`;
  try {
    if (sessionStorage.getItem(key) === "1") return;
  } catch {}
  if (document.querySelector("#cognitus-frenzy-activation-v35")) return;
  const overlay = document.createElement("div");
  overlay.id = "cognitus-frenzy-activation-v35";
  overlay.className = "frenzy35-activation";
  overlay.innerHTML = `
    <section class="frenzy35-activation-card" role="dialog" aria-modal="true" aria-labelledby="frenzy35-activation-title">
      <p class="eyebrow">Cognitus Live Event</p>
      <h2 id="frenzy35-activation-title">Frenzy Mode is active.</h2>
      <p>${safe(frenzyState.message)}</p>
      <div class="frenzy35-activation-meta">
        <span>Event<strong>${safe(frenzyState.eventId)}</strong></span>
        <span>Frenzy level<strong>${Math.round(frenzyState.level)}%</strong></span>
        <span>Signal Zero<strong>${frenzyState.signalZeroEnabled ? "Window open" : "Unavailable"}</strong></span>
      </div>
      <button class="button button-dark" type="button" data-frenzy35-enter>Enter Cognitus</button>
    </section>`;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-frenzy35-enter]")?.addEventListener("click", () => {
    try { sessionStorage.setItem(key, "1"); } catch {}
    overlay.remove();
  });
}

function updateCountdownOnly() {
  const node = document.querySelector("[data-frenzy35-countdown]");
  if (node) node.textContent = formatRemaining(remainingMs());
  if (frenzyState.active && !effectiveActive()) applyFrenzyState(false);
}

function applyFrenzyState(showActivation = true) {
  const active = effectiveActive();
  document.body.classList.toggle("cognitus-frenzy-active", active);
  document.documentElement.style.setProperty("--frenzy-level", `${Math.round(frenzyState.level)}%`);
  const banner = ensureBanner();
  if (banner) {
    banner.hidden = !active;
    if (active) banner.innerHTML = bannerMarkup();
  }
  clearInterval(countdownTimer);
  countdownTimer = null;
  if (active) {
    countdownTimer = setInterval(updateCountdownOnly, 1000);
    if (showActivation) maybeShowActivation();
  }
  if (route() === EXECUTIVE_ROUTE) scheduleExecutiveRender();
  document.dispatchEvent(new CustomEvent("cognitus:frenzy-state", {
    detail: getFrenzyState()
  }));
}

function listenPortal() {
  portalUnsubscribe?.();
  if (!Fire || !db) return;
  const ref = Fire.doc(db, PORTAL_COLLECTION, PORTAL_DOC);
  portalUnsubscribe = Fire.onSnapshot(ref, (snap) => {
    const previousEvent = frenzyState.eventId;
    frenzyState = normalizeFrenzy(snap.exists() ? snap.data()?.frenzy : null);
    portalReady = true;
    resolveReady?.(getFrenzyState());
    resolveReady = null;
    applyFrenzyState(previousEvent !== frenzyState.eventId);
  }, (error) => {
    console.info("Frenzy state unavailable", error?.code || error?.message);
    portalReady = true;
    resolveReady?.(getFrenzyState());
    resolveReady = null;
  });
}

async function writeAudit(action, summary, metadata = {}) {
  if (!isOwner()) return;
  try {
    const ref = Fire.doc(Fire.collection(db, "auditLogs"));
    await Fire.setDoc(ref, {
      id: ref.id,
      cognitusId: createAuditId(),
      actorUid: authUser.uid,
      actorCognitusId: userRecord.cognitusId,
      actorRole: userRecord.role,
      action,
      targetType: "frenzy_event",
      targetId: frenzyState.eventId || null,
      summary: clean(summary).slice(0, 500),
      metadata,
      createdAt: Fire.serverTimestamp()
    });
  } catch (error) {
    console.info("Frenzy audit event not written", error?.code || error?.message);
  }
}

function portalRef() {
  return Fire.doc(db, PORTAL_COLLECTION, PORTAL_DOC);
}

async function activateFrenzy(form) {
  if (!isOwner()) throw new Error("Owner authorization is required.");
  const data = Object.fromEntries(new FormData(form).entries());
  const durationMinutes = Math.max(5, Math.min(720, Number(data.durationMinutes || 30)));
  const level = Math.max(0, Math.min(100, Number(data.level || 0)));
  const now = Date.now();
  const eventId = createEventId();
  const next = {
    active: true,
    eventId,
    title: "Frenzy Mode",
    message: clean(data.message).slice(0, 240) || "Executive_Eagle has initiated a Cognitus Frenzy event.",
    announcement: "",
    level,
    audience: "all_active_accounts",
    signalZeroEnabled: data.signalZeroEnabled === "on",
    startedAt: Fire.serverTimestamp(),
    endsAt: Fire.Timestamp.fromMillis(now + durationMinutes * 60 * 1000),
    endedAt: null,
    dropActive: Boolean(clean(data.dropCode)),
    dropLabel: clean(data.dropLabel).slice(0, 80),
    dropCode: clean(data.dropCode).slice(0, 80),
    activatedByUid: authUser.uid,
    activatedByCognitusId: userRecord.cognitusId || "",
    updatedAt: Fire.serverTimestamp()
  };
  await Fire.setDoc(portalRef(), { frenzy: next }, { merge: true });
  await writeAudit("FRENZY_ACTIVATED", `Activated Frenzy Mode ${eventId}.`, { durationMinutes, level, signalZeroEnabled: next.signalZeroEnabled });
}

async function updateFrenzyFields(fields, auditAction = null, auditSummary = "") {
  if (!isOwner()) throw new Error("Owner authorization is required.");
  const payload = {};
  for (const [key, value] of Object.entries(fields)) payload[`frenzy.${key}`] = value;
  payload["frenzy.updatedAt"] = Fire.serverTimestamp();
  await Fire.updateDoc(portalRef(), payload);
  if (auditAction) await writeAudit(auditAction, auditSummary, fields);
}

async function endFrenzy() {
  await updateFrenzyFields({ active: false, endedAt: Fire.serverTimestamp() }, "FRENZY_ENDED", `Ended Frenzy Mode ${frenzyState.eventId || ""}.`);
}

async function setFrenzyLevel(level) {
  const next = Math.max(0, Math.min(100, Number(level || 0)));
  await updateFrenzyFields({ level: next }, "FRENZY_LEVEL_CHANGED", `Set Frenzy level to ${next}%.`);
}

async function extendFrenzy(minutes = 10) {
  const currentEnd = timestampMs(frenzyState.endsAt) || Date.now();
  const nextEnd = Fire.Timestamp.fromMillis(Math.max(Date.now(), currentEnd) + minutes * 60 * 1000);
  await updateFrenzyFields({ endsAt: nextEnd }, "FRENZY_EXTENDED", `Extended Frenzy Mode by ${minutes} minutes.`);
}

async function sendAnnouncement(value) {
  const announcement = clean(value).slice(0, 240);
  await updateFrenzyFields({ announcement }, "FRENZY_ANNOUNCEMENT", "Updated the Frenzy event announcement.");
}

async function updateDrop({ active, label, code }) {
  await updateFrenzyFields({
    dropActive: Boolean(active),
    dropLabel: clean(label).slice(0, 80),
    dropCode: clean(code).slice(0, 80)
  }, "FRENZY_DROP_UPDATED", active ? "Released a Frenzy event drop." : "Closed the Frenzy event drop.");
}

function executiveAccessMarkup() {
  return `<section class="hero" data-executive-v35-page><p class="eyebrow">Restricted Workspace</p><h1>Executive Control</h1><p>This workspace is available only to the active Cognitus Owner account.</p><div class="hero-actions"><a class="button button-dark" href="#/dashboard">Return to Dashboard</a></div></section>`;
}

function stat(label, value, note = "") {
  return `<article class="exec35-stat"><span>${safe(label)}</span><strong>${safe(value)}</strong>${note ? `<small>${safe(note)}</small>` : ""}</article>`;
}

function executiveMarkup() {
  const active = effectiveActive();
  const level = Math.round(frenzyState.level);
  const endText = timestampMs(frenzyState.endsAt) ? new Date(timestampMs(frenzyState.endsAt)).toLocaleString() : "—";
  const statusText = active ? "ACTIVE" : "INACTIVE";
  return `<div class="exec35-shell" data-executive-v35-page>
    <header class="exec35-header">
      <div><p class="eyebrow">Executive Control · Owner Only</p><h1>${EXECUTIVE_HANDLE}</h1><p>Personal Cognitus command center for site-wide events and owner-level operational controls. Frenzy Mode changes the live site experience without changing underlying report, role, or Firestore permissions.</p></div>
      <aside class="exec35-identity"><span>Authenticated authority</span><strong>${safe(userRecord?.displayName || EXECUTIVE_HANDLE)}</strong><small>${safe(userRecord?.cognitusId || authUser?.uid || "Owner")}</small></aside>
    </header>

    <section class="exec35-status">
      ${stat("Frenzy status", statusText, frenzyState.eventId || "No active event")}
      ${stat("Frenzy level", `${level}%`, active ? "Live site value" : "Awaiting activation")}
      ${stat("Time remaining", active ? formatRemaining(remainingMs()) : "—", active ? `Ends ${endText}` : "No live countdown")}
      ${stat("Signal Zero", active && frenzyState.signalZeroEnabled ? "OPEN" : "DORMANT", "Requires entitlement + Frenzy")}
    </section>

    <section class="exec35-grid">
      <div class="exec35-panel ${active ? "exec35-live" : ""}">
        <div class="exec35-panel-head"><div><h2>${active ? "Live Frenzy Control" : "Initiate Frenzy Mode"}</h2><p>${active ? "Adjust the current event in real time. Changes are reflected across connected Cognitus sessions." : "Configure a temporary Cognitus-wide event. The event can be ended immediately at any time."}</p></div></div>
        ${active ? `
          <div class="exec35-frenzy-preview"><span>Frenzy Active</span><strong>${safe(frenzyState.eventId)}</strong><p>${safe(frenzyState.announcement || frenzyState.message)}</p></div>
          <div class="exec35-control-row" style="margin-top:.8rem">
            <button class="button button-light" type="button" data-exec-level="${Math.max(0, level - 5)}">−5%</button>
            <button class="button button-light" type="button" data-exec-level="${Math.min(100, level + 5)}">+5%</button>
            <button class="button button-light" type="button" data-exec-level="${Math.min(100, level + 10)}">+10%</button>
            <button class="button button-light" type="button" data-exec-level="100">Maximum Frenzy</button>
            <button class="button button-light" type="button" data-exec-extend>Extend 10 minutes</button>
          </div>
          <form class="form-stack" data-exec-announcement style="margin-top:1rem">
            <label>Live Announcement<input name="announcement" maxlength="240" value="${safe(frenzyState.announcement)}" placeholder="Message shown in the Frenzy status bar"></label>
            <button class="button button-dark" type="submit">Publish Announcement</button>
          </form>
          <form class="form-stack" data-exec-drop style="margin-top:1rem">
            <div class="form-row"><label>Drop Label<input name="dropLabel" maxlength="80" value="${safe(frenzyState.dropLabel)}" placeholder="Frenzy Drop"></label><label>Drop Code<input name="dropCode" maxlength="80" value="${safe(frenzyState.dropCode)}" placeholder="Optional promotional code"></label></div>
            <label class="checkbox-line"><input type="checkbox" name="dropActive" ${frenzyState.dropActive ? "checked" : ""}> Show this drop in the site-wide Frenzy bar</label>
            <button class="button button-light" type="submit">Update Drop</button>
          </form>
          <div class="exec35-control-row" style="margin-top:1rem"><button class="button button-light exec35-danger" type="button" data-exec-end>End Frenzy Immediately</button></div>
        ` : `
          <form class="form-stack" data-exec-activate>
            <div class="form-row"><label>Duration<select name="durationMinutes"><option value="15">15 minutes</option><option value="30" selected>30 minutes</option><option value="60">1 hour</option><option value="90">90 minutes</option><option value="120">2 hours</option></select></label><label>Starting Frenzy Level<input name="level" type="number" min="0" max="100" value="0"></label></div>
            <label>Opening Message<textarea name="message" maxlength="240" rows="3" placeholder="Executive_Eagle has initiated a Cognitus Frenzy event."></textarea></label>
            <label class="checkbox-line"><input type="checkbox" name="signalZeroEnabled" checked> Open the Signal Zero activation window during this event</label>
            <div class="form-row"><label>Optional Drop Label<input name="dropLabel" maxlength="80" placeholder="Frenzy Drop"></label><label>Optional Drop Code<input name="dropCode" maxlength="80" placeholder="PROMO-CODE"></label></div>
            <button class="button button-dark" type="submit">Initiate Frenzy Mode</button>
          </form>
        `}
        <div class="exec35-message" data-exec-message hidden></div>
      </div>

      <aside class="exec35-panel">
        <div class="exec35-panel-head"><div><h2>Event Rules</h2><p>Frenzy changes access windows and presentation, not protected-record authority.</p></div></div>
        <div class="record-list">
          <div class="record-row"><div><strong>Signal Zero</strong><span>Requires an explicit promotional entitlement and an active Frenzy window.</span></div></div>
          <div class="record-row"><div><strong>Report permissions</strong><span>Remain controlled by existing Cognitus roles and Firestore rules.</span></div></div>
          <div class="record-row"><div><strong>Event expiry</strong><span>The client closes the live experience at the configured end time even before an Owner manually clears the event state.</span></div></div>
          <div class="record-row"><div><strong>Audit trail</strong><span>Activation, level changes, announcements, extensions, drops, and shutdown actions are logged when available.</span></div></div>
        </div>
        <div class="hero-actions"><a class="button button-light" href="#/admin/promotions">Feature Access Management</a><a class="button button-light" href="#/promotional-access">Feature Access</a></div>
      </aside>
    </section>
  </div>`;
}

function showExecMessage(message, tone = "neutral") {
  const node = root?.querySelector("[data-exec-message]");
  if (!node) return;
  node.hidden = false;
  node.className = `exec35-message notice notice-${tone}`;
  node.textContent = message;
}

function bindExecutiveControls() {
  const activate = root?.querySelector("[data-exec-activate]");
  activate?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = activate.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await activateFrenzy(activate);
      showExecMessage("Frenzy Mode activated.", "success");
    } catch (error) {
      showExecMessage(error?.message || "Frenzy Mode could not be activated.", "error");
    } finally {
      button.disabled = false;
    }
  });

  root?.querySelectorAll("[data-exec-level]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    try { await setFrenzyLevel(Number(button.dataset.execLevel)); }
    catch (error) { showExecMessage(error?.message || "Frenzy level could not be changed.", "error"); }
    finally { button.disabled = false; }
  }));

  root?.querySelector("[data-exec-extend]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try { await extendFrenzy(10); }
    catch (error) { showExecMessage(error?.message || "Frenzy could not be extended.", "error"); }
    finally { event.currentTarget.disabled = false; }
  });

  root?.querySelector("[data-exec-end]")?.addEventListener("click", async (event) => {
    if (!confirm("End Frenzy Mode for the entire site now?")) return;
    event.currentTarget.disabled = true;
    try { await endFrenzy(); }
    catch (error) { showExecMessage(error?.message || "Frenzy could not be ended.", "error"); }
    finally { event.currentTarget.disabled = false; }
  });

  root?.querySelector("[data-exec-announcement]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await sendAnnouncement(new FormData(form).get("announcement"));
      showExecMessage("Announcement published.", "success");
    } catch (error) {
      showExecMessage(error?.message || "Announcement could not be published.", "error");
    } finally { button.disabled = false; }
  });

  root?.querySelector("[data-exec-drop]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await updateDrop({ active: data.get("dropActive") === "on", label: data.get("dropLabel"), code: data.get("dropCode") });
      showExecMessage("Frenzy drop updated.", "success");
    } catch (error) {
      showExecMessage(error?.message || "The drop could not be updated.", "error");
    } finally { button.disabled = false; }
  });
}

async function renderExecutive() {
  if (!root || route() !== EXECUTIVE_ROUTE) return;
  await loadFirebase().catch(() => null);
  if (!sessionReady) await refreshUser();
  document.title = `Executive Control · Cognitus Solutions`;
  if (!isOwner()) {
    root.innerHTML = executiveAccessMarkup();
    return;
  }
  root.innerHTML = executiveMarkup();
  bindExecutiveControls();
}

function isBaseRouter404() {
  if (!root || route() !== EXECUTIVE_ROUTE) return false;
  const heading = clean(root.querySelector("h1")?.textContent).toLowerCase();
  return heading === "page not found." || clean(root.textContent).toLowerCase().includes("the requested cognitus page does not exist");
}

let execQueued = false;
function scheduleExecutiveRender() {
  if (route() !== EXECUTIVE_ROUTE || execQueued) return;
  execQueued = true;
  requestAnimationFrame(async () => {
    execQueued = false;
    if (route() !== EXECUTIVE_ROUTE) return;
    if (root?.querySelector("[data-executive-v35-page]") && !isBaseRouter404()) return;
    await renderExecutive();
  });
}

function syncExecutiveObserver() {
  rootObserver?.disconnect();
  rootObserver = null;
  if (!root || route() !== EXECUTIVE_ROUTE) return;
  rootObserver = new MutationObserver(() => {
    if (isBaseRouter404()) scheduleExecutiveRender();
  });
  rootObserver.observe(root, { childList: true, subtree: true });
}

export function getFrenzyState() {
  return { ...frenzyState, effectiveActive: effectiveActive(), remainingMs: remainingMs() };
}

export async function waitForFrenzyState() {
  if (portalReady) return getFrenzyState();
  return frenzyReady;
}

export function isFrenzyActive() {
  return effectiveActive();
}

export async function startFrenzyV35() {
  mountStyles();
  ensureBanner();
  try {
    await loadFirebase();
    Auth.onAuthStateChanged(auth, async (user) => {
      authUser = user;
      sessionReady = false;
      await refreshUser();
      scheduleExecutiveRender();
    });
    await refreshUser();
    listenPortal();
  } catch (error) {
    console.info("Frenzy Mode initialization unavailable", error?.message || error);
    portalReady = true;
    resolveReady?.(getFrenzyState());
    resolveReady = null;
  }

  window.addEventListener("hashchange", () => {
    syncExecutiveObserver();
    scheduleExecutiveRender();
  });
  window.addEventListener("pageshow", () => {
    syncExecutiveObserver();
    scheduleExecutiveRender();
  });
  document.addEventListener("DOMContentLoaded", () => {
    syncExecutiveObserver();
    scheduleExecutiveRender();
  });
  syncExecutiveObserver();
  scheduleExecutiveRender();
}
