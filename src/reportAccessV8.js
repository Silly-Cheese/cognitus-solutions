import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userDoc = null;
let timers = [];
let routeCache = new Map();
let syncInFlight = null;

const EMPLOYER_ROLES = new Set(["verified_employer_member", "org_admin", "reviewer", "admin", "owner"]);
const REVIEWER_ROLES = new Set(["reviewer", "admin", "owner"]);
const ACCESS_STATES = new Set(["pending", "approved", "denied", "revoked", "cancelled"]);

const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const params = () => new URLSearchParams(location.hash.split("?")[1] || "");
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
function newestFirst(items) {
  return [...items].sort((a, b) => timestampMs(b.createdAt || b.updatedAt) - timestampMs(a.createdAt || a.updatedAt));
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
function isActive() { return userDoc?.status === "active"; }
function isEmployer() { return isActive() && EMPLOYER_ROLES.has(userDoc?.role); }
function isReviewer() { return isActive() && REVIEWER_ROLES.has(userDoc?.role); }
function statusTone(status) {
  const value = clean(status).toLowerCase();
  if (["approved", "active", "verified"].includes(value)) return "success";
  if (["denied", "revoked", "cancelled", "critical", "restricted"].includes(value)) return "danger";
  if (["pending", "pending_review", "under_review", "moderate", "watch"].includes(value)) return "warning";
  return "neutral";
}
function badge(text, tone = "neutral") {
  return `<span class="v8-badge is-${escapeHtml(tone)}">${escapeHtml(humanize(text))}</span>`;
}

function mountStyles() {
  if (document.querySelector("#cognitus-report-access-v8")) return;
  const link = document.createElement("link");
  link.id = "cognitus-report-access-v8";
  link.rel = "stylesheet";
  link.href = "./src/reportAccessV8.css?v=20260812-1";
  document.head.appendChild(link);
}

async function readDoc(collectionName, id) {
  if (!id) return null;
  const snapshot = await Fire.getDoc(Fire.doc(db, collectionName, id));
  return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
}
async function readWhere(collectionName, field, op, value) {
  const snapshot = await Fire.getDocs(Fire.query(Fire.collection(db, collectionName), Fire.where(field, op, value)));
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}
async function readAll(collectionName) {
  const snapshot = await Fire.getDocs(Fire.collection(db, collectionName));
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}
async function readGrant(reportId) {
  return readDoc("reportAccessGrants", reportId).catch(() => null);
}

async function writeAudit(action, targetType, targetId, summary, metadata = {}) {
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
      targetType,
      targetId,
      summary: clean(summary).slice(0, 500),
      metadata,
      createdAt: Fire.serverTimestamp()
    });
  } catch (error) {
    console.warn("Report access audit logging failed", error);
  }
}

function accessRequestId(reportId, uid = authUser?.uid) {
  return `${reportId}__${uid}`;
}

async function getOrganizationName(organizationId) {
  if (!organizationId) return "Independent / no organization assigned";
  const organization = await readDoc("organizations", organizationId).catch(() => null);
  return organization?.name || organization?.cognitusId || organizationId;
}

async function requestReportAccess(summary, reason) {
  if (!isEmployer()) throw new Error("A verified employer/staff account is required to request full report access.");
  if (!summary?.reportId || !summary?.subjectProfileId) throw new Error("This report is not eligible for person-report access requests.");
  const id = accessRequestId(summary.reportId);
  const ref = Fire.doc(db, "reportAccessRequests", id);
  const existing = await readDoc("reportAccessRequests", id).catch(() => null);
  const now = Fire.serverTimestamp();
  if (existing) {
    if (!["denied", "revoked", "cancelled"].includes(existing.status)) {
      throw new Error(existing.status === "approved" ? "You already have access to this report." : "An access request is already pending.");
    }
    await Fire.updateDoc(ref, {
      requestReason: clean(reason).slice(0, 500),
      status: "pending",
      decidedAt: null,
      decidedByUid: null,
      updatedAt: now
    });
  } else {
    await Fire.setDoc(ref, {
      id,
      reportId: summary.reportId,
      reportCognitusId: summary.reportCognitusId || "",
      subjectProfileId: summary.subjectProfileId,
      requesterUid: authUser.uid,
      requesterCognitusId: userDoc.cognitusId,
      requesterDisplayName: userDoc.displayName || userDoc.discordUsername || "Cognitus User",
      requesterOrganizationId: userDoc.organizationId || null,
      requestReason: clean(reason).slice(0, 500),
      status: "pending",
      decidedAt: null,
      decidedByUid: null,
      createdAt: now,
      updatedAt: now
    });
  }
  await writeAudit("REPORT_ACCESS_REQUESTED", "report", summary.reportId, "Requested access to a full report.", { requestId: id });
  routeCache.clear();
}

async function decideAccess(request, action) {
  if (!authUser || request?.subjectProfileId !== authUser.uid) throw new Error("Only the report subject can manage this access request.");
  if (!["approve", "deny", "revoke"].includes(action)) throw new Error("Unknown access decision.");
  const requestRef = Fire.doc(db, "reportAccessRequests", request.id);
  const grantRef = Fire.doc(db, "reportAccessGrants", request.reportId);
  const grant = await readGrant(request.reportId);
  const approved = new Set(Array.isArray(grant?.approvedUids) ? grant.approvedUids : []);
  if (action === "approve") approved.add(request.requesterUid);
  else approved.delete(request.requesterUid);
  if (approved.size > 100) throw new Error("This report has reached the access-grant limit.");

  const batch = Fire.writeBatch(db);
  batch.update(requestRef, {
    status: action === "approve" ? "approved" : action === "deny" ? "denied" : "revoked",
    decidedAt: Fire.serverTimestamp(),
    decidedByUid: authUser.uid,
    updatedAt: Fire.serverTimestamp()
  });
  batch.set(grantRef, {
    reportId: request.reportId,
    subjectProfileId: request.subjectProfileId,
    approvedUids: [...approved],
    updatedAt: Fire.serverTimestamp()
  });
  await batch.commit();
  await writeAudit(`REPORT_ACCESS_${action.toUpperCase()}D`, "report", request.reportId, `${humanize(action)}d full-report access for ${request.requesterDisplayName || request.requesterCognitusId}.`, { requestId: request.id, requesterUid: request.requesterUid });
  routeCache.clear();
}

function showRequestDialog(summary, onComplete) {
  document.querySelector("#v8-report-access-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "v8-report-access-dialog";
  dialog.className = "v8-access-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="v8-dialog-card">
      <div class="v8-dialog-head">
        <div><span>Request Full Report</span><h2>${escapeHtml(summary.category || "Cognitus Report")}</h2></div>
        <button type="button" class="v8-icon-button" data-close aria-label="Close">×</button>
      </div>
      <p>The report subject will see who is asking, your organization assignment, and this reason before deciding whether to grant access.</p>
      <label>Reason for access<textarea name="reason" maxlength="500" rows="5" required placeholder="Example: Candidate is being considered for a management position and this report is relevant to the hiring review."></textarea></label>
      <div class="v8-dialog-actions"><button type="button" class="button button-light" data-close>Cancel</button><button type="submit" class="button button-dark">Send Request</button></div>
      <div class="v8-dialog-message" aria-live="polite"></div>
    </form>`;
  document.body.appendChild(dialog);
  dialog.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const reason = clean(new FormData(event.currentTarget).get("reason"));
    const message = dialog.querySelector(".v8-dialog-message");
    const button = event.currentTarget.querySelector('button[type="submit"]');
    if (!reason) { message.textContent = "Please explain why you need access."; return; }
    button.disabled = true;
    button.textContent = "Sending…";
    try {
      await requestReportAccess(summary, reason);
      message.textContent = "Request sent. The report subject can now approve or deny it.";
      message.classList.add("is-success");
      setTimeout(() => { dialog.close(); onComplete?.(); }, 650);
    } catch (error) {
      message.textContent = error?.message || "Access request could not be sent.";
      message.classList.add("is-error");
      button.disabled = false;
      button.textContent = "Send Request";
    }
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.showModal();
}

async function syncScreeningSummaries() {
  if (!isReviewer() || syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    const [approved, published, existing] = await Promise.all([
      readWhere("reports", "status", "==", "approved").catch(() => []),
      readWhere("reports", "status", "==", "published").catch(() => []),
      readAll("screeningReportSummaries").catch(() => [])
    ]);
    const eligible = [...approved, ...published].filter((report) => ["screening", "public"].includes(report.visibility));
    const eligibleMap = new Map(eligible.map((report) => [report.id, report]));
    const existingMap = new Map(existing.map((summary) => [summary.id, summary]));
    const batch = Fire.writeBatch(db);
    let writes = 0;
    for (const report of eligible.slice(0, 350)) {
      batch.set(Fire.doc(db, "screeningReportSummaries", report.id), {
        id: report.id,
        reportId: report.id,
        reportCognitusId: report.cognitusId || "",
        subjectProfileId: report.subjectProfileId || null,
        subjectOrganizationId: report.subjectOrganizationId || null,
        category: report.category,
        severity: report.severity,
        summary: report.summary,
        status: report.status,
        visibility: report.visibility,
        reportCreatedAt: report.createdAt,
        reviewedAt: report.reviewedAt || null,
        updatedAt: Fire.serverTimestamp()
      });
      writes += 1;
    }
    for (const [id] of existingMap) {
      if (!eligibleMap.has(id) && writes < 450) {
        batch.delete(Fire.doc(db, "screeningReportSummaries", id));
        writes += 1;
      }
    }
    if (writes) await batch.commit();
  })().catch((error) => console.warn("Screening summary synchronization failed", error)).finally(() => { syncInFlight = null; });
  return syncInFlight;
}

async function getSummaryRequests() {
  if (!authUser) return [];
  return readWhere("reportAccessRequests", "requesterUid", "==", authUser.uid).catch(() => []);
}

function screeningAction(summary, request) {
  if (!summary.subjectProfileId) return "";
  if (summary.subjectProfileId === authUser?.uid || isReviewer()) {
    return `<a class="button button-light v8-report-action" href="#/reports/view?report=${encodeURIComponent(summary.reportId)}">View Full Report</a>`;
  }
  if (!isEmployer()) return `<span class="v8-access-note">Full narrative requires employer access.</span>`;
  if (request?.status === "approved") return `<a class="button button-dark v8-report-action" href="#/reports/view?report=${encodeURIComponent(summary.reportId)}">Open Full Report</a>`;
  if (request?.status === "pending") return `<button class="button button-light v8-report-action" type="button" disabled>Access Pending</button>`;
  const label = request && ["denied", "revoked", "cancelled"].includes(request.status) ? "Request Again" : "Request Full Report";
  return `<button class="button button-light v8-report-action" type="button" data-v8-request-report="${escapeHtml(summary.reportId)}">${label}</button>`;
}

async function enhanceScreeningReport() {
  if (!["/reports/quick", "/reports/full"].includes(route()) || !authUser) return;
  const reportDocument = root?.querySelector(".report-document");
  if (!reportDocument || reportDocument.dataset.v8AccessEnhanced) return;
  const checkId = params().get("checkId");
  if (!checkId) return;
  const check = await readDoc("checkLogs", checkId).catch(() => null);
  if (!check) return;
  let summaries = [];
  if (check.targetProfileId) summaries = await readWhere("screeningReportSummaries", "subjectProfileId", "==", check.targetProfileId).catch(() => []);
  else if (check.targetOrganizationId) summaries = await readWhere("screeningReportSummaries", "subjectOrganizationId", "==", check.targetOrganizationId).catch(() => []);
  summaries = newestFirst(summaries);
  const requests = await getSummaryRequests();
  const requestMap = new Map(requests.map((request) => [request.reportId, request]));

  const screeningSection = [...reportDocument.querySelectorAll(".report-section")].find((section) => section.querySelector("h2")?.textContent?.trim() === "Reviewed Screening Records");
  if (screeningSection) {
    const heading = screeningSection.querySelector("h2");
    screeningSection.replaceChildren(heading);
    if (summaries.length) {
      const list = document.createElement("div");
      list.className = "report-records v8-screening-records";
      list.innerHTML = summaries.slice(0, route() === "/reports/full" ? 50 : 5).map((summary) => `
        <article data-v8-summary="${escapeHtml(summary.reportId)}">
          <div class="v8-record-heading"><strong>${escapeHtml(summary.category || "Report")}</strong>${badge(summary.severity || "Informational", statusTone(summary.severity))}</div>
          <p>${escapeHtml(summary.summary || "No summary available.")}</p>
          <div class="v8-record-actions">${screeningAction(summary, requestMap.get(summary.reportId))}</div>
        </article>`).join("");
      screeningSection.appendChild(list);
      list.querySelectorAll("[data-v8-request-report]").forEach((button) => button.addEventListener("click", () => {
        const summary = summaries.find((item) => item.reportId === button.dataset.v8RequestReport);
        if (summary) showRequestDialog(summary, () => { reportDocument.dataset.v8AccessEnhanced = ""; schedule(); });
      }));
    } else {
      const notice = document.createElement("div");
      notice.className = "notice";
      notice.textContent = "No reviewed records are currently visible for screening.";
      screeningSection.appendChild(notice);
    }
  }

  const riskOrder = { Informational: 0, Low: 1, Moderate: 2, High: 3, Critical: 4 };
  const highest = summaries.reduce((best, summary) => (riskOrder[summary.severity] || 0) > (riskOrder[best] || 0) ? summary.severity : best, "Informational");
  const recommendation = !check.targetProfileId && !check.targetOrganizationId
    ? (Number(check.resultCount || 0) > 1 ? "Ambiguous Match — Refine Search" : "No Record Found")
    : (["High", "Critical"].includes(highest) ? "Additional Investigation Recommended" : highest === "Moderate" ? "Review Before Decision" : "Standard Review");
  const recommendationCard = reportDocument.querySelector(".report-id-card");
  if (recommendationCard) recommendationCard.innerHTML = `<span>Recommendation</span><strong>${escapeHtml(recommendation)}</strong><small>Highest reviewed severity: ${escapeHtml(highest)}</small>`;
  reportDocument.dataset.v8AccessEnhanced = "true";
}

async function loadHubData(force = false) {
  if (!authUser) return null;
  const key = `hub:${authUser.uid}`;
  const cached = routeCache.get(key);
  if (!force && cached && Date.now() - cached.at < 7000) return cached.data;
  const [profile, reports, incoming, outgoing] = await Promise.all([
    readDoc("profiles", authUser.uid),
    readWhere("reports", "subjectProfileId", "==", authUser.uid).catch(() => []),
    readWhere("reportAccessRequests", "subjectProfileId", "==", authUser.uid).catch(() => []),
    readWhere("reportAccessRequests", "requesterUid", "==", authUser.uid).catch(() => [])
  ]);
  const data = { profile, reports: newestFirst(reports), incoming: newestFirst(incoming), outgoing: newestFirst(outgoing) };
  routeCache.set(key, { at: Date.now(), data });
  return data;
}

async function requesterContext(request) {
  return {
    organizationName: await getOrganizationName(request.requesterOrganizationId)
  };
}

function ownReportCard(report) {
  return `<article class="v8-report-card">
    <div class="v8-report-card-head"><div><span>${escapeHtml(report.cognitusId || "Report")}</span><h3>${escapeHtml(report.category || "Report")}</h3></div><div class="v8-badge-row">${badge(report.severity || "Informational", statusTone(report.severity))}${badge(report.status || "unknown", statusTone(report.status))}</div></div>
    <p>${escapeHtml(report.summary || "No summary available.")}</p>
    <small>${escapeHtml(formatTimestamp(report.createdAt))}</small>
    <div class="v8-card-actions"><a class="button button-dark" href="#/reports/view?report=${encodeURIComponent(report.id)}">View Full Report</a>${report.subjectProfileId === authUser?.uid ? `<a class="button button-light" href="#/appeals?report=${encodeURIComponent(report.id)}">Appeal</a>` : ""}</div>
  </article>`;
}

async function incomingRequestCard(request) {
  const context = await requesterContext(request);
  const allowedApprove = request.status === "pending";
  const allowedRevoke = request.status === "approved";
  return `<article class="v8-access-card" data-v8-request="${escapeHtml(request.id)}">
    <div class="v8-access-card-head"><div><span>${escapeHtml(request.requesterCognitusId || "Requester")}</span><h3>${escapeHtml(request.requesterDisplayName || "Cognitus User")}</h3></div>${badge(request.status, statusTone(request.status))}</div>
    <dl><div><dt>Organization</dt><dd>${escapeHtml(context.organizationName)}</dd></div><div><dt>Report</dt><dd>${escapeHtml(request.reportCognitusId || request.reportId)}</dd></div><div><dt>Reason</dt><dd>${escapeHtml(request.requestReason || "No reason supplied.")}</dd></div><div><dt>Requested</dt><dd>${escapeHtml(formatTimestamp(request.createdAt))}</dd></div></dl>
    <div class="v8-card-actions">
      ${allowedApprove ? `<button class="button button-dark" type="button" data-v8-access-action="approve" data-request-id="${escapeHtml(request.id)}">Approve Access</button><button class="button button-light" type="button" data-v8-access-action="deny" data-request-id="${escapeHtml(request.id)}">Deny</button>` : ""}
      ${allowedRevoke ? `<button class="button button-danger" type="button" data-v8-access-action="revoke" data-request-id="${escapeHtml(request.id)}">Revoke Access</button>` : ""}
    </div>
  </article>`;
}

async function renderReportsHub() {
  if (route() !== "/reports" || !authUser || !root) return;
  if (root.querySelector("[data-v8-reports-hub]")) return;
  const data = await loadHubData();
  if (!data?.profile) return;
  document.title = "Reports & Access · Cognitus Solutions";
  const incomingCards = await Promise.all(data.incoming.map(incomingRequestCard));
  const pendingIncoming = data.incoming.filter((request) => request.status === "pending").length;
  const activeGrants = data.incoming.filter((request) => request.status === "approved").length;
  const grantedToMe = data.outgoing.filter((request) => request.status === "approved");

  root.innerHTML = `<main data-v8-reports-hub>
    <section class="v8-reports-hero">
      <div><p class="eyebrow">Reports & Access</p><h1>Your report control center.</h1><p>Read complete reports about you, decide who may open them, and access reports another person has explicitly shared with you.</p></div>
      <aside><span>Profile</span><strong>${escapeHtml(data.profile.cognitusId || authUser.uid)}</strong><small>${escapeHtml(data.profile.displayName || userDoc.displayName || "Cognitus User")}</small></aside>
    </section>
    <section class="v8-access-stats"><article><span>Reports About You</span><strong>${data.reports.length}</strong></article><article><span>Pending Requests</span><strong>${pendingIncoming}</strong></article><article><span>Active Grants</span><strong>${activeGrants}</strong></article><article><span>Shared With You</span><strong>${grantedToMe.length}</strong></article></section>

    <section class="panel v8-section"><div class="panel-header"><div><p class="eyebrow">My Record</p><h2>Full reports about you</h2></div><span>You always have full access</span></div>
      ${data.reports.length ? `<div class="v8-report-grid">${data.reports.map(ownReportCard).join("")}</div>` : `<div class="empty-state"><h3>No reports about you</h3><p>No Cognitus reports are currently tied to your profile.</p></div>`}
    </section>

    <section class="panel v8-section" id="who-has-access"><div class="panel-header"><div><p class="eyebrow">Privacy & Sharing</p><h2>Who has access</h2></div><span>${activeGrants} active grant${activeGrants === 1 ? "" : "s"}</span></div>
      <p class="v8-section-intro">Employers must request access to a specific full report. You decide each request and can revoke an approved grant later.</p>
      ${data.incoming.length ? `<div class="v8-access-list">${incomingCards.join("")}</div>` : `<div class="empty-state"><p>No one has requested access to your full reports yet.</p></div>`}
    </section>

    <section class="panel v8-section"><div class="panel-header"><div><p class="eyebrow">Employer Access</p><h2>Reports shared with you</h2></div><span>${grantedToMe.length} available</span></div>
      ${grantedToMe.length ? `<div class="v8-report-grid">${grantedToMe.map((request) => `<article class="v8-report-card"><div class="v8-report-card-head"><div><span>${escapeHtml(request.reportCognitusId || "Report")}</span><h3>Granted Full Report</h3></div>${badge("approved", "success")}</div><p>${escapeHtml(request.requestReason || "Access granted by the report subject.")}</p><div class="v8-card-actions"><a class="button button-dark" href="#/reports/view?report=${encodeURIComponent(request.reportId)}">Open Full Report</a></div></article>`).join("")}</div>` : `<div class="empty-state"><p>No full reports have been shared with this account.</p></div>`}
    </section>

    <section class="panel v8-section"><div class="panel-header"><div><p class="eyebrow">Requests</p><h2>Your access requests</h2></div></div>
      ${data.outgoing.length ? `<div class="v8-request-history">${data.outgoing.map((request) => `<article><div><strong>${escapeHtml(request.reportCognitusId || request.reportId)}</strong><span>${escapeHtml(request.requestReason || "")}</span></div>${badge(request.status, statusTone(request.status))}</article>`).join("")}</div>` : `<div class="empty-state"><p>You have not requested access to another person's full report.</p></div>`}
    </section>
  </main>`;

  root.querySelectorAll("[data-v8-access-action]").forEach((button) => button.addEventListener("click", async () => {
    const request = data.incoming.find((item) => item.id === button.dataset.requestId);
    if (!request) return;
    const action = button.dataset.v8AccessAction;
    const confirmation = action === "approve" ? `Allow ${request.requesterDisplayName || "this requester"} to open the complete report?` : action === "revoke" ? `Revoke ${request.requesterDisplayName || "this requester"}'s access to the complete report?` : `Deny this access request?`;
    if (!window.confirm(confirmation)) return;
    button.disabled = true;
    try {
      await decideAccess(request, action);
      root.querySelector("[data-v8-reports-hub]")?.remove();
      await renderReportsHub();
    } catch (error) {
      window.alert(error?.message || "Access decision failed.");
      button.disabled = false;
    }
  }));
}

async function renderFullReportPage() {
  if (route() !== "/reports/view" || !authUser || !root) return;
  const reportId = params().get("report");
  if (!reportId) return;
  if (root.querySelector(`[data-v8-full-report="${CSS.escape(reportId)}"]`)) return;
  let report = null;
  try {
    report = await readDoc("reports", reportId);
  } catch (error) {
    report = null;
  }
  document.title = "Full Report · Cognitus Solutions";
  if (!report) {
    const request = await readDoc("reportAccessRequests", accessRequestId(reportId)).catch(() => null);
    root.innerHTML = `<section class="hero hero-wide"><p class="eyebrow">Full Report</p><h1>Access is required.</h1><p>${request?.status === "pending" ? "Your request is still waiting for the report subject's decision." : request?.status === "denied" ? "Your request was denied by the report subject." : request?.status === "revoked" ? "Your previous access was revoked by the report subject." : "This account does not currently have permission to read the complete report."}</p><div class="hero-actions"><a class="button button-dark" href="#/reports">Reports & Access</a></div></section>`;
    return;
  }
  const subject = report.subjectProfileId ? await readDoc("profiles", report.subjectProfileId).catch(() => null) : report.subjectOrganizationId ? await readDoc("organizations", report.subjectOrganizationId).catch(() => null) : null;
  const isSubject = report.subjectProfileId === authUser.uid;
  const request = report.subjectProfileId ? await readDoc("reportAccessRequests", accessRequestId(reportId)).catch(() => null) : null;
  root.innerHTML = `<main class="v8-full-report" data-v8-full-report="${escapeHtml(reportId)}">
    <section class="report-toolbar no-print"><a class="button button-light" href="#/reports">Back to Reports</a>${isSubject ? `<a class="button button-light" href="#/appeals?report=${encodeURIComponent(report.id)}">Appeal This Report</a>` : ""}<button class="button button-dark" type="button" data-v8-print>Print / Save PDF</button></section>
    <article class="v8-full-report-document">
      <header><div><p class="eyebrow">Cognitus Solutions</p><h1>Complete Report Record</h1><p>${escapeHtml(report.cognitusId || report.id)}</p></div><div class="v8-full-status">${badge(report.status || "unknown", statusTone(report.status))}${badge(report.severity || "Informational", statusTone(report.severity))}</div></header>
      ${request?.status === "approved" && !isSubject ? `<section class="v8-access-proof"><span>Access Granted</span><strong>This full report was explicitly shared with your account by the report subject.</strong><small>Access remains valid until the subject revokes it.</small></section>` : ""}
      <section><h2>Subject</h2><dl class="v8-report-dl"><div><dt>Name</dt><dd>${escapeHtml(subject?.displayName || subject?.name || "Unknown")}</dd></div><div><dt>Cognitus ID</dt><dd>${escapeHtml(subject?.cognitusId || report.subjectProfileId || report.subjectOrganizationId || "—")}</dd></div></dl></section>
      <section><h2>Report Classification</h2><dl class="v8-report-dl"><div><dt>Category</dt><dd>${escapeHtml(report.category || "—")}</dd></div><div><dt>Severity</dt><dd>${escapeHtml(report.severity || "—")}</dd></div><div><dt>Status</dt><dd>${escapeHtml(humanize(report.status))}</dd></div><div><dt>Visibility</dt><dd>${escapeHtml(humanize(report.visibility))}</dd></div></dl></section>
      <section><h2>Summary</h2><p class="v8-report-summary">${escapeHtml(report.summary || "No summary available.")}</p></section>
      <section><h2>Complete Narrative</h2><div class="v8-full-narrative">${escapeHtml(report.details || "No additional narrative was provided.")}</div></section>
      <section><h2>Review Information</h2><dl class="v8-report-dl"><div><dt>Submitted By</dt><dd>${escapeHtml(report.submittedByCognitusId || report.submittedByUid || "—")}</dd></div><div><dt>Created</dt><dd>${escapeHtml(formatTimestamp(report.createdAt))}</dd></div><div><dt>Reviewed</dt><dd>${escapeHtml(formatTimestamp(report.reviewedAt))}</dd></div><div><dt>Decision Notes</dt><dd>${escapeHtml(report.decisionNotes || "No reviewer notes recorded.")}</dd></div><div><dt>Appeal Status</dt><dd>${escapeHtml(humanize(report.appealStatus || "none"))}</dd></div></dl></section>
      <section class="v8-report-disclaimer"><h2>Decision-support record</h2><p>This is the complete Cognitus record for this report. It should be considered with context, source reliability, appeal history, and independent review rather than used as an automatic employment verdict.</p></section>
    </article>
  </main>`;
  root.querySelector("[data-v8-print]")?.addEventListener("click", () => window.print());
}

async function enhanceProfile() {
  if (route() !== "/profile" || !authUser || !root) return;
  const profileReports = root.querySelector("#profile-reports");
  if (!profileReports || profileReports.dataset.v8AccessEnhanced) return;
  const [reports, requests] = await Promise.all([
    readWhere("reports", "subjectProfileId", "==", authUser.uid).catch(() => []),
    readWhere("reportAccessRequests", "subjectProfileId", "==", authUser.uid).catch(() => [])
  ]);
  const reportByCognitus = new Map(reports.map((report) => [clean(report.cognitusId), report]));
  profileReports.querySelectorAll(".v5-report-card").forEach((card) => {
    const key = clean(card.querySelector(".v5-kicker")?.textContent);
    const report = reportByCognitus.get(key);
    if (!report) return;
    const actions = card.querySelector(".v5-report-actions");
    if (actions && !actions.querySelector("[data-v8-full-link]")) {
      const link = document.createElement("a");
      link.className = "button button-dark";
      link.dataset.v8FullLink = "true";
      link.href = `#/reports/view?report=${encodeURIComponent(report.id)}`;
      link.textContent = "Open Full Report";
      actions.prepend(link);
    }
    if (!card.querySelector("[data-v8-inline-full]")) {
      const details = document.createElement("details");
      details.className = "v8-inline-full";
      details.dataset.v8InlineFull = "true";
      details.innerHTML = `<summary>Read complete report on this profile</summary><div><strong>Complete narrative</strong><p>${escapeHtml(report.details || "No additional narrative was provided.")}</p>${report.decisionNotes ? `<strong>Reviewer decision notes</strong><p>${escapeHtml(report.decisionNotes)}</p>` : ""}</div>`;
      card.appendChild(details);
    }
  });
  const pending = requests.filter((request) => request.status === "pending");
  const approved = requests.filter((request) => request.status === "approved");
  const accessPanel = document.createElement("section");
  accessPanel.className = "panel v5-profile-section v8-profile-access-panel";
  accessPanel.dataset.v8ProfileAccess = "true";
  accessPanel.innerHTML = `<div class="panel-header"><div><p class="eyebrow">Report Privacy</p><h2>Who has access</h2></div><a class="button button-dark" href="#/reports#who-has-access">Manage Access</a></div><div class="v8-profile-access-stats"><div><span>Pending requests</span><strong>${pending.length}</strong></div><div><span>Active grants</span><strong>${approved.length}</strong></div></div><p>You can read every complete report about yourself. Employers must request access to a specific full report, and you can approve, deny, or revoke that access from Reports & Access.</p>`;
  profileReports.insertAdjacentElement("afterend", accessPanel);
  profileReports.dataset.v8AccessEnhanced = "true";
}

function scheduleSummarySyncAfterReview(event) {
  const button = event.target.closest("[data-review-action]");
  if (!button || !["report", "appeal"].includes(button.dataset.kind)) return;
  [500, 1300, 2800].forEach((delay) => setTimeout(() => syncScreeningSummaries(), delay));
}

async function enhance() {
  if (!authUser || !userDoc) return;
  try {
    if (isReviewer()) syncScreeningSummaries();
    await Promise.all([
      enhanceScreeningReport(),
      enhanceProfile(),
      renderReportsHub(),
      renderFullReportPage()
    ]);
  } catch (error) {
    console.warn("Report Access V8 enhancement failed", error);
  }
}

function schedule() {
  timers.forEach(clearTimeout);
  timers = [0, 140, 420, 900, 1700].map((delay) => setTimeout(enhance, delay));
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
    routeCache.clear();
    schedule();
  });
  document.addEventListener("click", scheduleSummarySyncAfterReview);
  window.addEventListener("hashchange", () => { routeCache.clear(); schedule(); });
  window.addEventListener("DOMContentLoaded", schedule);
  window.addEventListener("pageshow", schedule);
  schedule();
}

initialize().catch((error) => console.warn("Report Access V8 failed to initialize", error));
