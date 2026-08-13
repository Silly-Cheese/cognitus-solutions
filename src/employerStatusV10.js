import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userDoc = null;
let timers = [];

const EMPLOYER_ROLES = new Set(["verified_employer_member", "org_admin", "reviewer", "admin", "owner"]);
const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const clean = (value) => String(value ?? "").trim();
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function timestampMs(value) {
  try {
    const date = value?.toDate?.() || (value ? new Date(value) : null);
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  } catch { return 0; }
}
function formatTimestamp(value) {
  const ms = timestampMs(value);
  return ms ? new Date(ms).toLocaleString() : "—";
}
function humanize(value) {
  return clean(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function statusTone(status) {
  const value = clean(status).toLowerCase();
  if (["approved", "active"].includes(value)) return "success";
  if (["denied", "withdrawn"].includes(value)) return "danger";
  if (["pending", "pending_review"].includes(value)) return "warning";
  return "neutral";
}
function badge(status) {
  return `<span class="emp10-badge is-${statusTone(status)}">${escapeHtml(humanize(status))}</span>`;
}
function createCognitusId(prefix) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(7);
  crypto.getRandomValues(bytes);
  return `${prefix}-${String(new Date().getFullYear()).slice(-2)}-${Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("")}`;
}
function isActive() { return userDoc?.status === "active"; }
function isAdmin() { return isActive() && ["admin", "owner"].includes(userDoc?.role); }
function hasEmployerStatus() { return isActive() && EMPLOYER_ROLES.has(userDoc?.role); }

function mountStyles() {
  if (document.querySelector("#cognitus-employer-status-v10")) return;
  const link = document.createElement("link");
  link.id = "cognitus-employer-status-v10";
  link.rel = "stylesheet";
  link.href = "./src/employerStatusV10.css?v=20260812-1";
  document.head.appendChild(link);
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
async function readWhere(collectionName, field, op, value) {
  const snap = await Fire.getDocs(Fire.query(Fire.collection(db, collectionName), Fire.where(field, op, value)));
  return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}
async function writeAudit(action, targetId, summary, metadata = {}) {
  if (!authUser || !userDoc || !isActive()) return;
  try {
    const ref = Fire.doc(Fire.collection(db, "auditLogs"));
    await Fire.setDoc(ref, {
      id: ref.id,
      cognitusId: createCognitusId("AUD"),
      actorUid: authUser.uid,
      actorCognitusId: userDoc.cognitusId,
      actorRole: userDoc.role,
      action,
      targetType: "employer_status_request",
      targetId,
      summary: clean(summary).slice(0, 500),
      metadata,
      createdAt: Fire.serverTimestamp()
    });
  } catch (error) {
    console.warn("Employer status audit logging failed", error);
  }
}

async function verifiedOrganizations() {
  const organizations = await readAll("organizations");
  return organizations
    .filter((org) => org.verificationStatus === "verified")
    .sort((a, b) => clean(a.name).localeCompare(clean(b.name), undefined, { sensitivity: "base" }));
}

async function submitEmployerRequest(formData, existing) {
  if (!authUser || !userDoc || !isActive()) throw new Error("An active Cognitus account is required.");
  if (userDoc.role !== "user") throw new Error("This account already has an elevated employer or staff role.");
  if (existing?.status === "pending") throw new Error("You already have a pending employer status request.");

  const organizationId = clean(formData.organizationId);
  const positionTitle = clean(formData.positionTitle).slice(0, 100);
  const reason = clean(formData.reason).slice(0, 1200);
  const organization = await readDoc("organizations", organizationId);
  if (!organization || organization.verificationStatus !== "verified") throw new Error("Choose a currently verified Cognitus organization.");
  if (!positionTitle) throw new Error("Tell us your role or position with the organization.");
  if (reason.length < 30) throw new Error("Please give a little more context about why employer access is needed.");

  const ref = Fire.doc(db, "employerStatusRequests", authUser.uid);
  const payload = {
    id: authUser.uid,
    cognitusId: existing?.cognitusId || createCognitusId("EMP"),
    applicantUid: authUser.uid,
    applicantCognitusId: userDoc.cognitusId,
    applicantDisplayName: userDoc.displayName || userDoc.discordUsername || "Cognitus User",
    organizationId,
    organizationCognitusId: organization.cognitusId,
    organizationName: organization.name,
    positionTitle,
    reason,
    status: "pending",
    submittedAt: Fire.serverTimestamp(),
    updatedAt: Fire.serverTimestamp(),
    reviewedAt: null,
    reviewedByUid: null,
    reviewerNotes: ""
  };
  if (existing) await Fire.setDoc(ref, payload);
  else await Fire.setDoc(ref, payload);
  await writeAudit("EMPLOYER_STATUS_REQUESTED", authUser.uid, `Requested employer status for ${organization.name}.`, { organizationId });
}

async function withdrawRequest(request) {
  if (!request || request.applicantUid !== authUser?.uid || request.status !== "pending") throw new Error("Only your pending request can be withdrawn.");
  await Fire.updateDoc(Fire.doc(db, "employerStatusRequests", request.id), {
    status: "withdrawn",
    updatedAt: Fire.serverTimestamp()
  });
  await writeAudit("EMPLOYER_STATUS_WITHDRAWN", request.id, "Withdrew employer status request.", { organizationId: request.organizationId });
}

async function decideRequest(request, decision, notes) {
  if (!isAdmin()) throw new Error("Admin or Owner access is required.");
  if (!request || request.status !== "pending") throw new Error("This request is no longer pending.");
  if (!["approved", "denied"].includes(decision)) throw new Error("Unknown employer status decision.");
  const applicant = await readDoc("users", request.applicantUid);
  if (!applicant || applicant.status !== "active") throw new Error("The applicant account is no longer active.");
  if (decision === "approved" && applicant.role !== "user") throw new Error("The applicant already has an elevated role.");
  const organization = await readDoc("organizations", request.organizationId);
  if (!organization || organization.verificationStatus !== "verified") throw new Error("The selected organization is no longer verified.");

  const batch = Fire.writeBatch(db);
  batch.update(Fire.doc(db, "employerStatusRequests", request.id), {
    status: decision,
    reviewedAt: Fire.serverTimestamp(),
    reviewedByUid: authUser.uid,
    reviewerNotes: clean(notes).slice(0, 1000),
    updatedAt: Fire.serverTimestamp()
  });
  if (decision === "approved") {
    batch.update(Fire.doc(db, "users", request.applicantUid), {
      role: "verified_employer_member",
      organizationId: request.organizationId,
      updatedAt: Fire.serverTimestamp()
    });
  }
  await batch.commit();
  await writeAudit(
    decision === "approved" ? "EMPLOYER_STATUS_APPROVED" : "EMPLOYER_STATUS_DENIED",
    request.id,
    `${humanize(decision)} employer status request for ${request.applicantDisplayName}.`,
    { applicantUid: request.applicantUid, organizationId: request.organizationId }
  );
}

function activeEmployerCard(organization) {
  return `<section class="emp10-active-card">
    <div class="emp10-active-icon" aria-hidden="true">✓</div>
    <div><p class="eyebrow">Employer Access Active</p><h2>Your account is approved for employer workflows.</h2><p>Your current Cognitus role is <strong>${escapeHtml(humanize(userDoc.role))}</strong>${organization ? ` and you are assigned to <strong>${escapeHtml(organization.name)}</strong>` : ""}.</p><div class="emp10-actions"><a class="button button-dark" href="#/search">Run a Check</a><a class="button button-light" href="#/reports">Reports & Access</a></div></div>
  </section>`;
}

function requestStatusCard(request) {
  if (!request) return "";
  return `<section class="emp10-status-card">
    <div class="emp10-status-head"><div><p class="eyebrow">Your Application</p><h2>${escapeHtml(request.organizationName || "Employer Status Request")}</h2></div>${badge(request.status)}</div>
    <div class="emp10-status-grid"><div><span>Application ID</span><strong>${escapeHtml(request.cognitusId || request.id)}</strong></div><div><span>Position</span><strong>${escapeHtml(request.positionTitle || "—")}</strong></div><div><span>Submitted</span><strong>${escapeHtml(formatTimestamp(request.submittedAt))}</strong></div><div><span>Decision</span><strong>${escapeHtml(formatTimestamp(request.reviewedAt))}</strong></div></div>
    <div class="emp10-statement"><span>Why access was requested</span><p>${escapeHtml(request.reason || "—")}</p></div>
    ${request.reviewerNotes ? `<div class="emp10-review-note"><span>Reviewer notes</span><p>${escapeHtml(request.reviewerNotes)}</p></div>` : ""}
    ${request.status === "pending" ? `<div class="emp10-actions"><button class="button button-light" type="button" data-emp10-withdraw>Withdraw Request</button></div>` : ""}
  </section>`;
}

function applicationForm(organizations, request) {
  const canApply = !request || ["denied", "withdrawn"].includes(request.status);
  if (!canApply) return "";
  if (!organizations.length) return `<section class="panel emp10-form-card"><div class="empty-state"><h3>No verified organizations are available yet.</h3><p>Employer status must be tied to a verified organization. If yours is missing, create/request the organization first.</p><a class="button button-dark" href="#/organizations?request=1">Request an Organization</a></div></section>`;
  return `<section class="panel emp10-form-card">
    <div class="panel-header"><div><p class="eyebrow">Application</p><h2>${request ? "Reapply for Employer Status" : "Request Employer Status"}</h2></div><span>Usually reviewed by Cognitus staff</span></div>
    <div class="emp10-step-row"><div><b>1</b><span>Choose organization</span></div><div><b>2</b><span>Explain your role</span></div><div><b>3</b><span>Staff review</span></div></div>
    <form class="emp10-form" data-emp10-form>
      <label>Organization<select name="organizationId" required><option value="">Select your organization</option>${organizations.map((org) => `<option value="${escapeHtml(org.id)}" ${request?.organizationId === org.id ? "selected" : ""}>${escapeHtml(org.name)} · ${escapeHtml(org.cognitusId || "Verified")}</option>`).join("")}</select><small>Only verified Cognitus organizations can sponsor employer status.</small></label>
      <label>Your role or position<input name="positionTitle" maxlength="100" required value="${escapeHtml(request?.positionTitle || "")}" placeholder="Example: Human Resources Director" /></label>
      <label>Why do you need employer access?<textarea name="reason" maxlength="1200" rows="6" required placeholder="Tell us what you do for the organization and how you intend to use Cognitus for legitimate staffing or organizational review.">${escapeHtml(request?.reason || "")}</textarea><small>Be specific. Employer access provides additional report-request and organization-linked capabilities.</small></label>
      <label class="emp10-check"><input type="checkbox" name="certify" required /><span>I certify that I am authorized to represent the organization selected above and that I will use Cognitus only for legitimate organizational purposes.</span></label>
      <div class="emp10-submit-row"><button class="button button-dark" type="submit">${request ? "Resubmit Application" : "Submit Application"}</button><span data-emp10-message aria-live="polite"></span></div>
    </form>
  </section>`;
}

async function staffQueue() {
  if (!isAdmin()) return "";
  const pending = (await readWhere("employerStatusRequests", "status", "==", "pending").catch(() => []))
    .sort((a, b) => timestampMs(a.submittedAt) - timestampMs(b.submittedAt));
  return `<section class="panel emp10-staff-panel" data-emp10-staff-panel>
    <div class="panel-header"><div><p class="eyebrow">Staff Review</p><h2>Employer applications</h2></div><span>${pending.length} pending</span></div>
    ${pending.length ? `<div class="emp10-review-list">${pending.map((request) => `<article data-emp10-request="${escapeHtml(request.id)}"><div class="emp10-review-head"><div><span>${escapeHtml(request.applicantCognitusId || request.applicantUid)}</span><h3>${escapeHtml(request.applicantDisplayName || "Cognitus User")}</h3></div>${badge("pending")}</div><dl><div><dt>Organization</dt><dd>${escapeHtml(request.organizationName || request.organizationCognitusId)}</dd></div><div><dt>Position</dt><dd>${escapeHtml(request.positionTitle)}</dd></div><div><dt>Submitted</dt><dd>${escapeHtml(formatTimestamp(request.submittedAt))}</dd></div></dl><div class="emp10-review-reason"><strong>Applicant statement</strong><p>${escapeHtml(request.reason)}</p></div><label>Decision notes<textarea data-emp10-notes rows="3" maxlength="1000" placeholder="Optional notes shown to the applicant."></textarea></label><div class="emp10-actions"><button class="button button-dark" type="button" data-emp10-decision="approved">Approve Employer Status</button><button class="button button-danger" type="button" data-emp10-decision="denied">Deny</button><span data-emp10-review-message aria-live="polite"></span></div></article>`).join("")}</div>` : `<div class="empty-state"><h3>Queue clear</h3><p>There are no employer status applications waiting for review.</p></div>`}
  </section>`;
}

async function renderPage() {
  if (route() !== "/employer-status" || !authUser || !userDoc || !root) return;
  if (root.querySelector("[data-emp10-page]")) return;
  const [organizations, request, currentOrganization, queue] = await Promise.all([
    verifiedOrganizations().catch(() => []),
    readDoc("employerStatusRequests", authUser.uid).catch(() => null),
    userDoc.organizationId ? readDoc("organizations", userDoc.organizationId).catch(() => null) : Promise.resolve(null),
    staffQueue()
  ]);
  document.title = "Employer Status · Cognitus Solutions";
  root.innerHTML = `<main data-emp10-page>
    <section class="emp10-hero"><div><p class="eyebrow">Organization Access</p><h1>Request Employer Status.</h1><p>Connect your Cognitus account to the organization you represent. Employer status is reviewed before additional organization-linked screening and full-report request capabilities are enabled.</p><div class="emp10-hero-points"><span>Verified organization required</span><span>Human review</span><span>Account-linked approval</span></div></div><aside><span>Current role</span><strong>${escapeHtml(humanize(userDoc.role))}</strong><small>${hasEmployerStatus() ? "Employer capabilities active" : "Individual account"}</small></aside></section>
    ${hasEmployerStatus() ? activeEmployerCard(currentOrganization) : requestStatusCard(request)}
    ${!hasEmployerStatus() ? applicationForm(organizations, request) : ""}
    <section class="emp10-info-grid"><article><span>01</span><h3>Choose your organization</h3><p>Your employer status is attached to one verified Cognitus organization. If the organization is not listed, request its creation first.</p></article><article><span>02</span><h3>Tell us what you do</h3><p>Give staff enough context to understand your position and why organization-linked Cognitus access is appropriate.</p></article><article><span>03</span><h3>Approval changes your account</h3><p>Approval assigns your account to the selected organization and changes your role to Verified Employer Member.</p></article></section>
    ${queue}
  </main>`;

  root.querySelector("[data-emp10-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const message = form.querySelector("[data-emp10-message]");
    const data = Object.fromEntries(new FormData(form).entries());
    button.disabled = true;
    button.textContent = "Submitting…";
    message.textContent = "";
    try {
      await submitEmployerRequest(data, request);
      message.textContent = "Application submitted.";
      message.className = "is-success";
      setTimeout(() => { root.querySelector("[data-emp10-page]")?.remove(); schedule(); }, 350);
    } catch (error) {
      message.textContent = error?.message || "Application could not be submitted.";
      message.className = "is-error";
      button.disabled = false;
      button.textContent = request ? "Resubmit Application" : "Submit Application";
    }
  });

  root.querySelector("[data-emp10-withdraw]")?.addEventListener("click", async (event) => {
    if (!window.confirm("Withdraw your pending employer status request?")) return;
    event.currentTarget.disabled = true;
    try {
      await withdrawRequest(request);
      root.querySelector("[data-emp10-page]")?.remove();
      schedule();
    } catch (error) {
      window.alert(error?.message || "Request could not be withdrawn.");
      event.currentTarget.disabled = false;
    }
  });

  root.querySelectorAll("[data-emp10-decision]").forEach((button) => button.addEventListener("click", async () => {
    const card = button.closest("[data-emp10-request]");
    const requestId = card?.dataset.emp10Request;
    const pending = await readDoc("employerStatusRequests", requestId).catch(() => null);
    if (!pending) return;
    const decision = button.dataset.emp10Decision;
    const notes = clean(card.querySelector("[data-emp10-notes]")?.value);
    const message = card.querySelector("[data-emp10-review-message]");
    if (!window.confirm(decision === "approved" ? `Approve ${pending.applicantDisplayName} as a Verified Employer Member of ${pending.organizationName}?` : `Deny ${pending.applicantDisplayName}'s employer status request?`)) return;
    card.querySelectorAll("button").forEach((item) => { item.disabled = true; });
    message.textContent = decision === "approved" ? "Approving…" : "Denying…";
    try {
      await decideRequest(pending, decision, notes);
      message.textContent = decision === "approved" ? "Approved." : "Denied.";
      message.className = "is-success";
      setTimeout(() => { root.querySelector("[data-emp10-page]")?.remove(); schedule(); }, 350);
    } catch (error) {
      message.textContent = error?.message || "Decision could not be saved.";
      message.className = "is-error";
      card.querySelectorAll("button").forEach((item) => { item.disabled = false; });
    }
  }));
}

function mountDashboardInvite() {
  if (route() !== "/dashboard" || !authUser || !userDoc || userDoc.role !== "user" || !root) return;
  if (root.querySelector("[data-emp10-dashboard-invite]")) return;
  const dashboard = root.querySelector(".dashboard-grid") || root.querySelector(".dashboard-hero");
  if (!dashboard) return;
  const card = document.createElement("section");
  card.className = "emp10-dashboard-invite";
  card.dataset.emp10DashboardInvite = "true";
  card.innerHTML = `<div><span>Represent an organization?</span><strong>Request Employer Status</strong><p>Link your account to a verified organization and apply for employer-level Cognitus access.</p></div><a class="button button-dark" href="#/employer-status">Start Application</a>`;
  dashboard.insertAdjacentElement("afterend", card);
}

async function enhance() {
  if (!authUser || !userDoc) return;
  await renderPage();
  mountDashboardInvite();
}
function schedule() {
  timers.forEach(clearTimeout);
  timers = [0, 180, 520, 1100].map((delay) => setTimeout(() => enhance().catch((error) => console.warn("Employer Status V10 enhancement failed", error)), delay));
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
    schedule();
  });
  window.addEventListener("hashchange", schedule);
  window.addEventListener("pageshow", schedule);
  window.addEventListener("DOMContentLoaded", schedule);
  schedule();
}
initialize().catch((error) => console.warn("Employer Status V10 failed to initialize", error));
