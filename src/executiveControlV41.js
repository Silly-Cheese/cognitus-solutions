import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
const ROUTE = "/executive";
const STYLE_ID = "cognitus-executive-v41";
const START_KEY = "__COGNITUS_EXECUTIVE_V41_STARTED__";
const PORTAL_COLLECTION = "settings";
const PORTAL_DOC = "portal";
const EXECUTIVE_HANDLE = "Executive_Eagle";
const REQUEST_TIMEOUT_MS = 8000;

let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userRecord = null;
let authUnsubscribe = null;
let portalUnsubscribe = null;
let initialization = null;
let generation = 0;
let ownerReady = false;
let portalReady = false;
let portalError = "";
let countdownTimer = null;
let frenzyState = normalizeFrenzy(null);

const clean = (value) => String(value ?? "").trim();
const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const safe = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function mountStyles() {
  let link = document.querySelector(`#${STYLE_ID}`);
  if (!link) {
    link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
  }
  link.href = "./src/executiveControlV41.css?v=20260905-v41";
  document.head.appendChild(link);
}

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

function withTimeout(promise, message, timeoutMs = REQUEST_TIMEOUT_MS) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

function createId(prefix, length = 7) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  return `${prefix}-${String(new Date().getFullYear()).slice(-2)}-${token}`;
}

function pageMarkers(extra = "") {
  return `data-executive-v41-page data-executive-v35-page ${extra}`.trim();
}

function renderLoading(message = "Verifying your Owner session and preparing Executive Control.") {
  if (!root || route() !== ROUTE) return;
  document.title = "Executive Control · Cognitus Solutions";
  root.innerHTML = `
    <main class="exec41-shell exec41-loading" ${pageMarkers('data-exec41-state="loading"')}>
      <header class="exec41-hero">
        <div class="exec41-hero-copy">
          <p class="eyebrow">Owner Workspace</p>
          <h1>Executive Control</h1>
          <p>${safe(message)}</p>
        </div>
        <div class="exec41-session-card" aria-live="polite">
          <span class="exec41-status-dot is-pending" aria-hidden="true"></span>
          <div><small>Secure session</small><strong>Connecting</strong></div>
        </div>
      </header>
      <section class="exec41-loading-grid" aria-label="Loading Executive Control">
        <div class="exec41-skeleton exec41-skeleton-wide"></div>
        <div class="exec41-skeleton"></div>
        <div class="exec41-skeleton"></div>
        <div class="exec41-skeleton"></div>
        <div class="exec41-skeleton"></div>
      </section>
      <div class="exec41-loading-note">This page will stop waiting and show a recoverable error if Cognitus cannot confirm the session.</div>
    </main>`;
}

function renderFailure(title, message, { login = false, restricted = false } = {}) {
  if (!root || route() !== ROUTE) return;
  clearInterval(countdownTimer);
  countdownTimer = null;
  document.title = "Executive Control · Cognitus Solutions";
  root.innerHTML = `
    <main class="exec41-shell" ${pageMarkers(`data-exec41-state="${restricted ? "restricted" : "error"}"`)}>
      <section class="exec41-state-card ${restricted ? "is-restricted" : "is-error"}">
        <div class="exec41-state-icon" aria-hidden="true">${restricted ? "CS" : "!"}</div>
        <p class="eyebrow">${restricted ? "Restricted Workspace" : "Connection Error"}</p>
        <h1>${safe(title)}</h1>
        <p>${safe(message)}</p>
        <div class="exec41-actions">
          ${login ? '<a class="button button-dark" href="#/login">Sign In</a>' : '<button class="button button-dark" type="button" data-exec41-retry>Retry Executive Control</button>'}
          <a class="button button-light" href="#/dashboard">Return to Dashboard</a>
        </div>
      </section>
    </main>`;
  root.querySelector("[data-exec41-retry]")?.addEventListener("click", () => claimRoute(true));
}

function statCard(label, value, note, tone = "") {
  return `<article class="exec41-stat ${tone ? `is-${safe(tone)}` : ""}"><span>${safe(label)}</span><strong>${safe(value)}</strong><small>${safe(note)}</small></article>`;
}

function renderOwner() {
  if (!root || route() !== ROUTE || !ownerReady) return;
  const active = effectiveActive();
  const level = Math.round(frenzyState.level);
  const status = active ? "ACTIVE" : "INACTIVE";
  const eventLabel = frenzyState.eventId || "No current event";
  const signal = active && frenzyState.signalZeroEnabled ? "OPEN" : "DORMANT";
  const portalNotice = portalError
    ? `<div class="exec41-notice is-error"><strong>Live event state could not be read.</strong><span>${safe(portalError)}</span><button class="button button-light" type="button" data-exec41-retry>Retry connection</button></div>`
    : !portalReady
      ? `<div class="exec41-notice"><strong>Owner access confirmed.</strong><span>Connecting to the live event state…</span></div>`
      : "";

  document.title = "Executive Control · Cognitus Solutions";
  root.innerHTML = `
    <main class="exec41-shell" ${pageMarkers('data-exec41-state="ready"')}>
      <header class="exec41-hero">
        <div class="exec41-hero-copy">
          <p class="eyebrow">Executive Control · Owner Only</p>
          <h1>Command Center</h1>
          <p>Manage Cognitus live-event controls from one focused workspace. Frenzy changes the site experience and temporary access windows; it does not override protected-record permissions.</p>
        </div>
        <aside class="exec41-session-card">
          <span class="exec41-status-dot is-ready" aria-hidden="true"></span>
          <div><small>Authenticated Owner</small><strong>${safe(userRecord?.displayName || EXECUTIVE_HANDLE)}</strong><span>${safe(userRecord?.cognitusId || authUser?.uid || "Owner")}</span></div>
        </aside>
      </header>

      ${portalNotice}

      <section class="exec41-stats" aria-label="Frenzy status">
        ${statCard("Frenzy status", status, eventLabel, active ? "live" : "neutral")}
        ${statCard("Frenzy level", `${level}%`, active ? "Current live intensity" : "Awaiting activation")}
        ${statCard("Time remaining", active ? formatRemaining(remainingMs()) : "—", active ? `Ends ${formatDateTime(frenzyState.endsAt)}` : "No live countdown")}
        ${statCard("Signal Zero", signal, "Requires entitlement and an active Frenzy window", signal === "OPEN" ? "live" : "neutral")}
      </section>

      <section class="exec41-workspace">
        <article class="exec41-panel exec41-primary ${active ? "is-live" : ""}">
          <div class="exec41-panel-head">
            <div>
              <p class="eyebrow">Live Event Controls</p>
              <h2>${active ? "Manage the active Frenzy event" : "Initiate Frenzy Mode"}</h2>
              <p>${active ? "Changes publish to connected Cognitus sessions as the live event state updates." : "Set a duration, opening intensity, message, and optional event drop. You can end the event at any time."}</p>
            </div>
            <span class="exec41-mode-badge ${active ? "is-live" : ""}">${active ? "LIVE" : "STANDBY"}</span>
          </div>

          ${active ? `
            <div class="exec41-live-card">
              <div><span>Current event</span><strong>${safe(frenzyState.eventId)}</strong></div>
              <p>${safe(frenzyState.announcement || frenzyState.message)}</p>
            </div>

            <div class="exec41-control-group">
              <div class="exec41-control-title"><strong>Frenzy intensity</strong><span>Current level: ${level}%</span></div>
              <div class="exec41-button-grid">
                <button class="button button-light" type="button" data-exec41-level="${Math.max(0, level - 5)}">−5%</button>
                <button class="button button-light" type="button" data-exec41-level="${Math.min(100, level + 5)}">+5%</button>
                <button class="button button-light" type="button" data-exec41-level="${Math.min(100, level + 10)}">+10%</button>
                <button class="button button-light" type="button" data-exec41-level="100">Maximum</button>
                <button class="button button-light" type="button" data-exec41-extend>Extend 10 min</button>
              </div>
            </div>

            <form class="exec41-form" data-exec41-announcement>
              <div class="exec41-form-heading"><strong>Live announcement</strong><span>Update the message displayed with the active event.</span></div>
              <label>Announcement<textarea name="announcement" maxlength="240" rows="3" placeholder="Message shown in the Frenzy status bar">${safe(frenzyState.announcement)}</textarea></label>
              <div class="exec41-form-actions"><button class="button button-dark" type="submit">Publish Announcement</button></div>
            </form>

            <form class="exec41-form" data-exec41-drop>
              <div class="exec41-form-heading"><strong>Frenzy drop</strong><span>Optionally expose an approved access code during the live event.</span></div>
              <div class="exec41-form-row">
                <label>Drop label<input name="dropLabel" maxlength="80" value="${safe(frenzyState.dropLabel)}" placeholder="Frenzy Drop"></label>
                <label>Drop code<input name="dropCode" maxlength="80" value="${safe(frenzyState.dropCode)}" placeholder="PROMO-CODE"></label>
              </div>
              <label class="exec41-check"><input type="checkbox" name="dropActive" ${frenzyState.dropActive ? "checked" : ""}><span><strong>Show drop site-wide</strong><small>Display this drop in the Frenzy bar while the event is active.</small></span></label>
              <div class="exec41-form-actions"><button class="button button-light" type="submit">Update Drop</button></div>
            </form>

            <div class="exec41-danger-zone">
              <div><strong>End live event</strong><span>Immediately closes the Frenzy experience for all connected sessions.</span></div>
              <button class="button exec41-danger" type="button" data-exec41-end>End Frenzy Now</button>
            </div>
          ` : `
            <form class="exec41-form exec41-activate-form" data-exec41-activate>
              <div class="exec41-form-row">
                <label>Duration<select name="durationMinutes"><option value="15">15 minutes</option><option value="30" selected>30 minutes</option><option value="60">1 hour</option><option value="90">90 minutes</option><option value="120">2 hours</option></select></label>
                <label>Starting Frenzy level<input name="level" type="number" min="0" max="100" value="0"></label>
              </div>
              <label>Opening message<textarea name="message" maxlength="240" rows="4" placeholder="Executive_Eagle has initiated a Cognitus Frenzy event."></textarea></label>
              <label class="exec41-check"><input type="checkbox" name="signalZeroEnabled" checked><span><strong>Open Signal Zero window</strong><small>Eligible accounts may access Signal Zero while Frenzy is active.</small></span></label>
              <div class="exec41-form-row">
                <label>Optional drop label<input name="dropLabel" maxlength="80" placeholder="Frenzy Drop"></label>
                <label>Optional drop code<input name="dropCode" maxlength="80" placeholder="PROMO-CODE"></label>
              </div>
              <div class="exec41-form-actions"><button class="button button-dark" type="submit" ${portalError ? "disabled" : ""}>Initiate Frenzy Mode</button></div>
            </form>
          `}
          <div class="exec41-action-message" data-exec41-message hidden aria-live="polite"></div>
        </article>

        <aside class="exec41-side-stack">
          <article class="exec41-panel">
            <div class="exec41-panel-head compact"><div><p class="eyebrow">Guardrails</p><h2>Event Rules</h2><p>Executive controls change presentation and event state only.</p></div></div>
            <div class="exec41-rules">
              <div><span>01</span><p><strong>Signal Zero</strong><small>Requires both an explicit entitlement and an active Frenzy window.</small></p></div>
              <div><span>02</span><p><strong>Record permissions</strong><small>Existing Cognitus roles and Firestore rules remain authoritative.</small></p></div>
              <div><span>03</span><p><strong>Automatic expiry</strong><small>The live experience closes at the configured event end time.</small></p></div>
              <div><span>04</span><p><strong>Audit trail</strong><small>Owner event actions are written to Cognitus audit records when available.</small></p></div>
            </div>
          </article>
          <article class="exec41-panel exec41-links-panel">
            <div class="exec41-panel-head compact"><div><p class="eyebrow">Related Controls</p><h2>Access Management</h2></div></div>
            <a href="#/admin/promotions"><span>Feature Access Management</span><small>Codes, grants, limits, and revocations</small><b aria-hidden="true">→</b></a>
            <a href="#/promotional-access"><span>Feature Access</span><small>Review current entitlements</small><b aria-hidden="true">→</b></a>
          </article>
        </aside>
      </section>
    </main>`;

  bindOwnerControls();
  root.querySelector("[data-exec41-retry]")?.addEventListener("click", () => claimRoute(true));
  startCountdown();
}

function startCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = null;
  if (!effectiveActive()) return;
  countdownTimer = setInterval(() => {
    if (route() !== ROUTE || !effectiveActive()) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      if (route() === ROUTE && ownerReady) renderOwner();
      return;
    }
    const cards = root?.querySelectorAll(".exec41-stat");
    if (cards?.[2]) cards[2].querySelector("strong").textContent = formatRemaining(remainingMs());
  }, 1000);
}

function setActionMessage(message, tone = "neutral") {
  const node = root?.querySelector("[data-exec41-message]");
  if (!node) return;
  node.hidden = false;
  node.className = `exec41-action-message is-${tone}`;
  node.textContent = message;
}

function setButtonBusy(button, busy, text = "Saving…") {
  if (!button) return;
  if (busy) {
    button.dataset.exec41Label = button.textContent;
    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.exec41Label || button.textContent;
    button.disabled = false;
  }
}

function portalRef() {
  return Fire.doc(db, PORTAL_COLLECTION, PORTAL_DOC);
}

function ownerAuthorized() {
  return Boolean(authUser && userRecord?.status === "active" && userRecord?.role === "owner");
}

async function writeAudit(action, summary, metadata = {}) {
  if (!ownerAuthorized() || !Fire || !db) return;
  try {
    const ref = Fire.doc(Fire.collection(db, "auditLogs"));
    await Fire.setDoc(ref, {
      id: ref.id,
      cognitusId: createId("AUD"),
      actorUid: authUser.uid,
      actorCognitusId: userRecord.cognitusId || "",
      actorRole: userRecord.role,
      action,
      targetType: "frenzy_event",
      targetId: frenzyState.eventId || null,
      summary: clean(summary).slice(0, 500),
      metadata,
      createdAt: Fire.serverTimestamp()
    });
  } catch (error) {
    console.info("Executive V41 audit event not written", error?.code || error?.message);
  }
}

async function activateFrenzy(form) {
  if (!ownerAuthorized()) throw new Error("Owner authorization is required.");
  const data = Object.fromEntries(new FormData(form).entries());
  const durationMinutes = Math.max(5, Math.min(720, Number(data.durationMinutes || 30)));
  const level = Math.max(0, Math.min(100, Number(data.level || 0)));
  const eventId = createId("FRZ", 6);
  const now = Date.now();
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
  await withTimeout(Fire.setDoc(portalRef(), { frenzy: next }, { merge: true }), "Frenzy activation timed out.");
  await writeAudit("FRENZY_ACTIVATED", `Activated Frenzy Mode ${eventId}.`, { durationMinutes, level, signalZeroEnabled: next.signalZeroEnabled });
}

async function updateFrenzyFields(fields, action, summary) {
  if (!ownerAuthorized()) throw new Error("Owner authorization is required.");
  const payload = {};
  for (const [key, value] of Object.entries(fields)) payload[`frenzy.${key}`] = value;
  payload["frenzy.updatedAt"] = Fire.serverTimestamp();
  await withTimeout(Fire.updateDoc(portalRef(), payload), "The live event update timed out.");
  await writeAudit(action, summary, fields);
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

async function endFrenzy() {
  await updateFrenzyFields({ active: false, endedAt: Fire.serverTimestamp() }, "FRENZY_ENDED", `Ended Frenzy Mode ${frenzyState.eventId || ""}.`);
}

function bindOwnerControls() {
  root?.querySelector("[data-exec41-activate]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    setButtonBusy(button, true, "Starting…");
    try {
      await activateFrenzy(form);
      setActionMessage("Frenzy Mode activated.", "success");
    } catch (error) {
      setActionMessage(error?.message || "Frenzy Mode could not be activated.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  });

  root?.querySelectorAll("[data-exec41-level]").forEach((button) => button.addEventListener("click", async () => {
    setButtonBusy(button, true, "Updating…");
    try { await setFrenzyLevel(Number(button.dataset.exec41Level)); }
    catch (error) { setActionMessage(error?.message || "Frenzy level could not be changed.", "error"); }
    finally { setButtonBusy(button, false); }
  }));

  root?.querySelector("[data-exec41-extend]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    setButtonBusy(button, true, "Extending…");
    try { await extendFrenzy(10); }
    catch (error) { setActionMessage(error?.message || "Frenzy could not be extended.", "error"); }
    finally { setButtonBusy(button, false); }
  });

  root?.querySelector("[data-exec41-announcement]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    setButtonBusy(button, true, "Publishing…");
    try {
      await sendAnnouncement(new FormData(form).get("announcement"));
      setActionMessage("Announcement published.", "success");
    } catch (error) {
      setActionMessage(error?.message || "Announcement could not be published.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  });

  root?.querySelector("[data-exec41-drop]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const button = form.querySelector('button[type="submit"]');
    setButtonBusy(button, true, "Updating…");
    try {
      await updateDrop({ active: data.get("dropActive") === "on", label: data.get("dropLabel"), code: data.get("dropCode") });
      setActionMessage("Frenzy drop updated.", "success");
    } catch (error) {
      setActionMessage(error?.message || "The drop could not be updated.", "error");
    } finally {
      setButtonBusy(button, false);
    }
  });

  root?.querySelector("[data-exec41-end]")?.addEventListener("click", async (event) => {
    if (!confirm("End Frenzy Mode for the entire site now?")) return;
    const button = event.currentTarget;
    setButtonBusy(button, true, "Ending…");
    try { await endFrenzy(); }
    catch (error) { setActionMessage(error?.message || "Frenzy could not be ended.", "error"); }
    finally { setButtonBusy(button, false); }
  });
}

async function loadFirebase() {
  if (Auth && Fire && auth && db) return;
  const services = await withTimeout(initializeFirebaseServices(), "Cognitus could not connect to Firebase in time.");
  if (!services?.ready) throw new Error("Firebase is not configured for this Cognitus deployment.");
  auth = services.auth;
  db = services.db;
  [Auth, Fire] = await withTimeout(Promise.all([
    import(`${FIREBASE_CDN_BASE}/firebase-auth.js`),
    import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`)
  ]), "Cognitus security services did not finish loading.");
}

async function resolveAuthUser() {
  if (auth?.currentUser) return auth.currentUser;
  return withTimeout(new Promise((resolve) => {
    const unsubscribe = Auth.onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user || null);
    });
  }), "Your Cognitus sign-in session could not be confirmed.", 6000);
}

async function readOwnerRecord(user) {
  if (!user) return null;
  const snap = await withTimeout(Fire.getDoc(Fire.doc(db, "users", user.uid)), "Your Cognitus account record did not load.");
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}

function subscribePortal() {
  portalUnsubscribe?.();
  portalUnsubscribe = null;
  portalReady = false;
  portalError = "";
  if (!Fire || !db || !ownerAuthorized()) return;
  portalUnsubscribe = Fire.onSnapshot(Fire.doc(db, PORTAL_COLLECTION, PORTAL_DOC), (snap) => {
    frenzyState = normalizeFrenzy(snap.exists() ? snap.data()?.frenzy : null);
    portalReady = true;
    portalError = "";
    if (route() === ROUTE && ownerReady) renderOwner();
  }, (error) => {
    portalReady = true;
    portalError = error?.message || "The live event state is unavailable.";
    if (route() === ROUTE && ownerReady) renderOwner();
  });
}

function installAuthObserver() {
  if (authUnsubscribe || !Auth || !auth) return;
  authUnsubscribe = Auth.onAuthStateChanged(auth, (user) => {
    if (user?.uid === authUser?.uid && ownerReady) return;
    authUser = user || null;
    userRecord = null;
    ownerReady = false;
    if (route() === ROUTE) claimRoute(true);
  });
}

async function initializeOwnerSession(requestGeneration) {
  try {
    await loadFirebase();
    if (requestGeneration !== generation || route() !== ROUTE) return;
    authUser = await resolveAuthUser();
    if (requestGeneration !== generation || route() !== ROUTE) return;
    if (!authUser) {
      renderFailure("Sign in to continue.", "Executive Control is available only to the authenticated Cognitus Owner account.", { login: true, restricted: true });
      return;
    }
    userRecord = await readOwnerRecord(authUser);
    if (requestGeneration !== generation || route() !== ROUTE) return;
    if (!userRecord || userRecord.status !== "active" || userRecord.role !== "owner") {
      renderFailure("Owner authorization required.", "This account does not have active Cognitus Owner authorization for Executive Control.", { restricted: true });
      return;
    }
    ownerReady = true;
    renderOwner();
    subscribePortal();
    installAuthObserver();
  } catch (error) {
    if (requestGeneration !== generation || route() !== ROUTE) return;
    console.error("Executive Control V41", error);
    renderFailure("Executive Control could not connect.", error?.message || "Cognitus could not verify the secure Owner workspace. Please retry.");
  }
}

function claimRoute(force = false) {
  mountStyles();
  if (!root || route() !== ROUTE) return;

  if (!force && root.querySelector("[data-executive-v41-page]") && (ownerReady || initialization)) return;

  generation += 1;
  const requestGeneration = generation;
  ownerReady = false;
  portalReady = false;
  portalError = "";
  portalUnsubscribe?.();
  portalUnsubscribe = null;
  renderLoading();
  initialization = initializeOwnerSession(requestGeneration).finally(() => {
    if (requestGeneration === generation) initialization = null;
  });
}

export function startExecutiveControlV41() {
  if (window[START_KEY]) {
    claimRoute(false);
    return;
  }
  window[START_KEY] = true;
  mountStyles();
  claimRoute(false);

  document.addEventListener("cognitus:promo-route-requested", () => claimRoute(false));
  window.addEventListener("hashchange", () => {
    if (route() === ROUTE) claimRoute(false);
    else {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  });
  window.addEventListener("pageshow", () => claimRoute(false));
  document.addEventListener("DOMContentLoaded", () => claimRoute(false));
}
