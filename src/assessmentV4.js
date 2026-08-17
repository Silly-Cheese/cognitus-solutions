import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userDoc = null;
let profileDoc = null;
let timers = [];
let enhanceInFlight = null;
let adminProfilesPromise = null;

const STANDING = Object.freeze([
  ["unreviewed", "Unreviewed"],
  ["good", "Good Standing"],
  ["watch", "Watch"],
  ["concern", "Concern"],
  ["restricted", "Restricted"]
]);
const RISK = Object.freeze([
  ["unreviewed", "Unreviewed"],
  ["low", "Low"],
  ["moderate", "Moderate"],
  ["high", "High"],
  ["critical", "Critical"]
]);
const ASSESSMENT_ROLES = new Set(["reviewer", "admin", "owner"]);

const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const root = () => document.querySelector("#page-root");
const clean = (value) => String(value ?? "").trim();
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function canAssess() {
  return userDoc?.status === "active" && ASSESSMENT_ROLES.has(userDoc?.role);
}

function createCognitusId(prefix) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(7);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
  return `${prefix}-${String(new Date().getFullYear()).slice(-2)}-${random}`;
}

function options(values, selected) {
  return values.map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function labelFor(values, value) {
  return values.find(([key]) => key === value)?.[1] || clean(value) || "Unreviewed";
}

function friendlyError(error) {
  if (error?.code === "permission-denied" || error?.code === "firestore/permission-denied") {
    return "Firebase rejected the standing/risk update. Deploy the latest firestore.rules and try again.";
  }
  if (error?.code === "unavailable" || error?.code === "firestore/unavailable") {
    return "Firebase is temporarily unavailable. Check your connection and try again.";
  }
  return error?.message || "Assessment could not be updated.";
}

function toast(message, tone = "success") {
  let region = document.querySelector(".v4-toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "v4-toast-region";
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }
  const node = document.createElement("div");
  node.className = `v4-toast${tone === "error" ? " is-error" : " is-success"}`;
  node.textContent = message;
  region.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

async function readDoc(collectionName, id) {
  if (!id) return null;
  const snap = await Fire.getDoc(Fire.doc(db, collectionName, id));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}

async function readAll(collectionName) {
  const snap = await Fire.getDocs(Fire.collection(db, collectionName));
  return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

async function refreshSelf() {
  if (!authUser) {
    userDoc = null;
    profileDoc = null;
    return;
  }
  [userDoc, profileDoc] = await Promise.all([
    readDoc("users", authUser.uid),
    readDoc("profiles", authUser.uid)
  ]);
}

async function writeAudit(targetId, previous, next) {
  if (!authUser || !userDoc?.cognitusId || userDoc.status !== "active") return;
  try {
    const ref = Fire.doc(Fire.collection(db, "auditLogs"));
    await Fire.setDoc(ref, {
      id: ref.id,
      cognitusId: createCognitusId("AUD"),
      actorUid: authUser.uid,
      actorCognitusId: userDoc.cognitusId,
      actorRole: userDoc.role,
      action: "PROFILE_ASSESSMENT_UPDATED",
      targetType: "profile",
      targetId,
      summary: `Updated professional standing to ${next.professionalStanding} and risk to ${next.riskLevel}.`,
      metadata: {
        previousStanding: previous.professionalStanding || "unreviewed",
        previousRisk: previous.riskLevel || "unreviewed",
        newStanding: next.professionalStanding,
        newRisk: next.riskLevel
      },
      createdAt: Fire.serverTimestamp()
    });
  } catch (error) {
    console.warn("Assessment audit logging failed", error);
  }
}

async function updateAssessment(profileId, professionalStanding, riskLevel) {
  if (!canAssess()) throw new Error("Reviewer, Admin, or Owner access is required.");
  if (!STANDING.some(([value]) => value === professionalStanding)) throw new Error("Choose a valid professional standing.");
  if (!RISK.some(([value]) => value === riskLevel)) throw new Error("Choose a valid risk level.");

  const previous = await readDoc("profiles", profileId);
  if (!previous) throw new Error("Profile could not be found.");

  await Fire.updateDoc(Fire.doc(db, "profiles", profileId), {
    professionalStanding,
    riskLevel,
    lastReviewedAt: Fire.serverTimestamp(),
    updatedAt: Fire.serverTimestamp()
  });

  const persisted = await readDoc("profiles", profileId);
  if (!persisted || persisted.professionalStanding !== professionalStanding || persisted.riskLevel !== riskLevel) {
    throw new Error("The assessment write was not confirmed by Firestore. Please try again.");
  }

  await writeAudit(profileId, previous, persisted);
  if (profileId === authUser.uid) profileDoc = persisted;
  return persisted;
}

function setInlineStatus(node, message, tone = "neutral") {
  if (!node) return;
  node.hidden = false;
  node.textContent = message;
  node.className = `notice${tone === "error" ? " notice-error" : tone === "success" ? " notice-success" : ""}`;
}

function mountDashboardSummary() {
  if (route() !== "/dashboard" || !profileDoc) return;
  const grid = root()?.querySelector(".stats-grid");
  if (!grid || grid.querySelector("[data-v4-assessment-summary]")) return;
  const card = document.createElement("article");
  card.className = "stat-card v4-assessment-summary";
  card.dataset.v4AssessmentSummary = "true";
  card.innerHTML = `
    <span>Assessment</span>
    <strong>${escapeHtml(labelFor(STANDING, profileDoc.professionalStanding))} · ${escapeHtml(labelFor(RISK, profileDoc.riskLevel))}</strong>
    <small>Standing · Risk${canAssess() ? ` · <a href="#/settings">Edit</a>` : ""}</small>`;
  grid.appendChild(card);
}

function mountSettingsAssessment() {
  if (route() !== "/settings" || !canAssess() || !profileDoc) return;
  const container = root()?.querySelector("[data-v4-settings-controls]");
  if (!container || container.querySelector("[data-v4-assessment-self]")) return;

  const card = document.createElement("section");
  card.className = "form-card v4-assessment-card";
  card.dataset.v4AssessmentSelf = "true";
  card.innerHTML = `
    <p class="eyebrow">Assessment</p>
    <h2>Standing & risk</h2>
    <p>These fields are part of Cognitus's reviewed profile assessment. Changes are saved directly to your profile and logged.</p>
    <form class="form-stack" data-v4-assessment-form>
      <div class="form-row">
        <label>Professional Standing
          <select name="professionalStanding">${options(STANDING, profileDoc.professionalStanding || "unreviewed")}</select>
        </label>
        <label>Risk Level
          <select name="riskLevel">${options(RISK, profileDoc.riskLevel || "unreviewed")}</select>
        </label>
      </div>
      <div class="notice" data-v4-assessment-status hidden></div>
      <button class="button v4-primary-button" type="submit">Save assessment</button>
    </form>`;

  const danger = container.querySelector(".v4-danger-zone");
  if (danger) danger.insertAdjacentElement("beforebegin", card);
  else container.appendChild(card);

  card.querySelector("[data-v4-assessment-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const button = form.querySelector("button[type=submit]");
    const status = form.querySelector("[data-v4-assessment-status]");
    button.disabled = true;
    button.textContent = "Saving…";
    setInlineStatus(status, "Saving standing and risk…");
    try {
      const persisted = await updateAssessment(authUser.uid, clean(data.professionalStanding), clean(data.riskLevel));
      const message = `Saved: ${labelFor(STANDING, persisted.professionalStanding)} · ${labelFor(RISK, persisted.riskLevel)}.`;
      setInlineStatus(status, message, "success");
      toast("Standing and risk updated.");
    } catch (error) {
      const message = friendlyError(error);
      setInlineStatus(status, message, "error");
      toast(message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Save assessment";
    }
  });
}

function insertHeader(table, key, label) {
  const head = table.querySelector("thead tr");
  if (!head || head.querySelector(`[data-v4-assessment-head="${key}"]`)) return;
  const th = document.createElement("th");
  th.dataset.v4AssessmentHead = key;
  th.textContent = label;
  const actionsHead = head.querySelector("[data-v4-actions-head]");
  if (actionsHead) actionsHead.insertAdjacentElement("beforebegin", th);
  else head.appendChild(th);
}

function makeAdminAssessmentCell(profile, kind) {
  const td = document.createElement("td");
  td.dataset[kind === "standing" ? "v4AssessmentStanding" : "v4AssessmentRisk"] = profile.id;
  const values = kind === "standing" ? STANDING : RISK;
  const selected = kind === "standing" ? profile.professionalStanding : profile.riskLevel;
  const label = kind === "standing" ? "Professional standing" : "Risk level";
  td.innerHTML = `<select aria-label="${label} for ${escapeHtml(profile.displayName || profile.id)}">${options(values, selected || "unreviewed")}</select>`;
  return td;
}

function makeAdminSaveButton(uid, profile, standingCell, riskCell) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-light";
  button.dataset.v4SaveAssessment = uid;
  button.textContent = "Save";
  button.title = "Save standing and risk";
  button.addEventListener("click", async () => {
    const standing = standingCell.querySelector("select")?.value;
    const risk = riskCell.querySelector("select")?.value;
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      const persisted = await updateAssessment(uid, standing, risk);
      button.textContent = "Saved ✓";
      toast(`Assessment updated for ${profile.displayName || "user"}.`);
      window.setTimeout(() => {
        if (button.isConnected) button.textContent = "Save";
      }, 1600);
      standingCell.querySelector("select").value = persisted.professionalStanding;
      riskCell.querySelector("select").value = persisted.riskLevel;
    } catch (error) {
      const message = friendlyError(error);
      toast(message, "error");
      button.textContent = "Save";
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

async function mountAdminAssessments() {
  if (route() !== "/admin" || !canAssess()) return;
  const panel = root()?.querySelector("#admin-users");
  const table = panel?.querySelector("table");
  if (!table || table.dataset.v4AssessmentMounted === "true") return;

  const rows = [...table.querySelectorAll("tbody tr")];
  if (!rows.length || !rows.some((row) => row.querySelector("[data-user-role]"))) return;

  if (!adminProfilesPromise) adminProfilesPromise = readAll("profiles").finally(() => { adminProfilesPromise = null; });
  const profiles = await adminProfilesPromise;
  if (table.dataset.v4AssessmentMounted === "true") return;
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  insertHeader(table, "standing", "Standing");
  insertHeader(table, "risk", "Risk");

  let mountedRows = 0;
  for (const row of rows) {
    const roleSelect = row.querySelector("[data-user-role]");
    if (!roleSelect) continue;
    const uid = roleSelect.dataset.userRole;
    const profile = byId.get(uid);
    if (!profile) continue;

    let standingCell = row.querySelector(`[data-v4-assessment-standing="${CSS.escape(uid)}"]`);
    let riskCell = row.querySelector(`[data-v4-assessment-risk="${CSS.escape(uid)}"]`);

    if (!standingCell) standingCell = makeAdminAssessmentCell(profile, "standing");
    if (!riskCell) riskCell = makeAdminAssessmentCell(profile, "risk");

    const actionCell = row.querySelector(".v4-admin-action-cell");
    if (!standingCell.isConnected || !riskCell.isConnected) {
      if (actionCell) {
        if (!standingCell.isConnected) actionCell.insertAdjacentElement("beforebegin", standingCell);
        if (!riskCell.isConnected) actionCell.insertAdjacentElement("beforebegin", riskCell);
      } else {
        if (!standingCell.isConnected) row.appendChild(standingCell);
        if (!riskCell.isConnected) row.appendChild(riskCell);
      }
    }

    if (!riskCell.querySelector("[data-v4-save-assessment]")) {
      const saveWrap = document.createElement("div");
      saveWrap.className = "mini-actions";
      saveWrap.style.marginTop = ".45rem";
      saveWrap.appendChild(makeAdminSaveButton(uid, profile, standingCell, riskCell));
      riskCell.appendChild(saveWrap);
    }
    mountedRows += 1;
  }

  if (mountedRows > 0) table.dataset.v4AssessmentMounted = "true";
}

async function enhance() {
  if (!authUser || !userDoc) return;
  try {
    mountDashboardSummary();
    mountSettingsAssessment();
    await mountAdminAssessments();
  } catch (error) {
    console.warn("Assessment controls failed to mount", error);
  }
}

function runEnhance() {
  if (enhanceInFlight) return enhanceInFlight;
  enhanceInFlight = Promise.resolve(enhance()).finally(() => { enhanceInFlight = null; });
  return enhanceInFlight;
}

function schedule() {
  timers.forEach(clearTimeout);
  timers = [0, 260, 900].map((delay) => setTimeout(runEnhance, delay));
}

async function initialize() {
  const services = await initializeFirebaseServices();
  if (!services.ready) return;
  auth = services.auth;
  db = services.db;
  [Auth, Fire] = await Promise.all([
    import(`${FIREBASE_CDN_BASE}/firebase-auth.js`),
    import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`)
  ]);
  Auth.onAuthStateChanged(auth, async (user) => {
    authUser = user;
    adminProfilesPromise = null;
    await refreshSelf();
    schedule();
  });
  window.addEventListener("hashchange", () => {
    adminProfilesPromise = null;
    schedule();
  });
  window.addEventListener("DOMContentLoaded", schedule);
  schedule();
}

initialize().catch((error) => console.warn("Assessment V4 failed to initialize", error));
