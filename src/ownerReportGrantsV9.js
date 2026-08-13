import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userDoc = null;
let timers = [];
let legacyMigrationAttempted = false;

const ELIGIBLE_STATUSES = new Set(["approved", "published", "disputed"]);
const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const clean = (value) => String(value ?? "").trim();
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const ownerMarker = (uid) => `owner:${uid}`;
const ownerGrantId = (reportId, uid) => `${reportId}__${uid}`;

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
function isOwner() { return userDoc?.status === "active" && userDoc?.role === "owner"; }

function mountStyles() {
  if (document.querySelector("#cognitus-owner-report-grants-v9")) return;
  const link = document.createElement("link");
  link.id = "cognitus-owner-report-grants-v9";
  link.rel = "stylesheet";
  link.href = "./src/ownerReportGrantsV9.css?v=20260812-3";
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
  const grantId = ownerGrantId(reportId, granteeUid);
  const [report, grantee, existing] = await Promise.all([
    readDoc("reports", reportId),
    readDoc("users", granteeUid),
    readDoc("ownerReportAccessGrants", grantId).catch(() => null)
  ]);
  if (!report?.subjectProfileId) throw new Error("Owner direct grants apply only to reports about people.");
  if (!ELIGIBLE_STATUSES.has(report.status)) throw new Error("Only approved, published, or disputed reports can be directly shared.");
  if (!grantee || grantee.status !== "active") throw new Error("Choose an active Cognitus account.");
  if (granteeUid === report.subjectProfileId) throw new Error("The report subject already has full access.");
  const justification = clean(reason).slice(0, 500);
  if (!justification) throw new Error("Enter an Owner authorization reason.");

  const ref = Fire.doc(db, "ownerReportAccessGrants", grantId);
  if (existing) {
    await Fire.updateDoc(ref, {
      status: "active",
      reason: justification,
      grantedByUid: authUser.uid,
      grantedByCognitusId: userDoc.cognitusId,
      updatedAt: Fire.serverTimestamp()
    });
  } else {
    await Fire.setDoc(ref, {
      id: grantId,
      reportId: report.id,
      subjectProfileId: report.subjectProfileId,
      granteeUid,
      grantedByUid: authUser.uid,
      grantedByCognitusId: userDoc.cognitusId,
      reason: justification,
      status: "active",
      createdAt: Fire.serverTimestamp(),
      updatedAt: Fire.serverTimestamp()
    });
  }
  await writeAudit("OWNER_REPORT_ACCESS_GRANTED", report.id, `Owner granted ${grantee.cognitusId || granteeUid} direct access to ${report.cognitusId || report.id}. Reason: ${justification}`, { granteeUid, grantSource: "owner_direct" });
}

async function revokeOwnerGrant(reportId, granteeUid) {
  if (!isOwner()) throw new Error("Owner access is required.");
  const grantId = ownerGrantId(reportId, granteeUid);
  const grant = await readDoc("ownerReportAccessGrants", grantId);
  if (!grant || grant.status !== "active") throw new Error("The Owner grant is no longer active.");
  await Fire.updateDoc(Fire.doc(db, "ownerReportAccessGrants", grantId), {
    status: "revoked",
    grantedByUid: authUser.uid,
    grantedByCognitusId: userDoc.cognitusId,
    updatedAt: Fire.serverTimestamp()
  });
  await writeAudit("OWNER_REPORT_ACCESS_REVOKED", reportId, `Owner revoked direct access for ${granteeUid}.`, { granteeUid, grantSource: "owner_direct" });
}

function legacyOwnerUids(grant) {
  const values = Array.isArray(grant?.approvedUids) ? grant.approvedUids : [];
  return values
    .filter((value) => typeof value === "string" && value.startsWith("owner:"))
    .map((value) => value.slice(6))
    .filter(Boolean);
}

async function migrateLegacyOwnerGrants(reports, users) {
  if (!isOwner() || legacyMigrationAttempted) return 0;
  legacyMigrationAttempted = true;
  const legacy = await readAll("reportAccessGrants").catch(() => []);
  const reportsById = new Map(reports.map((report) => [report.id, report]));
  const usersById = new Map(users.map((user) => [user.id, user]));
  let migrated = 0;

  for (const grant of legacy) {
    const reportId = grant.reportId || grant.id;
    const report = reportsById.get(reportId);
    if (!report?.subjectProfileId) continue;
    for (const uid of legacyOwnerUids(grant)) {
      const grantee = usersById.get(uid);
      if (!grantee || grantee.status !== "active") continue;
      const id = ownerGrantId(reportId, uid);
      const existing = await readDoc("ownerReportAccessGrants", id).catch(() => null);
      if (existing) continue;
      await Fire.setDoc(Fire.doc(db, "ownerReportAccessGrants", id), {
        id,
        reportId,
        subjectProfileId: report.subjectProfileId,
        granteeUid: uid,
        grantedByUid: authUser.uid,
        grantedByCognitusId: userDoc.cognitusId,
        reason: "Migrated from the legacy Cognitus Owner authorization record.",
        status: "active",
        createdAt: Fire.serverTimestamp(),
        updatedAt: Fire.serverTimestamp()
      });
      migrated += 1;
    }
  }
  return migrated;
}

async function ownerGrantRows(grants, users, reports) {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const reportsById = new Map(reports.map((report) => [report.id, report]));
  return grants
    .filter((grant) => grant.status === "active")
    .map((grant) => ({ grant, uid: grant.granteeUid, user: usersById.get(grant.granteeUid), report: reportsById.get(grant.reportId) }))
    .sort((a, b) => timestampMs(b.grant?.updatedAt) - timestampMs(a.grant?.updatedAt));
}
function reportOption(report) { return `${report.cognitusId || report.id} · ${report.category || "Report"} · ${humanize(report.status)} · ${report.summary || "No summary"}`.slice(0, 150); }
function userOption(user) { return `${user.displayName || user.discordUsername || "Cognitus User"} · ${user.cognitusId || user.id} · ${humanize(user.role)}`; }

async function mountOwnerPanel() {
  if (route() !== "/reports" || !isOwner() || !root) return;
  const hub = root.querySelector("[data-v8-reports-hub]");
  if (!hub || hub.querySelector("[data-v9-owner-panel]")) return;

  const [reports, users] = await Promise.all([
    readAll("reports").catch(() => []),
    readAll("users").catch(() => [])
  ]);
  const migrated = await migrateLegacyOwnerGrants(reports, users);
  const grants = await readAll("ownerReportAccessGrants").catch(() => []);
  const eligibleReports = reports.filter((report) => report.subjectProfileId && ELIGIBLE_STATUSES.has(report.status)).sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
  const activeUsers = users.filter((user) => user.status === "active").sort((a, b) => clean(a.displayName || a.discordUsername).localeCompare(clean(b.displayName || b.discordUsername)));
  const rows = await ownerGrantRows(grants, users, reports);

  const panel = document.createElement("section");
  panel.className = "panel v8-section v9-owner-panel";
  panel.dataset.v9OwnerPanel = "true";
  panel.innerHTML = `
    <div class="panel-header"><div><p class="eyebrow">Owner Authority</p><h2>Give direct report access</h2></div><span>${rows.length} Owner grant${rows.length === 1 ? "" : "s"}</span></div>
    <div class="v9-owner-warning"><strong>Owner authorization is independent and takes precedence over the subject's request decision.</strong><span>The report subject can see that direct access exists, but only an Owner can revoke an Owner-issued grant.</span></div>
    ${migrated ? `<div class="notice notice-success">Migrated ${migrated} legacy Owner authorization${migrated === 1 ? "" : "s"} into the protected Owner-grant system.</div>` : ""}
    <form class="v9-owner-grant-form" data-v9-owner-grant-form>
      <label>Report<select name="reportId" required><option value="">Select an eligible person report</option>${eligibleReports.map((report) => `<option value="${escapeHtml(report.id)}">${escapeHtml(reportOption(report))}</option>`).join("")}</select></label>
      <label>Give Access To<select name="granteeUid" required><option value="">Select an active Cognitus account</option>${activeUsers.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(userOption(user))}</option>`).join("")}</select></label>
      <label class="v9-owner-reason">Authorization Reason<textarea name="reason" maxlength="500" rows="3" required placeholder="Explain why Cognitus Owner is granting access to this specific report."></textarea></label>
      <div class="v9-owner-form-actions"><button class="button button-dark" type="submit">Grant Report Access</button><span data-v9-owner-message aria-live="polite"></span></div>
    </form>
    <div class="v9-owner-grants"><h3>Active Owner-issued grants</h3>${rows.length ? `<div class="v9-owner-grant-list">${rows.map((row) => `<article><div><strong>${escapeHtml(row.user?.displayName || row.user?.cognitusId || row.uid)}</strong><span>${escapeHtml(row.report?.cognitusId || row.grant.reportId)}</span><small>Direct Owner authorization · last changed ${escapeHtml(formatTimestamp(row.grant.updatedAt))}</small></div><button class="button button-danger" type="button" data-v9-revoke-report="${escapeHtml(row.grant.reportId)}" data-v9-revoke-user="${escapeHtml(row.uid)}">Revoke</button></article>`).join("")}</div>` : `<div class="empty-state"><p>No direct Owner grants are active.</p></div>`}</div>`;
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
      message.textContent = "Owner access granted successfully.";
      message.className = "is-success";
      setTimeout(() => { panel.remove(); schedule(); }, 350);
    } catch (error) {
      message.textContent = error?.message || "Access could not be granted.";
      message.className = "is-error";
      button.disabled = false;
    }
  });
  panel.querySelectorAll("[data-v9-revoke-report]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm("Revoke this Owner-issued report permission? The subject's separate approval, if any, will remain unchanged.")) return;
    button.disabled = true;
    try { await revokeOwnerGrant(button.dataset.v9RevokeReport, button.dataset.v9RevokeUser); panel.remove(); schedule(); }
    catch (error) { window.alert(error?.message || "Owner grant could not be revoked."); button.disabled = false; }
  }));
}

async function mountRecipientGrants() {
  if (route() !== "/reports" || !authUser || !root) return;
  const hub = root.querySelector("[data-v8-reports-hub]");
  if (!hub || hub.querySelector("[data-v9-recipient-grants]")) return;
  const grants = await readWhere("ownerReportAccessGrants", "granteeUid", "==", authUser.uid).catch(() => []);
  const direct = grants.filter((grant) => grant.status === "active");
  if (!direct.length) return;
  const reports = (await Promise.all(direct.map((grant) => readDoc("reports", grant.reportId).catch(() => null)))).filter(Boolean);
  if (!reports.length) return;
  const panel = document.createElement("section");
  panel.className = "panel v8-section v9-recipient-panel";
  panel.dataset.v9RecipientGrants = "true";
  panel.innerHTML = `<div class="panel-header"><div><p class="eyebrow">Cognitus Authorization</p><h2>Granted directly by Cognitus Owner</h2></div><span>${reports.length} available</span></div><p class="v8-section-intro">These full reports were authorized directly for your account by a Cognitus Owner. The report subject's separate request choice cannot revoke this Owner authorization.</p><div class="v8-report-grid">${reports.map((report) => `<article class="v8-report-card"><div class="v8-report-card-head"><div><span>${escapeHtml(report.cognitusId || report.id)}</span><h3>${escapeHtml(report.category || "Full Report")}</h3></div><span class="v9-owner-badge">Owner Granted</span></div><p>${escapeHtml(report.summary || "No summary available.")}</p><div class="v8-card-actions"><a class="button button-dark" href="#/reports/view?report=${encodeURIComponent(report.id)}">Open Full Report</a></div></article>`).join("")}</div>`;
  const history = [...hub.querySelectorAll(".v8-section")].find((section) => section.querySelector("h2")?.textContent?.trim() === "Your access requests");
  if (history) history.insertAdjacentElement("beforebegin", panel); else hub.appendChild(panel);
}

async function mountSubjectVisibility() {
  if (!["/reports", "/profile"].includes(route()) || !authUser || !root) return;
  if (root.querySelector("[data-v9-subject-owner-grants]")) return;
  const grants = await readWhere("ownerReportAccessGrants", "subjectProfileId", "==", authUser.uid).catch(() => []);
  const directRows = grants.filter((grant) => grant.status === "active");
  if (!directRows.length) return;
  const users = await Promise.all([...new Set(directRows.map((grant) => grant.granteeUid))].map((uid) => readDoc("users", uid).catch(() => null)));
  const usersById = new Map(users.filter(Boolean).map((user) => [user.id, user]));
  const panel = document.createElement("section");
  panel.className = "panel v8-section v9-subject-panel";
  panel.dataset.v9SubjectOwnerGrants = "true";
  panel.innerHTML = `<div class="panel-header"><div><p class="eyebrow">Owner-authorized Access</p><h2>Cognitus Owner grants</h2></div><span>${directRows.length} active</span></div><p class="v8-section-intro">These permissions were issued directly by a Cognitus Owner. They are shown for transparency, but the report subject cannot revoke an Owner-issued authorization.</p><div class="v9-owner-grant-list">${directRows.map((grant) => { const user = usersById.get(grant.granteeUid); return `<article><div><strong>${escapeHtml(user?.displayName || user?.cognitusId || grant.granteeUid)}</strong><span>${escapeHtml(grant.reportId)}</span><small>Direct Cognitus Owner authorization · ${escapeHtml(formatTimestamp(grant.updatedAt))}</small></div><span class="v9-owner-badge">Owner Granted</span></article>`; }).join("")}</div>`;
  if (route() === "/reports") {
    const who = root.querySelector("#who-has-access");
    if (who) who.insertAdjacentElement("afterend", panel); else root.querySelector("[data-v8-reports-hub]")?.appendChild(panel);
  } else {
    const access = root.querySelector("[data-v8-profile-access]") || root.querySelector("#profile-reports");
    access?.insertAdjacentElement("afterend", panel);
  }
}

async function mountFullReportProof() {
  if (route() !== "/reports/view" || !authUser || !root) return;
  const reportId = new URLSearchParams(location.hash.split("?")[1] || "").get("report");
  if (!reportId) return;
  const documentRoot = root.querySelector(`[data-v8-full-report="${CSS.escape(reportId)}"]`);
  if (!documentRoot || documentRoot.querySelector("[data-v9-owner-proof]")) return;
  const grant = await readDoc("ownerReportAccessGrants", ownerGrantId(reportId, authUser.uid)).catch(() => null);
  if (!grant || grant.status !== "active") return;
  const header = documentRoot.querySelector(".v8-full-report-document header");
  if (!header) return;
  const proof = document.createElement("section");
  proof.className = "v8-access-proof v9-owner-proof";
  proof.dataset.v9OwnerProof = "true";
  proof.innerHTML = `<span>Granted by Cognitus Owner</span><strong>Cognitus Owner directly authorized this account to view the complete report.</strong><small>This permission is independent of the report subject's separate access-request decision and remains valid until an Owner revokes it.</small>`;
  header.insertAdjacentElement("afterend", proof);
}

async function enhance() {
  if (!authUser || !userDoc) return;
  await Promise.all([mountOwnerPanel(), mountRecipientGrants(), mountSubjectVisibility(), mountFullReportProof()]);
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
  [Auth, Fire] = await Promise.all([import(`${FIREBASE_CDN_BASE}/firebase-auth.js`), import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`)]);
  Auth.onAuthStateChanged(auth, async (user) => {
    authUser = user;
    userDoc = user ? await readDoc("users", user.uid).catch(() => null) : null;
    legacyMigrationAttempted = false;
    schedule();
  });
  window.addEventListener("hashchange", schedule);
  window.addEventListener("pageshow", schedule);
  window.addEventListener("DOMContentLoaded", schedule);
  schedule();
}
initialize().catch((error) => console.warn("Owner Report Grants V9 failed to initialize", error));
