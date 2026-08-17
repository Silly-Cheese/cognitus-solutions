import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let cache = null;
let cacheAt = 0;
let cachePromise = null;
let timers = [];
let enhanceInFlight = null;

const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const hashParams = () => new URLSearchParams(location.hash.split("?")[1] || "");
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
  return [...items].sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
}
function humanize(value) {
  const text = clean(value || "unreviewed").replaceAll("_", " ");
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function listText(values, fallback = "None listed") {
  const cleaned = (Array.isArray(values) ? values : []).map(clean).filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : fallback;
}
function badge(value, tone = "neutral") {
  return `<span class="v5-badge is-${escapeHtml(tone)}">${escapeHtml(humanize(value))}</span>`;
}
function statusTone(value) {
  const normalized = clean(value).toLowerCase();
  if (["verified", "approved", "published", "active", "good_standing", "low"].includes(normalized)) return "success";
  if (["critical", "high", "denied", "banned", "restricted", "disputed"].includes(normalized)) return "danger";
  if (["pending_review", "under_review", "moderate", "watch", "concern", "unreviewed", "self_declared"].includes(normalized)) return "warning";
  return "neutral";
}

function mountStyles() {
  if (document.querySelector("#cognitus-profile-v5")) return;
  const link = document.createElement("link");
  link.id = "cognitus-profile-v5";
  link.rel = "stylesheet";
  link.href = "./src/profileV5.css?v=20260812-1";
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

function clearCache() {
  cache = null;
  cacheAt = 0;
  cachePromise = null;
}

async function loadOwnProfileData(force = false) {
  if (!authUser) return null;
  if (!force && cache && Date.now() - cacheAt < 8000) return cache;
  if (!force && cachePromise) return cachePromise;
  cachePromise = Promise.all([
    readDoc("users", authUser.uid),
    readDoc("profiles", authUser.uid),
    readWhere("reports", "subjectProfileId", "==", authUser.uid).catch(() => []),
    readWhere("appeals", "submittedByUid", "==", authUser.uid).catch(() => [])
  ]).then(([user, profile, reports, appeals]) => {
    cache = {
      user,
      profile,
      reports: newestFirst(reports),
      appeals: newestFirst(appeals)
    };
    cacheAt = Date.now();
    return cache;
  }).finally(() => { cachePromise = null; });
  return cachePromise;
}

function reportCard(report, appeals) {
  const openAppeal = appeals.find((appeal) => appeal.reportId === report.id && ["pending_review", "under_review"].includes(appeal.status));
  const description = clean(report.summary || report.details || "No report summary available.");
  return `<article class="v5-report-card">
    <div class="v5-report-topline">
      <div>
        <span class="v5-kicker">${escapeHtml(report.cognitusId || "Report")}</span>
        <h3>${escapeHtml(report.category || "Report")}</h3>
      </div>
      <div class="v5-badge-row">${badge(report.severity || "Informational", statusTone(report.severity))}${badge(report.status || "unknown", statusTone(report.status))}</div>
    </div>
    <p>${escapeHtml(description)}</p>
    <div class="v5-report-meta"><span>Created ${escapeHtml(formatTimestamp(report.createdAt))}</span>${report.reviewedAt ? `<span>Reviewed ${escapeHtml(formatTimestamp(report.reviewedAt))}</span>` : ""}</div>
    ${report.decisionNotes ? `<div class="v5-decision"><strong>Review notes</strong><span>${escapeHtml(report.decisionNotes)}</span></div>` : ""}
    <div class="v5-report-actions">
      ${openAppeal ? badge("Appeal pending", "warning") : `<a class="button button-light" href="#/appeals?report=${encodeURIComponent(report.id)}">Appeal this report</a>`}
    </div>
  </article>`;
}

function appealRow(appeal) {
  return `<article class="record-row">
    <div>
      <strong>${escapeHtml(appeal.reason || "Appeal")}</strong>
      <span>${escapeHtml(appeal.reportId || "Report unavailable")}</span>
      <small>${escapeHtml(humanize(appeal.status || "pending_review"))} · ${escapeHtml(formatTimestamp(appeal.createdAt))}</small>
    </div>
  </article>`;
}

async function renderProfilePage() {
  if (route() !== "/profile" || !authUser || !root) return;
  if (root.querySelector("[data-v5-profile-page]")) return;
  const data = await loadOwnProfileData();
  if (!data?.user || !data?.profile) {
    root.innerHTML = `<section class="hero hero-wide" data-v5-profile-page><p class="eyebrow">Profile</p><h1>Your profile is unavailable.</h1><p>Cognitus could not load the profile record attached to this account.</p></section>`;
    return;
  }

  const { user, profile, reports, appeals } = data;
  const verified = Boolean(user.identityVerified && profile.identityStatus === "verified");
  const openAppeals = appeals.filter((appeal) => ["pending_review", "under_review"].includes(appeal.status)).length;
  const reviewedReports = reports.filter((report) => ["approved", "published", "disputed", "denied", "archived"].includes(report.status)).length;
  document.title = `Profile · Cognitus Solutions`;

  root.innerHTML = `
    <section class="v5-profile-hero" data-v5-profile-page>
      <div class="v5-profile-primary">
        <p class="eyebrow">My Profile</p>
        <div class="v5-profile-title-row">
          <div>
            <h1>${escapeHtml(profile.displayName || user.displayName || "Cognitus User")}</h1>
            <p>Your Cognitus record, identity assessment, reports, and correction history in one place.</p>
          </div>
          <div class="v5-badge-row">${badge(verified ? "verified" : (profile.identityStatus || "self_declared"), verified ? "success" : "warning")}${badge(user.status || "unknown", statusTone(user.status))}</div>
        </div>
        <div class="hero-actions">
          <a class="button button-dark" href="#/appeals">Start an Appeal</a>
          <a class="button button-light" href="#/settings">Profile Settings</a>
        </div>
      </div>
      <aside class="v5-profile-id-card">
        <span>Profile Cognitus ID</span>
        <strong>${escapeHtml(profile.cognitusId || "—")}</strong>
        <small>User ID · ${escapeHtml(user.cognitusId || "—")}</small>
        <small>${escapeHtml(humanize(user.role || "user"))} · ${escapeHtml(humanize(user.status || "unknown"))}</small>
      </aside>
    </section>

    <section class="v5-profile-stats">
      <article><span>Professional Standing</span><strong>${escapeHtml(humanize(profile.professionalStanding || "unreviewed"))}</strong></article>
      <article><span>Risk Level</span><strong>${escapeHtml(humanize(profile.riskLevel || "unreviewed"))}</strong></article>
      <article><span>Identity Confidence</span><strong>${Number(profile.identityConfidence || 0)}%</strong></article>
      <article><span>Reports About You</span><strong>${reports.length}</strong><small>${reviewedReports} reviewed</small></article>
      <article><span>Open Appeals</span><strong>${openAppeals}</strong></article>
    </section>

    <section class="v5-profile-grid">
      <article class="panel">
        <p class="eyebrow">Identity</p>
        <h2>Known identity information</h2>
        <dl class="v5-detail-list">
          <div><dt>Discord Username</dt><dd>${escapeHtml(listText(profile.discordUsernames, user.discordUsername || "None listed"))}</dd></div>
          <div><dt>Roblox Username(s)</dt><dd>${escapeHtml(listText(profile.robloxUsernames))}</dd></div>
          <div><dt>Known Aliases</dt><dd>${escapeHtml(listText(profile.knownAliases))}</dd></div>
          <div><dt>Verification</dt><dd>${escapeHtml(humanize(profile.identityStatus || "self_declared"))}</dd></div>
        </dl>
      </article>
      <article class="panel">
        <p class="eyebrow">Assessment</p>
        <h2>Current Cognitus assessment</h2>
        <dl class="v5-detail-list">
          <div><dt>Standing</dt><dd>${escapeHtml(humanize(profile.professionalStanding || "unreviewed"))}</dd></div>
          <div><dt>Risk</dt><dd>${escapeHtml(humanize(profile.riskLevel || "unreviewed"))}</dd></div>
          <div><dt>Reports Recorded</dt><dd>${reports.length}</dd></div>
          <div><dt>Last Profile Review</dt><dd>${escapeHtml(formatTimestamp(profile.lastReviewedAt))}</dd></div>
        </dl>
        <p class="v5-muted">Standing and risk are administrative assessments. Authorized Cognitus reviewers can update them from the portal.</p>
      </article>
    </section>

    <section class="panel v5-profile-section" id="profile-reports">
      <div class="panel-header"><div><p class="eyebrow">Reports</p><h2>Reports about you</h2></div><a class="button button-light" href="#/appeals">Appeals</a></div>
      ${reports.length ? `<div class="v5-report-list">${reports.map((report) => reportCard(report, appeals)).join("")}</div>` : `<div class="empty-state"><h3>No reports about you</h3><p>There are currently no Cognitus reports tied to your profile.</p></div>`}
    </section>

    <section class="panel v5-profile-section">
      <div class="panel-header"><div><p class="eyebrow">Corrections</p><h2>Your appeals</h2></div></div>
      ${appeals.length ? `<div class="record-list">${appeals.map(appealRow).join("")}</div>` : `<div class="empty-state"><p>You have not submitted an appeal.</p></div>`}
    </section>`;
}

function renderSelectedReportPreview(select, reports, preview) {
  const report = reports.find((item) => item.id === select.value);
  if (!report) {
    preview.innerHTML = `<p>Select a report to see its details.</p>`;
    return;
  }
  preview.innerHTML = `
    <div class="v5-appeal-preview-head"><strong>${escapeHtml(report.category || "Report")}</strong><div class="v5-badge-row">${badge(report.severity || "Informational", statusTone(report.severity))}${badge(report.status || "unknown", statusTone(report.status))}</div></div>
    <p>${escapeHtml(report.summary || "No summary available.")}</p>
    <small>${escapeHtml(report.cognitusId || report.id)} · ${escapeHtml(formatTimestamp(report.createdAt))}</small>`;
}

async function enhanceAppealsPage() {
  if (route() !== "/appeals" || !authUser || !root) return;
  const form = root.querySelector("#appeal-form");
  if (!form || form.dataset.profileV5Enhanced) return;
  const data = await loadOwnProfileData();
  if (!data?.profile) return;

  const profileInput = form.querySelector('[name="profileId"]');
  const reportInput = form.querySelector('[name="reportId"]');
  if (!profileInput || !reportInput) return;

  const profileLabel = profileInput.closest("label");
  const reportLabel = reportInput.closest("label");
  if (!profileLabel || !reportLabel) return;

  form.dataset.profileV5Enhanced = "true";
  profileLabel.className = "v5-autofilled-profile";
  profileLabel.innerHTML = `
    <span>Your Profile</span>
    <div class="v5-autofill-box"><strong>${escapeHtml(data.profile.displayName || data.user?.displayName || "Your Cognitus Profile")}</strong><small>${escapeHtml(data.profile.cognitusId || authUser.uid)} · automatically attached to this appeal</small></div>
    <input type="hidden" name="profileId" value="${escapeHtml(authUser.uid)}">`;

  const requestedReport = hashParams().get("report") || "";
  const options = data.reports.map((report) => {
    const label = `${report.category || "Report"} · ${report.severity || "Informational"} · ${humanize(report.status || "unknown")} — ${clean(report.summary || report.cognitusId || report.id).slice(0, 78)}`;
    return `<option value="${escapeHtml(report.id)}"${report.id === requestedReport ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");

  reportLabel.innerHTML = `
    <span>Report Against You</span>
    <select name="reportId" required ${data.reports.length ? "" : "disabled"}>
      ${data.reports.length ? `<option value="">Select a report</option>${options}` : `<option value="">No reports are currently attached to your profile</option>`}
    </select>
    <small class="v5-field-help">Only reports whose subject is your Cognitus profile are shown.</small>`;

  const select = reportLabel.querySelector("select");
  if (requestedReport && data.reports.some((report) => report.id === requestedReport)) select.value = requestedReport;
  const preview = document.createElement("div");
  preview.className = "v5-appeal-preview";
  reportLabel.insertAdjacentElement("afterend", preview);
  renderSelectedReportPreview(select, data.reports, preview);
  select.addEventListener("change", () => renderSelectedReportPreview(select, data.reports, preview));

  const submit = form.querySelector('button[type="submit"]');
  if (!data.reports.length && submit) {
    submit.disabled = true;
    submit.title = "There are no reports against this profile to appeal.";
  }
}

async function enhance() {
  if (!authUser) return;
  try {
    if (route() === "/profile") await renderProfilePage();
    if (route() === "/appeals") await enhanceAppealsPage();
  } catch (error) {
    console.warn("Cognitus Profile V5 enhancement failed", error);
  }
}

function runEnhance() {
  if (enhanceInFlight) return enhanceInFlight;
  enhanceInFlight = Promise.resolve(enhance()).finally(() => { enhanceInFlight = null; });
  return enhanceInFlight;
}

function schedule(force = false) {
  if (force) root?.querySelector("[data-v5-profile-page]")?.removeAttribute("data-v5-profile-page");
  timers.forEach((timer) => clearTimeout(timer));
  timers = [0, 260, 900].map((delay) => setTimeout(runEnhance, delay));
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
  Auth.onAuthStateChanged(auth, (user) => {
    authUser = user;
    clearCache();
    schedule(true);
  });
  window.addEventListener("hashchange", schedule);
  window.addEventListener("pageshow", schedule);
  window.addEventListener("cognitus:profile-updated", () => {
    clearCache();
    schedule(true);
  });
  schedule();
}

initialize().catch((error) => console.warn("Cognitus Profile V5 failed to initialize", error));
