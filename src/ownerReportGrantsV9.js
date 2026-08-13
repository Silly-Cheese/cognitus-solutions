import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userDoc = null;
let timers = [];

const ELIGIBLE_STATUSES = new Set(["approved", "published", "disputed"]);

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
function createCognitusId(prefix) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(7);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
  return `${prefix}-${String(new Date().getFullYear()).slice(-2)}-${random}`;
}
function isOwner() {
  return userDoc?.status === "active" && userDoc?.role === "owner";
}
function grantId(reportId, uid) {
  return `${reportId}__${uid}`;
}

function mountStyles() {
  if (document.querySelector("#cognitus-owner-report-grants-v9")) return;
  const link = document.createElement("link");
  link.id = "cognitus-owner-report-grants-v9";
  link.rel = "stylesheet";
  link.href = "./src/ownerReportGrantsV9.css?v=20260812-1";
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

async function writeAudit(action, reportId, summary, metadata = {}) {
  if (!authUser || !userDoc || userDoc.status !== "active") return;
  try {
    const ref = Fire.doc(Fire.collection(db, "auditLogs"));
    await Fire.setDoc(ref, {
      id: ref.id,
      cognitusId: createCognitusId("AUD"),
      actorUid: authUser.uid,
      actorCognitusId: userDoc.cognitusId,
      actorRole: userDoc.role,
      action,
      targetType: "report",
      targetId: reportId,
      summary: clean(summary).slice(0, 500),
      metadata,
      createdAt: Fire.serverTimestamp()
    });
  } catch (error) {
    console.warn("Owner report grant audit failed", error);
  }
}

async function createOwnerGrant(reportId, granteeUid, reason) {
  if (!isOwner()) throw new Error("Owner access is required.");
  const [report, grantee] = await Promise.all([
    readDoc("reports", reportId),
    readDoc("users", granteeUid)
  ]);
  if (!report?.subjectProfileId) throw new Error("Owner direct grants apply only to reports about people.");
  if (!ELIGIBLE_STATUSES.has(report.status)) throw new Error("Only approved, published, or disputed reports can be directly shared.");
  if (!grantee || grantee.status !== "active") throw new Error("Choose an active Cognitus account.");
  if (granteeUid === report.subjectProfileId) throw new Error("The report subject already has full access.");
  const justification = clean(reason).slice(0, 500);
  if (!justification) throw new Error("Enter an Owner authorization reason.");

  const id = grantId(report.id, granteeUid);
  await Fire.setDoc(Fire.doc(db, "ownerReportAccessGrants", id), {
    id,
    reportId: report.id,
    reportCognitusId: report.cognitusId || "",
    subjectProfileId: report.subjectProfileId,
    granteeUid,
    granteeCognitusId: grantee.cognitusId,
    granteeDisplayName: grantee.displayName || grantee.discordUsername || "Cognitus User",
    granteeOrganizationId: grantee.organizationId || null,
    grantedByUid: authUser.uid,
    grantedByCognitusId: userDoc.cognitusId,
    grantReason: justification,
    createdAt: Fire.serverTimestamp(),
    updatedAt: Fire.serverTimestamp()
  });
  await writeAudit("OWNER_REPORT_ACCESS_GRANTED", report.id, `Owner granted ${grantee.cognitusId || granteeUid} access to ${report.cognitusId || report.id}.`, { granteeUid, grantId: id });
}

async function revokeOwnerGrant(grant) {
  if (!isOwner()) throw new Error("Owner access is required.");
  if (!grant?.id || !grant.reportId) throw new Error("Grant record is unavailable.");
  await Fire.deleteDoc(Fire.doc(db, "ownerReportAccessGrants", grant.id));
  await writeAudit("OWNER_REPORT_ACCESS_REVOKED", grant.reportId, `Owner revoked ${grant.granteeCognitusId || grant.granteeUid} access to ${grant.reportCognitusId || grant.reportId}.`, { granteeUid: grant.granteeUid, grantId: grant.id });
}

function optionLabelForReport(report) {
  return `${report.cognitusId || report.id} · ${report.category || "Report"} · ${humanize(report.status)} · ${report.summary || "No summary"}`.slice(0, 150);
}
function optionLabelForUser(user) {
  return `${user.displayName || user.discordUsername || "Cognitus User"} · ${user.cognitusId || user.id} · ${humanize(user.role)}`;
}

async function mountOwnerPanel() {
  if (route() !== "/reports" || !isOwner() || !root) return;
  const hub = root.querySelector("[data-v8-reports-hub]");
  if (!hub || hub.querySelector("[data-v9-owner-panel]")) return;

  const [reports, users, grants] = await Promise.all([
    readAll("reports").catch(() => []),
    readAll("users").catch(() => []),
    readAll("ownerReportAccessGrants").catch(() => [])
  ]);
  const eligibleReports = reports
    .filter((report) => report.subjectProfileId && ELIGIBLE_STATUSES.has(report.status))
    .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
  const activeUsers = users
    .filter((user) => user.status === "active")
    .sort((a, b) => clean(a.displayName || a.discordUsername).localeCompare(clean(b.displayName || b.discordUsername)));
  const activeGrants = [...grants].sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));

  const panel = document.createElement("section");
  panel.className = "panel v8-section v9-owner-panel";
  panel.dataset.v9OwnerPanel = "true";
  panel.innerHTML = `
    <div class="panel-header">
      <div><p class="eyebrow">Owner Authority</p><h2>Give direct report access</h2></div>
      <span>${activeGrants.length} Owner grant${activeGrants.length === 1 ? "" : "s"}</span>
    </div>
    <div class="v9-owner-warning"><strong>Owner authorization bypasses the normal request/approval workflow.</strong><span>The report subject will be able to see that this access was issued by Cognitus Owner, but only an Owner can revoke it.</span></div>
    <form class="v9-owner-grant-form" data-v9-owner-grant-form>
      <label>Report
        <select name="reportId" required>
          <option value="">Select an eligible person report</option>
          ${eligibleReports.map((report) => `<option value="${escapeHtml(report.id)}">${escapeHtml(optionLabelForReport(report))}</option>`).join("")}
        </select>
      </label>
      <label>Give Access To
        <select name="granteeUid" required>
          <option value="">Select an active Cognitus account</option>
          ${activeUsers.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(optionLabelForUser(user))}</option>`).join("")}
        </select>
      </label>
      <label class="v9-owner-reason">Authorization Reason
        <textarea name="reason" maxlength="500" rows="3" required placeholder="Explain why Cognitus Owner is granting access to this specific report."></textarea>
      </label>
      <div class="v9-owner-form-actions"><button class="button button-dark" type="submit">Grant Report Access</button><span data-v9-owner-message aria-live="polite"></span></div>
    </form>
    <div class="v9-owner-grants">
      <h3>Active Owner-issued grants</h3>
      ${activeGrants.length ? `<div class="v9-owner-grant-list">${activeGrants.map((grant) => `
        <article data-v9-owner-grant="${escapeHtml(grant.id)}">
          <div><strong>${escapeHtml(grant.granteeDisplayName || grant.granteeCognitusId || grant.granteeUid)}</strong><span>${escapeHtml(grant.reportCognitusId || grant.reportId)}</span><small>${escapeHtml(grant.grantReason || "No reason recorded.")} · ${escapeHtml(formatTimestamp(grant.createdAt))}</small></div>
          <button class="button button-danger" type="button" data-v9-revoke="${escapeHtml(grant.id)}">Revoke</button>
        </article>`).join("")}</div>` : `<div class="empty-state"><p>No direct Owner grants are active.</p></div>`}
    </div>`;

  const hero = hub.querySelector(".v8-reports-hero");
  (hero || hub.firstElementChild)?.insertAdjacentElement("afterend", panel);

  panel.querySelector("[data-v9-owner-grant-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const button = form.querySelector('button[type="submit"]');
    const message = form.querySelector("[data-v9-owner-message]");
    button.disabled = true;
    message.textContent = "Granting access…";
    message.className = "";
    try {
      await createOwnerGrant(clean(data.reportId), clean(data.granteeUid), clean(data.reason));
      message.textContent = "Access granted successfully.";
      message.className = "is-success";
      form.reset();
      panel.remove();
      await mountOwnerPanel();
      await mountSubjectVisibility();
    } catch (error) {
      message.textContent = error?.message || "Access could not be granted.";
      message.className = "is-error";
      button.disabled = false;
    }
  });

  panel.querySelectorAll("[data-v9-revoke]").forEach((button) => button.addEventListener("click", async () => {
    const grant = activeGrants.find((item) => item.id === button.dataset.v9Revoke);
    if (!grant) return;
    if (!window.confirm(`Revoke Owner-issued access for ${grant.granteeDisplayName || grant.granteeCognitusId || "this account"}?`)) return;
    button.disabled = true;
    try {
      await revokeOwnerGrant(grant);
      panel.remove();
      await mountOwnerPanel();
      await mountSubjectVisibility();
    } catch (error) {
      window.alert(error?.message || "Owner grant could not be revoked.");
      button.disabled = false;
    }
  }));
}

async function mountRecipientGrants() {
  if (route() !== "/reports" || !authUser || !root) return;
  const hub = root.querySelector("[data-v8-reports-hub]");
  if (!hub || hub.querySelector("[data-v9-recipient-grants]")) return;
  const grants = await readWhere("ownerReportAccessGrants", "granteeUid", "==", authUser.uid).catch(() => []);
  if (!grants.length) return;
  const reportRows = await Promise.all(grants.map((grant) => readDoc("reports", grant.reportId).catch(() => null)));
  const reports = reportRows.filter(Boolean);
  if (!reports.length) return;

  const panel = document.createElement("section");
  panel.className = "panel v8-section v9-recipient-panel";
  panel.dataset.v9RecipientGrants = "true";
  panel.innerHTML = `
    <div class="panel-header"><div><p class="eyebrow">Cognitus Authorization</p><h2>Granted directly by Cognitus Owner</h2></div><span>${reports.length} available</span></div>
    <p class="v8-section-intro">These reports were shared directly with your account by a Cognitus Owner. They do not require a separate request from you.</p>
    <div class="v8-report-grid">${reports.map((report) => {
      const grant = grants.find((item) => item.reportId === report.id);
      return `<article class="v8-report-card"><div class="v8-report-card-head"><div><span>${escapeHtml(report.cognitusId || report.id)}</span><h3>${escapeHtml(report.category || "Full Report")}</h3></div><span class="v9-owner-badge">Owner Granted</span></div><p>${escapeHtml(report.summary || "No summary available.")}</p><small>${escapeHtml(grant?.grantReason || "Authorized by Cognitus Owner")}</small><div class="v8-card-actions"><a class="button button-dark" href="#/reports/view?report=${encodeURIComponent(report.id)}">Open Full Report</a></div></article>`;
    }).join("")}</div>`;

  const requestHistory = [...hub.querySelectorAll(".v8-section")].find((section) => section.querySelector("h2")?.textContent?.trim() === "Your access requests");
  if (requestHistory) requestHistory.insertAdjacentElement("beforebegin", panel);
  else hub.appendChild(panel);
}

async function mountSubjectVisibility() {
  if (!["/reports", "/profile"].includes(route()) || !authUser || !root) return;
  if (root.querySelector("[data-v9-subject-owner-grants]")) return;
  const grants = await readWhere("ownerReportAccessGrants", "subjectProfileId", "==", authUser.uid).catch(() => []);
  if (!grants.length) return;

  const panel = document.createElement("section");
  panel.className = "panel v8-section v9-subject-panel";
  panel.dataset.v9SubjectOwnerGrants = "true";
  panel.innerHTML = `
    <div class="panel-header"><div><p class="eyebrow">Owner-authorized Access</p><h2>Cognitus Owner grants</h2></div><span>${grants.length} active</span></div>
    <p class="v8-section-intro">These permissions were issued directly by a Cognitus Owner. They are visible here for transparency and can only be revoked by an Owner.</p>
    <div class="v9-owner-grant-list">${grants.sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt)).map((grant) => `<article><div><strong>${escapeHtml(grant.granteeDisplayName || grant.granteeCognitusId || grant.granteeUid)}</strong><span>${escapeHtml(grant.reportCognitusId || grant.reportId)}</span><small>${escapeHtml(grant.grantReason || "Owner authorization")} · ${escapeHtml(formatTimestamp(grant.createdAt))}</small></div><span class="v9-owner-badge">Owner Granted</span></article>`).join("")}</div>`;

  if (route() === "/reports") {
    const hub = root.querySelector("[data-v8-reports-hub]");
    const who = root.querySelector("#who-has-access");
    if (who) who.insertAdjacentElement("afterend", panel);
    else hub?.appendChild(panel);
  } else {
    const existing = root.querySelector("[data-v8-profile-access]") || root.querySelector("#profile-reports");
    existing?.insertAdjacentElement("afterend", panel);
  }
}

async function mountFullReportProof() {
  if (route() !== "/reports/view" || !authUser || !root) return;
  const reportId = new URLSearchParams(location.hash.split("?")[1] || "").get("report");
  if (!reportId) return;
  const documentRoot = root.querySelector(`[data-v8-full-report="${CSS.escape(reportId)}"]`);
  if (!documentRoot || documentRoot.querySelector("[data-v9-owner-proof]")) return;
  const grant = await readDoc("ownerReportAccessGrants", grantId(reportId, authUser.uid)).catch(() => null);
  if (!grant) return;
  const article = documentRoot.querySelector(".v8-full-report-document");
  const header = article?.querySelector("header");
  if (!header) return;
  const proof = document.createElement("section");
  proof.className = "v8-access-proof v9-owner-proof";
  proof.dataset.v9OwnerProof = "true";
  proof.innerHTML = `<span>Granted by Cognitus Owner</span><strong>Cognitus Owner directly authorized this account to view the complete report.</strong><small>${escapeHtml(grant.grantReason || "Owner authorization")} · Access remains valid until an Owner revokes it.</small>`;
  header.insertAdjacentElement("afterend", proof);
}

async function enhance() {
  if (!authUser || !userDoc) return;
  await Promise.all([
    mountOwnerPanel(),
    mountRecipientGrants(),
    mountSubjectVisibility(),
    mountFullReportProof()
  ]);
}

function schedule() {
  timers.forEach(clearTimeout);
  timers = [0, 160, 450, 950, 1800].map((delay) => setTimeout(() => enhance().catch((error) => console.warn("Owner Report Grants V9 enhancement failed", error)), delay));
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

initialize().catch((error) => console.warn("Owner Report Grants V9 failed to initialize", error));
