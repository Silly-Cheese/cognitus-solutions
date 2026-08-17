import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userDoc = null;
let timers = [];
let renderKey = "";
let enhanceInFlight = null;
const dossierCache = new Map();
const REVIEWER_ROLES = new Set(["reviewer", "admin", "owner"]);

const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const params = () => new URLSearchParams(location.hash.split("?")[1] || "");
const clean = (value) => String(value ?? "").trim();
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const humanize = (value) => clean(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

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
function formatDateValue(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function statusTone(value) {
  const item = clean(value).toLowerCase().replaceAll("_", " ");
  if (["good", "good standing", "low", "verified", "active", "approved", "claimed", "yes"].includes(item)) return "good";
  if (["watch", "moderate", "pending", "concern", "disputed", "unknown"].includes(item)) return "watch";
  if (["high", "restricted", "no"].includes(item)) return "high";
  if (["critical", "banned", "denied"].includes(item)) return "critical";
  return "neutral";
}
function badge(value, label = null) {
  return `<span class="v15-badge is-${statusTone(value)}">${escapeHtml(label || humanize(value))}</span>`;
}
function arrayText(values, fallback = "None listed") {
  const cleanValues = Array.isArray(values) ? values.map(clean).filter(Boolean) : [];
  return cleanValues.length ? cleanValues.join(", ") : fallback;
}

function mountStyles() {
  let link = document.querySelector("#cognitus-comprehensive-report-v15");
  if (!link) {
    link = document.createElement("link");
    link.id = "cognitus-comprehensive-report-v15";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = "./src/comprehensiveReportV15.css?v=20260816-1";
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

async function loadEmployment(profileId) {
  try {
    const rows = await readWhere("employmentRecords", "profileId", "==", profileId);
    return {
      available: true,
      records: rows.sort((a, b) => clean(b.startedOn).localeCompare(clean(a.startedOn)))
    };
  } catch (error) {
    console.warn("Comprehensive report employment history unavailable", error);
    return { available: false, records: [] };
  }
}

async function loadScreeningRecords(profile) {
  let summaries = [];
  try {
    summaries = await readWhere("screeningReportSummaries", "subjectProfileId", "==", profile.id);
  } catch (error) {
    console.warn("Comprehensive report summaries unavailable", error);
  }
  summaries = summaries
    .filter((item) => ["approved", "published", "disputed"].includes(clean(item.status).toLowerCase()))
    .sort((a, b) => timestampMs(b.reportCreatedAt || b.createdAt) - timestampMs(a.reportCreatedAt || a.createdAt))
    .slice(0, 50);

  const ownsProfile = profile.id === authUser?.uid || profile.linkedUserId === authUser?.uid || profile.claimedByUid === authUser?.uid;
  const canReadProfileReportSet = ownsProfile || REVIEWER_ROLES.has(userDoc?.role);
  if (canReadProfileReportSet) {
    const fullRows = await readWhere("reports", "subjectProfileId", "==", profile.id).catch(() => []);
    const fullMap = new Map(fullRows.map((report) => [report.id, report]));
    return summaries.map((summary) => {
      const report = fullMap.get(summary.reportId || summary.id) || null;
      return { summary, report, fullAccess: Boolean(report) };
    });
  }

  const fullResults = await Promise.all(summaries.map(async (summary) => {
    try {
      const report = await readDoc("reports", summary.reportId || summary.id);
      return { summary, report, fullAccess: Boolean(report) };
    } catch {
      return { summary, report: null, fullAccess: false };
    }
  }));
  return fullResults;
}

function loadDossier(profile) {
  const key = profile.id;
  if (dossierCache.has(key)) return dossierCache.get(key);
  const promise = Promise.all([
    loadEmployment(profile.id),
    loadScreeningRecords(profile)
  ]).then(([employment, reports]) => ({ employment, reports })).catch((error) => {
    dossierCache.delete(key);
    throw error;
  });
  dossierCache.set(key, promise);
  return promise;
}

function employmentSummary(records) {
  const active = records.filter((record) => clean(record.recordStatus).toLowerCase() === "active" || !record.endedOn);
  const ended = records.length - active.length;
  const disputed = records.filter((record) => clean(record.disputeStatus).toLowerCase() !== "none" && clean(record.disputeStatus)).length;
  const organizations = new Set(records.map((record) => clean(record.organizationId || record.organizationName)).filter(Boolean));
  const rehireYes = records.filter((record) => clean(record.eligibleForRehire).toLowerCase() === "yes").length;
  return { active: active.length, ended, disputed, organizations: organizations.size, rehireYes };
}

function profileOverview(profile, employment, reports) {
  const claimed = Boolean(profile.linkedUserId || profile.claimedByUid || clean(profile.identityStatus).toLowerCase() === "claimed");
  const stats = employmentSummary(employment.records);
  const fullNarratives = reports.filter((item) => item.fullAccess).length;
  return `<section class="report-section v15-dossier-overview" data-v15-section="overview">
    <div class="v15-section-heading"><div><p class="eyebrow">Comprehensive Personnel Dossier</p><h2>Executive Record Snapshot</h2></div><span class="v15-scope-chip">Full report scope</span></div>
    <div class="v15-overview-grid">
      <article><span>Professional Standing</span><strong>${badge(profile.professionalStanding || "unreviewed")}</strong><small>Current Cognitus assessment</small></article>
      <article><span>Risk Level</span><strong>${badge(profile.riskLevel || "unreviewed")}</strong><small>Current Cognitus assessment</small></article>
      <article><span>Employment Records</span><strong>${employment.available ? employment.records.length : "—"}</strong><small>${employment.available ? `${stats.active} active · ${stats.ended} ended` : "Not available to this account"}</small></article>
      <article><span>Reviewed Reports</span><strong>${reports.length}</strong><small>${fullNarratives} full narrative${fullNarratives === 1 ? "" : "s"} accessible</small></article>
    </div>
    <div class="v15-index" aria-label="Full report contents"><span>Identity</span><span>Assessment</span><span>Employment</span><span>Reviewed Records</span><span>Timeline</span><span>Data Scope</span></div>
  </section>
  <section class="report-section" data-v15-section="identity"><div class="v15-section-heading"><div><p class="eyebrow">Identity & Provenance</p><h2>Person Record</h2></div>${badge(claimed ? "claimed" : (profile.recordOrigin === "employer_created" ? "employer supplied" : profile.identityStatus || "unreviewed"))}</div>
    <dl class="v15-detail-grid">
      <div><dt>Display Name</dt><dd>${escapeHtml(profile.displayName || "Unnamed")}</dd></div>
      <div><dt>Cognitus Profile ID</dt><dd>${escapeHtml(profile.cognitusId || profile.id)}</dd></div>
      <div><dt>Account Link</dt><dd>${claimed ? "Claimed / linked to a Cognitus account" : "Unclaimed person record"}</dd></div>
      <div><dt>Record Origin</dt><dd>${escapeHtml(humanize(profile.recordOrigin || "account_created"))}</dd></div>
      <div><dt>Identity Status</dt><dd>${escapeHtml(humanize(profile.identityStatus || "unreviewed"))}</dd></div>
      <div><dt>Identity Confidence</dt><dd>${Number(profile.identityConfidence || 0)}%</dd></div>
      <div><dt>Discord Usernames</dt><dd>${escapeHtml(arrayText(profile.discordUsernames))}</dd></div>
      <div><dt>Roblox Usernames</dt><dd>${escapeHtml(arrayText(profile.robloxUsernames))}</dd></div>
      <div class="v15-span-2"><dt>Known Aliases</dt><dd>${escapeHtml(arrayText(profile.knownAliases))}</dd></div>
    </dl>
  </section>`;
}

function employmentCard(record) {
  const dispute = clean(record.disputeStatus).toLowerCase();
  return `<article class="v15-employment-card">
    <div class="v15-card-head"><div><span>${escapeHtml(record.cognitusId || record.id)}</span><h3>${escapeHtml(record.positionTitle || "Employment Record")}</h3><p>${escapeHtml(record.organizationName || "Verified Organization")}</p></div><div class="v15-badge-row">${badge(record.recordStatus || (record.endedOn ? "ended" : "active"))}${dispute && dispute !== "none" ? badge(dispute, `Dispute ${humanize(dispute)}`) : badge("verified", "Verified Employer Record")}</div></div>
    <div class="v15-employment-dates"><strong>${formatDateValue(record.startedOn)} — ${record.endedOn ? formatDateValue(record.endedOn) : "Present"}</strong><span>${escapeHtml(record.employmentType || "Employment")}</span></div>
    <dl class="v15-card-dl"><div><dt>Department</dt><dd>${escapeHtml(record.department || "—")}</dd></div><div><dt>Eligible for Rehire</dt><dd>${escapeHtml(humanize(record.eligibleForRehire || "unknown"))}</dd></div><div class="v15-span-2"><dt>End Reason / Record Note</dt><dd>${escapeHtml(record.endReason || "No end reason recorded.")}</dd></div>${record.disputeNote ? `<div class="v15-span-2"><dt>Cognitus Dispute Note</dt><dd>${escapeHtml(record.disputeNote)}</dd></div>` : ""}</dl>
    <footer>Source: ${escapeHtml(record.organizationName || record.organizationCognitusId || "Verified employer")} · submitted by ${escapeHtml(record.createdByCognitusId || "Cognitus employer")}</footer>
  </article>`;
}

function employmentSection(employment) {
  if (!employment.available) {
    return `<section class="report-section" data-v15-section="employment"><div class="v15-section-heading"><div><p class="eyebrow">Employment</p><h2>Employment History</h2></div></div><div class="notice">Employment history is not available to this account under the current Cognitus access rules.</div></section>`;
  }
  const stats = employmentSummary(employment.records);
  return `<section class="report-section" data-v15-section="employment">
    <div class="v15-section-heading"><div><p class="eyebrow">Verified Employer Records</p><h2>Employment History</h2></div><span>${employment.records.length} record${employment.records.length === 1 ? "" : "s"}</span></div>
    <div class="v15-employment-stats"><div><span>Current</span><strong>${stats.active}</strong></div><div><span>Ended</span><strong>${stats.ended}</strong></div><div><span>Organizations</span><strong>${stats.organizations}</strong></div><div><span>Rehire: Yes</span><strong>${stats.rehireYes}</strong></div><div><span>Disputed</span><strong>${stats.disputed}</strong></div></div>
    ${employment.records.length ? `<div class="v15-employment-list">${employment.records.map(employmentCard).join("")}</div>` : `<div class="notice">No verified employer-submitted employment history is currently on file.</div>`}
  </section>`;
}

function reportDetailCard(item) {
  const { summary, report, fullAccess } = item;
  const appealStatus = report?.appealStatus || "none";
  return `<article class="v15-record-card ${fullAccess ? "has-full-access" : "summary-only"}">
    <div class="v15-card-head"><div><span>${escapeHtml(summary.reportCognitusId || report?.cognitusId || summary.reportId)}</span><h3>${escapeHtml(summary.category || report?.category || "Screening Record")}</h3></div><div class="v15-badge-row">${badge(summary.severity || report?.severity || "Informational")}${appealStatus !== "none" ? badge(appealStatus, `Appeal ${humanize(appealStatus)}`) : ""}</div></div>
    <p class="v15-record-summary">${escapeHtml(summary.summary || report?.summary || "No summary available.")}</p>
    ${fullAccess ? `<div class="v15-full-narrative"><span>Authorized Complete Narrative</span><p>${escapeHtml(report.details || "No additional narrative was provided.")}</p></div><dl class="v15-card-dl"><div><dt>Reviewed</dt><dd>${escapeHtml(formatTimestamp(report.reviewedAt))}</dd></div><div><dt>Status</dt><dd>${escapeHtml(humanize(report.status || summary.status))}</dd></div><div class="v15-span-2"><dt>Reviewer Decision Notes</dt><dd>${escapeHtml(report.decisionNotes || "No reviewer notes recorded.")}</dd></div></dl>` : `<div class="v15-restricted-narrative"><strong>Summary-level access</strong><span>The complete narrative is protected. Use the report access workflow if deeper review is required.</span>${summary.reportId ? `<a href="#/reports/view?report=${encodeURIComponent(summary.reportId)}">Open / Request Full Record →</a>` : ""}</div>`}
  </article>`;
}

function reviewedRecordsSection(reports) {
  const full = reports.filter((item) => item.fullAccess).length;
  const flagged = reports.filter((item) => clean(item.report?.appealStatus).toLowerCase() !== "none" && item.report?.appealStatus).length;
  return `<section class="report-section" data-v15-section="records">
    <div class="v15-section-heading"><div><p class="eyebrow">Conduct & Review</p><h2>Reviewed Record Detail</h2></div><span>${full}/${reports.length} full narratives available</span></div>
    <div class="v15-record-stats"><div><span>Reviewed Records</span><strong>${reports.length}</strong></div><div><span>Full Narrative Access</span><strong>${full}</strong></div><div><span>Appeal / Dispute Flags</span><strong>${flagged}</strong></div></div>
    ${reports.length ? `<div class="v15-record-list">${reports.map(reportDetailCard).join("")}</div>` : `<div class="notice">No reviewed screening records are currently attached to this person.</div>`}
  </section>`;
}

function timelineSection(employment, reports) {
  const events = [];
  if (employment.available) {
    for (const record of employment.records) {
      if (record.startedOn) events.push({ when: new Date(`${record.startedOn}T00:00:00`).getTime(), date: formatDateValue(record.startedOn), type: "Employment Started", title: record.positionTitle || "Employment", detail: record.organizationName || "Organization" });
      if (record.endedOn) events.push({ when: new Date(`${record.endedOn}T00:00:00`).getTime(), date: formatDateValue(record.endedOn), type: "Employment Ended", title: record.positionTitle || "Employment", detail: record.organizationName || "Organization" });
    }
  }
  for (const item of reports) {
    const raw = item.summary.reportCreatedAt || item.report?.createdAt;
    const when = timestampMs(raw);
    if (when) events.push({ when, date: new Date(when).toLocaleDateString(), type: "Reviewed Record", title: item.summary.category || "Screening Report", detail: `${item.summary.severity || "Informational"} · ${item.summary.reportCognitusId || item.summary.reportId}` });
  }
  events.sort((a, b) => b.when - a.when);
  return `<section class="report-section" data-v15-section="timeline"><div class="v15-section-heading"><div><p class="eyebrow">Chronology</p><h2>Record Timeline</h2></div><span>${events.length} event${events.length === 1 ? "" : "s"}</span></div>${events.length ? `<div class="v15-timeline">${events.slice(0, 100).map((event) => `<article><time>${escapeHtml(event.date)}</time><div><span>${escapeHtml(event.type)}</span><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.detail)}</small></div></article>`).join("")}</div>` : `<div class="notice">No dated employment or reviewed-record events are available for the timeline.</div>`}</section>`;
}

function dataScopeSection() {
  return `<section class="report-section v15-data-scope" data-v15-section="scope"><div class="v15-section-heading"><div><p class="eyebrow">Data Integrity</p><h2>What This Full Report Includes</h2></div></div><div class="v15-scope-grid"><article><strong>Included</strong><p>Current Cognitus assessment, identity/provenance, verified employer-submitted employment records, reviewed screening summaries, authorized complete narratives, reviewer notes available to this account, and visible dispute/appeal status.</p></article><article><strong>Intentionally Excluded</strong><p>Private Talent List placement, private employer candidate notes, unrelated organizations' internal hiring discussion, and any full report narrative this account has not been authorized to read.</p></article></div><p class="v15-scope-note">A Cognitus Full Report is a consolidated decision-support record, not an automatic hiring decision. Source attribution, review status, access limitations, and disputes should be considered alongside independent verification.</p></section>`;
}

function insertBeforeDisclaimer(documentNode, html) {
  const wrapper = document.createElement("div");
  wrapper.className = "v15-comprehensive-dossier";
  wrapper.dataset.v15Dossier = "true";
  wrapper.innerHTML = html;
  const disclaimer = [...documentNode.querySelectorAll(".report-section")].find((section) => section.classList.contains("disclaimer"));
  if (disclaimer) documentNode.insertBefore(wrapper, disclaimer);
  else documentNode.appendChild(wrapper);
}

async function enhanceFullScreeningReport() {
  if (route() !== "/reports/full" || !authUser || !root) return false;
  const checkId = params().get("checkId");
  if (!checkId) return false;
  const documentNode = root.querySelector(".report-document");
  if (!documentNode || documentNode.querySelector("[data-v15-dossier]")) return false;
  const check = await readDoc("checkLogs", checkId).catch(() => null);
  if (!check) return false;

  if (!check.targetProfileId) {
    documentNode.classList.add("v15-comprehensive-report");
    const scope = document.createElement("section");
    scope.className = "report-section v15-data-scope";
    scope.dataset.v15Dossier = "true";
    scope.innerHTML = `<div class="v15-section-heading"><div><p class="eyebrow">Comprehensive Scope</p><h2>Organization Full Report</h2></div></div><p>This full report consolidates the logged check, organization identity/trust data, reviewed screening records, and all report narratives this account is authorized to read. Employment-history sections apply only to person records.</p>`;
    const disclaimer = documentNode.querySelector(".disclaimer");
    if (disclaimer) documentNode.insertBefore(scope, disclaimer); else documentNode.appendChild(scope);
    return true;
  }

  const profile = await readDoc("profiles", check.targetProfileId).catch(() => null);
  if (!profile) return false;
  const { employment, reports } = await loadDossier(profile);

  documentNode.classList.add("v15-comprehensive-report");
  const header = documentNode.querySelector(".report-header");
  header?.querySelector("h1")?.replaceChildren(document.createTextNode("Comprehensive Personnel Screening Report"));
  const recommendationCard = documentNode.querySelector(".report-id-card");
  if (recommendationCard && !recommendationCard.querySelector("[data-v15-scope-note]")) {
    const note = document.createElement("small");
    note.dataset.v15ScopeNote = "true";
    note.textContent = `Dossier scope: ${employment.available ? employment.records.length : 0} employment record(s) · ${reports.length} reviewed report(s)`;
    recommendationCard.appendChild(note);
  }

  insertBeforeDisclaimer(documentNode,
    profileOverview(profile, employment, reports)
    + employmentSection(employment)
    + reviewedRecordsSection(reports)
    + timelineSection(employment, reports)
    + dataScopeSection()
  );
  return true;
}

async function enhanceIndividualFullReport() {
  if (route() !== "/reports/view" || !authUser || !root) return false;
  const reportId = params().get("report");
  if (!reportId) return false;
  const documentNode = root.querySelector(".v8-full-report-document");
  if (!documentNode || documentNode.querySelector("[data-v15-individual-context]")) return false;
  const report = await readDoc("reports", reportId).catch(() => null);
  if (!report?.subjectProfileId) return false;
  const profile = await readDoc("profiles", report.subjectProfileId).catch(() => null);
  if (!profile) return false;
  const { employment, reports } = await loadDossier(profile);
  const context = document.createElement("div");
  context.dataset.v15IndividualContext = "true";
  context.className = "v15-individual-context";
  context.innerHTML = `<section><h2>Current Person Context</h2><div class="v15-context-grid"><article><span>Professional Standing</span>${badge(profile.professionalStanding || "unreviewed")}</article><article><span>Risk Level</span>${badge(profile.riskLevel || "unreviewed")}</article><article><span>Identity</span>${badge(profile.identityStatus || "unreviewed")}</article><article><span>Reviewed Records</span><strong>${reports.length}</strong></article></div></section>${employmentSection(employment)}<section><h2>Related Reviewed Record Index</h2>${reports.length ? `<div class="v15-related-index">${reports.map((item) => `<article><div><strong>${escapeHtml(item.summary.category || "Screening Record")}</strong><span>${escapeHtml(item.summary.reportCognitusId || item.summary.reportId)}</span></div>${badge(item.summary.severity || "Informational")}</article>`).join("")}</div>` : `<div class="notice">No additional reviewed records are indexed for this person.</div>`}</section><section class="v15-individual-scope"><h2>Context Scope</h2><p>This complete report record includes surrounding person context available to this account. Private employer candidate notes and unauthorized report narratives are never included.</p></section>`;
  const sections = [...documentNode.querySelectorAll(":scope > section")];
  const subjectSection = sections.find((section) => section.querySelector("h2")?.textContent.trim() === "Subject");
  if (subjectSection) subjectSection.insertAdjacentElement("afterend", context); else documentNode.appendChild(context);
  return true;
}

async function runEnhancement() {
  const current = route();
  const key = `${current}?${params().toString()}`;
  if (key !== renderKey) renderKey = key;
  if (current === "/reports/full") return enhanceFullScreeningReport();
  if (current === "/reports/view") return enhanceIndividualFullReport();
  return false;
}

function runSingleFlight() {
  if (enhanceInFlight) return enhanceInFlight;
  enhanceInFlight = Promise.resolve(runEnhancement()).finally(() => { enhanceInFlight = null; });
  return enhanceInFlight;
}

function schedule() {
  timers.forEach(clearTimeout);
  timers = [80, 420, 1200].map((delay) => setTimeout(() => runSingleFlight().catch((error) => console.warn("Comprehensive Report V15 enhancement failed", error)), delay));
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
    dossierCache.clear();
    schedule();
  });
  window.addEventListener("hashchange", () => {
    dossierCache.clear();
    schedule();
  });
  window.addEventListener("pageshow", schedule);
  window.addEventListener("DOMContentLoaded", schedule);
  schedule();
}

initialize().catch((error) => console.warn("Comprehensive Report V15 failed to initialize", error));
