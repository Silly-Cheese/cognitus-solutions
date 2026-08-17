import "./interfacePolishV13.js";
import "./comprehensiveReportV15.js";
import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userDoc = null;
let timers = [];
let repairing = false;
let reconcileInFlight = null;
let contextCache = null;
let contextCacheKey = "";
let contextCacheAt = 0;
let organizationsCache = null;
let organizationsCacheAt = 0;

const EMPLOYER_ROLES = new Set(["verified_employer_member", "org_admin", "reviewer", "admin", "owner"]);
const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const params = () => new URLSearchParams(location.hash.split("?")[1] || "");
const clean = (value) => String(value ?? "").trim();
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function activeEmployer() {
  return userDoc?.status === "active" && EMPLOYER_ROLES.has(userDoc?.role);
}
function canRepairAccount() {
  return userDoc?.status === "active" && ["admin", "owner"].includes(userDoc?.role);
}
function clearCaches() {
  contextCache = null;
  contextCacheKey = "";
  contextCacheAt = 0;
  organizationsCache = null;
  organizationsCacheAt = 0;
}

async function readDoc(collectionName, id) {
  if (!id) return null;
  const snap = await Fire.getDoc(Fire.doc(db, collectionName, id));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}
async function readWhere(collectionName, field, op, value) {
  const snap = await Fire.getDocs(Fire.query(Fire.collection(db, collectionName), Fire.where(field, op, value)));
  return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}
async function readAll(collectionName) {
  const snap = await Fire.getDocs(Fire.collection(db, collectionName));
  return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}
async function loadOrganizations() {
  if (organizationsCache && Date.now() - organizationsCacheAt < 15000) return organizationsCache;
  organizationsCache = await readAll("organizations").catch(() => []);
  organizationsCacheAt = Date.now();
  return organizationsCache;
}

async function resolveOrganizationReference(reference) {
  const value = clean(reference);
  if (!value) return null;
  const direct = await readDoc("organizations", value).catch(() => null);
  if (direct) return direct;
  const byCognitus = await readWhere("organizations", "cognitusId", "==", value).catch(() => []);
  return byCognitus[0] || null;
}

async function resolveApprovedRequestOrganization() {
  if (!authUser) return null;
  const request = await readDoc("employerStatusRequests", authUser.uid).catch(() => null);
  if (!request || request.status !== "approved") return null;
  return (await resolveOrganizationReference(request.organizationId))
    || (await resolveOrganizationReference(request.organizationCognitusId));
}

async function resolveOrganizationContext() {
  const requested = params().get("org");
  const key = `${authUser?.uid || "anon"}:${userDoc?.role || ""}:${userDoc?.organizationId || ""}:${requested || ""}`;
  if (contextCache && contextCacheKey === key && Date.now() - contextCacheAt < 12000) return contextCache;

  let result = null;
  if (userDoc?.role === "owner" && requested) {
    const selected = await resolveOrganizationReference(requested);
    if (selected) result = { org: selected, source: "owner_selection" };
  }

  if (!result) {
    const assigned = await resolveOrganizationReference(userDoc?.organizationId);
    if (assigned) result = {
      org: assigned,
      source: assigned.id === userDoc?.organizationId ? "account_assignment" : "legacy_cognitus_id"
    };
  }

  if (!result) {
    const approved = await resolveApprovedRequestOrganization();
    if (approved) result = { org: approved, source: "approved_employer_status" };
  }

  if (!result) result = { org: null, source: "none" };
  contextCache = result;
  contextCacheKey = key;
  contextCacheAt = Date.now();
  return result;
}

function repairScreen(org, source) {
  if (!root) return;
  root.innerHTML = `<section class="emp12-repair-card" data-emp12-repair>
    <div class="emp12-repair-mark">ORG</div>
    <p class="eyebrow">Employer Hub</p>
    <h1>Connecting your organization…</h1>
    <p>Cognitus found <strong>${escapeHtml(org.name || org.cognitusId || "your organization")}</strong> from ${source === "approved_employer_status" ? "your approved Employer Status application" : "your existing organization assignment"}. The account link is being normalized so the Employer Hub can open normally.</p>
    <div class="emp12-progress"><span></span></div>
  </section>`;
}

async function repairAssignment(org, source) {
  if (!authUser || !org || !canRepairAccount() || repairing) return false;
  if (userDoc?.organizationId === org.id) return false;
  repairing = true;
  repairScreen(org, source);
  try {
    await Fire.updateDoc(Fire.doc(db, "users", authUser.uid), {
      organizationId: org.id,
      updatedAt: Fire.serverTimestamp()
    });
    clearCaches();
    sessionStorage.setItem("cognitus:employer-org-repaired", org.id);
    window.setTimeout(() => location.reload(), 220);
    return true;
  } catch (error) {
    repairing = false;
    console.warn("Employer Hub organization repair failed", error);
    return false;
  }
}

function ownerChooser(organizations) {
  const verified = organizations
    .filter((org) => org.verificationStatus === "verified")
    .sort((a, b) => clean(a.name).localeCompare(clean(b.name), undefined, { sensitivity: "base" }));
  return `<section class="emp12-owner-chooser" data-emp12-owner-chooser>
    <div class="emp12-owner-heading">
      <div><p class="eyebrow">Owner Workspace</p><h1>Choose an organization.</h1><p>Your Owner account can open an Employer Hub for a verified Cognitus organization. Selecting one also makes it your active employer organization until you switch again.</p></div>
      <span>${verified.length} verified</span>
    </div>
    ${verified.length ? `<div class="emp12-org-grid">${verified.map((org) => `<button type="button" data-emp12-select-org="${escapeHtml(org.id)}"><span>${escapeHtml(org.cognitusId || "Verified Organization")}</span><strong>${escapeHtml(org.name || "Organization")}</strong><small>${escapeHtml(org.organizationType || org.country || "Verified in Cognitus")}</small><b>Open Employer Hub →</b></button>`).join("")}</div>` : `<div class="empty-state"><h3>No verified organizations are available.</h3><p>Verify an organization in Administration before opening its Employer Hub.</p><a class="button button-dark" href="#/admin">Open Administration</a></div>`}
  </section>`;
}

async function selectOwnerOrganization(org) {
  if (!org) return;
  clearCaches();
  const repaired = await repairAssignment(org, "owner_selection");
  if (!repaired) {
    location.hash = `#/employer?org=${encodeURIComponent(org.id)}`;
    location.reload();
  }
}

async function showOwnerChooser() {
  if (!root || userDoc?.role !== "owner" || route() !== "/employer") return;
  const existingGate = root.querySelector(".emp11-gate");
  if (!existingGate || root.querySelector("[data-emp12-owner-chooser]")) return;
  const organizations = await loadOrganizations();
  root.innerHTML = ownerChooser(organizations);
  root.querySelectorAll("[data-emp12-select-org]").forEach((button) => {
    button.addEventListener("click", async () => {
      const org = organizations.find((item) => item.id === button.dataset.emp12SelectOrg);
      if (!org) return;
      button.disabled = true;
      button.textContent = "Opening…";
      await selectOwnerOrganization(org);
    });
  });
}

async function enhanceOwnerSwitcher(currentOrg) {
  if (!root || userDoc?.role !== "owner" || route() !== "/employer") return;
  const aside = root.querySelector(".emp11-workspace-hero aside");
  if (!aside || aside.querySelector("[data-emp12-owner-switcher]")) return;
  const organizations = (await loadOrganizations())
    .filter((org) => org.verificationStatus === "verified")
    .sort((a, b) => clean(a.name).localeCompare(clean(b.name), undefined, { sensitivity: "base" }));
  if (!organizations.length) return;
  const wrap = document.createElement("label");
  wrap.className = "emp12-owner-switcher";
  wrap.dataset.emp12OwnerSwitcher = "true";
  wrap.innerHTML = `<span>Owner workspace</span><select aria-label="Switch Employer Hub organization">${organizations.map((org) => `<option value="${escapeHtml(org.id)}" ${org.id === currentOrg?.id ? "selected" : ""}>${escapeHtml(org.name || org.cognitusId || "Organization")}</option>`).join("")}</select>`;
  aside.appendChild(wrap);
  wrap.querySelector("select")?.addEventListener("change", async (event) => {
    const org = organizations.find((item) => item.id === event.currentTarget.value);
    event.currentTarget.disabled = true;
    await selectOwnerOrganization(org);
  });
}

async function reconcileEmployerHub() {
  if (!authUser || !userDoc || !activeEmployer()) return;
  if (!route().startsWith("/employer") || route() === "/employer-status") return;

  const { org, source } = await resolveOrganizationContext();
  if (org && userDoc.organizationId !== org.id && canRepairAccount()) {
    const repaired = await repairAssignment(org, source);
    if (repaired) return;
  }

  if (!org && userDoc.role === "owner") {
    await showOwnerChooser();
    return;
  }

  if (org && userDoc.role === "owner") await enhanceOwnerSwitcher(org);
}

function runReconcile() {
  if (reconcileInFlight) return reconcileInFlight;
  reconcileInFlight = Promise.resolve(reconcileEmployerHub())
    .catch((error) => console.warn("Employer Hub V12 reconciliation failed", error))
    .finally(() => { reconcileInFlight = null; });
  return reconcileInFlight;
}

function mountStyles() {
  if (document.querySelector("#cognitus-employer-hub-fix-v12")) return;
  const link = document.createElement("link");
  link.id = "cognitus-employer-hub-fix-v12";
  link.rel = "stylesheet";
  link.href = "./src/employerHubFixV12.css?v=20260816-2";
  document.head.appendChild(link);
}

function schedule() {
  timers.forEach(clearTimeout);
  timers = [100, 480, 1300].map((delay) => setTimeout(runReconcile, delay));
}

async function initialize() {
  mountStyles();
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
    userDoc = user ? await readDoc("users", user.uid).catch(() => null) : null;
    clearCaches();
    schedule();
  });
  window.addEventListener("hashchange", () => {
    contextCache = null;
    contextCacheKey = "";
    contextCacheAt = 0;
    schedule();
  });
  window.addEventListener("pageshow", schedule);
  window.addEventListener("DOMContentLoaded", schedule);
  schedule();
}

initialize().catch((error) => console.warn("Employer Hub Fix V12 failed to initialize", error));
