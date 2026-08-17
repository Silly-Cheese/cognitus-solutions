import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
const nav = document.querySelector(".topnav");
let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userDoc = null;
let timers = [];
let peopleSearchResults = [];
let currentEmploymentRecords = new Map();

const EMPLOYER_ROLES = new Set(["verified_employer_member", "org_admin", "reviewer", "admin", "owner"]);
const REVIEWER_ROLES = new Set(["reviewer", "admin", "owner"]);
const PIPELINE = ["considering", "interview", "shortlist", "offer", "hired", "passed", "do_not_reconsider", "archived"];
const EMPLOYMENT_TYPES = ["Staff", "Leadership", "Management", "Contract", "Volunteer", "Internship", "Other"];
const REHIRE = ["yes", "no", "unknown"];

const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const params = () => new URLSearchParams(location.hash.split("?")[1] || "");
const clean = (value) => String(value ?? "").trim();
const lower = (value) => clean(value).toLowerCase();
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
  return `${prefix}-${String(new Date().getFullYear()).slice(-2)}-${Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("")}`;
}
function active() { return userDoc?.status === "active"; }
function employerRole() { return active() && EMPLOYER_ROLES.has(userDoc?.role); }
function reviewerRole() { return active() && REVIEWER_ROLES.has(userDoc?.role); }
function orgAdmin() { return active() && ["org_admin", "admin", "owner"].includes(userDoc?.role); }
function statusTone(value) {
  const status = lower(value);
  if (["good_standing", "low", "verified", "approved", "active", "hired", "yes", "accepted"].includes(status)) return "success";
  if (["critical", "restricted", "high", "denied", "no", "do_not_reconsider"].includes(status)) return "danger";
  if (["watch", "moderate", "concern", "pending", "pending_review", "disputed", "interview", "shortlist", "offer"].includes(status)) return "warning";
  return "neutral";
}
function badge(value, tone = statusTone(value)) {
  return `<span class="emp11-badge is-${escapeHtml(tone)}">${escapeHtml(humanize(value))}</span>`;
}
function dateRange(record) {
  const start = clean(record.startedOn) || "Start unknown";
  const end = clean(record.endedOn) || "Present";
  return `${start} — ${end}`;
}
function identityLine(profile) {
  const discord = (profile.discordUsernames || []).filter(Boolean).join(", ");
  const roblox = (profile.robloxUsernames || []).filter(Boolean).join(", ");
  return [discord && `Discord: ${discord}`, roblox && `Roblox: ${roblox}`].filter(Boolean).join(" · ") || "No usernames listed";
}
function routeKey() { return `${route()}?${params().toString()}`; }

function mountStyles() {
  if (document.querySelector("#cognitus-employer-workspace-v11")) return;
  const link = document.createElement("link");
  link.id = "cognitus-employer-workspace-v11";
  link.rel = "stylesheet";
  link.href = "./src/employerWorkspaceV11.css?v=20260816-1";
  document.head.appendChild(link);
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
async function audit(action, targetType, targetId, summary, metadata = {}) {
  if (!authUser || !userDoc || !active()) return;
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
      targetId: targetId || null,
      summary: clean(summary).slice(0, 500),
      metadata,
      createdAt: Fire.serverTimestamp()
    });
  } catch (error) {
    console.warn("Employer workspace audit failed", error);
  }
}

function injectEmployerNav() {
  if (!nav || !authUser || !userDoc) return;
  const eligible = employerRole();
  let link = nav.querySelector("[data-emp11-nav]");
  if (!eligible) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement("a");
    link.href = "#/employer";
    link.dataset.emp11Nav = "true";
    link.textContent = "Employer Hub";
    link.title = "Open your employer workspace";
  }
  const organizations = nav.querySelector('a[href="#/organizations"]');
  const more = nav.querySelector(".nav6-more");
  if (organizations) organizations.insertAdjacentElement("afterend", link);
  else if (more) nav.insertBefore(link, more);
  else nav.appendChild(link);
  const isActive = route().startsWith("/employer") && route() !== "/employer-status";
  link.classList.toggle("v4-active", isActive);
  if (isActive) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
}

function workspaceTabs(tab) {
  const items = [
    ["overview", "Overview"],
    ["talent", "Talent List"],
    ["people", "People"],
    ["employment", "Employment Records"],
    ["access", "Report Access"]
  ];
  return `<nav class="emp11-tabs" aria-label="Employer workspace">${items.map(([id, label]) => `<a href="#/employer?tab=${id}" class="${tab === id ? "is-active" : ""}">${label}</a>`).join("")}</nav>`;
}

function noEmployerAccess() {
  return `<section class="emp11-gate" data-emp11-page data-emp11-key="${escapeHtml(routeKey())}">
    <div class="emp11-gate-icon">CS</div>
    <p class="eyebrow">Employer Workspace</p>
    <h1>Employer access is required.</h1>
    <p>This workspace is available after Cognitus approves your organization-linked Employer Status request.</p>
    <div class="emp11-actions"><a class="button button-dark" href="#/employer-status">Request Employer Status</a><a class="button button-light" href="#/dashboard">Dashboard</a></div>
  </section>`;
}

function noOrganization() {
  return `<section class="emp11-gate" data-emp11-page data-emp11-key="${escapeHtml(routeKey())}">
    <div class="emp11-gate-icon">ORG</div>
    <p class="eyebrow">Employer Workspace</p>
    <h1>No organization is attached to this account.</h1>
    <p>Your role can access Cognitus staff tools, but the employer Talent Workspace requires an organization assignment. Reviewer queues are still available below when applicable.</p>
    <div class="emp11-actions"><a class="button button-light" href="#/admin">Administration</a></div>
  </section>`;
}

function profileMiniCard(profile, bookmark = null) {
  return `<article class="emp11-person-card">
    <div class="emp11-person-head"><div><span>${escapeHtml(profile.cognitusId || profile.id)}</span><h3>${escapeHtml(profile.displayName || "Unnamed Person")}</h3></div>${badge(profile.linkedUserId ? "Account Linked" : (profile.recordOrigin === "employer_created" ? "Employer Supplied" : profile.identityStatus || "Unclaimed"), profile.linkedUserId ? "success" : "neutral")}</div>
    <p>${escapeHtml(identityLine(profile))}</p>
    <div class="emp11-chip-row">${badge(profile.professionalStanding || "unreviewed")}${badge(profile.riskLevel || "unreviewed")}${bookmark ? badge(bookmark.pipelineStatus || "considering") : ""}</div>
    <div class="emp11-actions"><a class="button button-dark" href="#/employer/candidate?profile=${encodeURIComponent(profile.id)}">Open Candidate File</a></div>
  </article>`;
}

async function loadOrganizationContext() {
  if (!userDoc?.organizationId) return null;
  return readDoc("organizations", userDoc.organizationId).catch(() => null);
}

async function overviewPanel(org) {
  const [bookmarks, records, checks, requests] = await Promise.all([
    readWhere("employerCandidates", "organizationId", "==", org.id).catch(() => []),
    readWhere("employmentRecords", "organizationId", "==", org.id).catch(() => []),
    readWhere("checkLogs", "organizationId", "==", org.id).catch(() => []),
    readWhere("reportAccessRequests", "requesterUid", "==", authUser.uid).catch(() => [])
  ]);
  const sortedBookmarks = [...bookmarks].sort((a, b) => timestampMs(b.updatedAt || b.createdAt) - timestampMs(a.updatedAt || a.createdAt));
  const recentChecks = [...checks].sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt)).slice(0, 8);
  const pendingAccess = requests.filter((item) => item.status === "pending").length;
  const hired = bookmarks.filter((item) => item.pipelineStatus === "hired").length;
  const recentProfiles = (await Promise.all(sortedBookmarks.slice(0, 6).map((item) => readDoc("profiles", item.profileId).catch(() => null)))).filter(Boolean);
  return `<section class="emp11-overview-grid">
    <article class="emp11-stat"><span>Saved Candidates</span><strong>${bookmarks.length}</strong><small>${hired} marked hired</small></article>
    <article class="emp11-stat"><span>Employment Records</span><strong>${records.length}</strong><small>submitted by ${escapeHtml(org.name || "your organization")}</small></article>
    <article class="emp11-stat"><span>Logged Checks</span><strong>${checks.length}</strong><small>organization activity</small></article>
    <article class="emp11-stat"><span>Pending Report Access</span><strong>${pendingAccess}</strong><small>your requests awaiting a decision</small></article>
  </section>
  <section class="panel emp11-section"><div class="panel-header"><div><p class="eyebrow">Talent</p><h2>Recently saved people</h2></div><a class="button button-light" href="#/employer?tab=talent">View Talent List</a></div>
    ${recentProfiles.length ? `<div class="emp11-person-grid">${recentProfiles.map((profile) => profileMiniCard(profile, sortedBookmarks.find((item) => item.profileId === profile.id))).join("")}</div>` : `<div class="empty-state"><h3>Your talent list is empty.</h3><p>Search Cognitus or create an unclaimed Person Record to begin building a candidate pipeline.</p><a class="button button-dark" href="#/employer?tab=people">Find People</a></div>`}
  </section>
  <section class="panel emp11-section"><div class="panel-header"><div><p class="eyebrow">Organization Activity</p><h2>Recent checks</h2></div><a class="button button-light" href="#/history">Full History</a></div>
    ${recentChecks.length ? `<div class="emp11-activity-list">${recentChecks.map((check) => `<article><div><strong>${escapeHtml(check.searchQuery || "Screening check")}</strong><span>${escapeHtml(check.reason || "No reason recorded")}</span></div><small>${escapeHtml(formatTimestamp(check.createdAt))} · ${escapeHtml(check.cognitusId || check.id)}</small></article>`).join("")}</div>` : `<div class="empty-state"><p>No organization checks have been logged yet.</p></div>`}
  </section>`;
}

async function talentPanel(org) {
  const bookmarks = (await readWhere("employerCandidates", "organizationId", "==", org.id).catch(() => []))
    .sort((a, b) => timestampMs(b.updatedAt || b.createdAt) - timestampMs(a.updatedAt || a.createdAt));
  const profiles = (await Promise.all(bookmarks.map((item) => readDoc("profiles", item.profileId).catch(() => null)))).filter(Boolean);
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return `<section class="panel emp11-section"><div class="panel-header"><div><p class="eyebrow">Talent List</p><h2>Potential hires & tracked people</h2></div><a class="button button-dark" href="#/employer?tab=people">Add Person</a></div>
    <p class="emp11-intro">This list is private to ${escapeHtml(org.name)}. Pipeline status and private notes are not published to a person's Cognitus profile.</p>
    ${bookmarks.length ? `<div class="emp11-pipeline-list">${bookmarks.map((bookmark) => { const profile = byId.get(bookmark.profileId); return `<article class="emp11-pipeline-card"><div><span>${escapeHtml(profile?.cognitusId || bookmark.profileCognitusId || bookmark.profileId)}</span><h3>${escapeHtml(profile?.displayName || bookmark.profileDisplayName || "Person")}</h3><p>${escapeHtml(profile ? identityLine(profile) : "Profile unavailable")}</p></div><div class="emp11-pipeline-side">${badge(bookmark.pipelineStatus || "considering")}<a class="button button-light" href="#/employer/candidate?profile=${encodeURIComponent(bookmark.profileId)}">Open File</a></div></article>`; }).join("")}</div>` : `<div class="empty-state"><h3>No saved candidates.</h3><p>Bookmark people from search results or create a Person Record for someone not yet registered with Cognitus.</p><a class="button button-dark" href="#/employer?tab=people">Find People</a></div>`}
  </section>`;
}

function searchResultsHtml() {
  if (!peopleSearchResults.length) return `<div class="empty-state emp11-search-empty"><p>Search by a Cognitus profile ID, Discord ID, Discord username, Roblox username, or exact display name.</p></div>`;
  return `<div class="emp11-person-grid">${peopleSearchResults.map((profile) => profileMiniCard(profile)).join("")}</div>`;
}

function peoplePanel(org) {
  return `<div class="emp11-two-column">
    <section class="panel emp11-section"><div class="panel-header"><div><p class="eyebrow">People</p><h2>Find an existing person</h2></div></div>
      <form class="emp11-search-form" data-emp11-search-form>
        <label>Search by<select name="field"><option value="cognitusId">Profile Cognitus ID</option><option value="discordId">Discord ID</option><option value="discordUsername">Discord Username</option><option value="robloxUsername">Roblox Username</option><option value="displayName">Exact Display Name</option></select></label>
        <label>Search value<input name="query" required maxlength="100" placeholder="Enter an exact identifier" /></label>
        <button class="button button-dark" type="submit">Search People</button>
      </form>
      <div data-emp11-search-results>${searchResultsHtml()}</div>
    </section>
    <section class="panel emp11-section emp11-create-person"><div class="panel-header"><div><p class="eyebrow">No Account Required</p><h2>Create a Person Record</h2></div>${badge("Employer Supplied", "neutral")}</div>
      <p class="emp11-intro">Use this when the person does not already exist in Cognitus. This creates an unclaimed record with clear employer provenance; it does not create a login account.</p>
      <form class="emp11-form" data-emp11-create-person>
        <label>Display name<input name="displayName" maxlength="64" required placeholder="Name used in your hiring records" /></label>
        <div class="emp11-form-grid"><label>Discord username<input name="discordUsername" maxlength="64" placeholder="Optional" /></label><label>Discord ID<input name="discordId" inputmode="numeric" maxlength="25" placeholder="Optional" /></label></div>
        <label>Roblox username(s)<input name="robloxUsernames" maxlength="220" placeholder="Comma separated, if known" /></label>
        <label>Known alias(es)<input name="aliases" maxlength="220" placeholder="Comma separated, optional" /></label>
        <small>Provide at least one Discord or Roblox identifier. Cognitus will check for obvious existing matches before creating the record.</small>
        <div class="emp11-submit-row"><button class="button button-dark" type="submit">Create Person Record</button><span data-emp11-create-message aria-live="polite"></span></div>
      </form>
    </section>
  </div>`;
}

async function employmentPanel(org) {
  const records = (await readWhere("employmentRecords", "organizationId", "==", org.id).catch(() => []))
    .sort((a, b) => timestampMs(b.updatedAt || b.createdAt) - timestampMs(a.updatedAt || a.createdAt));
  currentEmploymentRecords = new Map(records.map((record) => [record.id, record]));
  return `<section class="panel emp11-section"><div class="panel-header"><div><p class="eyebrow">Employment Records</p><h2>Records submitted by ${escapeHtml(org.name)}</h2></div><a class="button button-dark" href="#/employer?tab=people">Find / Create Person</a></div>
    <p class="emp11-intro">Employment records are attributable records shared with the person and eligible employers. Private hiring impressions belong in the candidate file instead.</p>
    ${records.length ? `<div class="emp11-employment-list">${records.map((record) => employmentRecordCard(record, true)).join("")}</div>` : `<div class="empty-state"><p>No employment records have been submitted by this organization.</p></div>`}
  </section>`;
}

async function accessPanel() {
  const requests = (await readWhere("reportAccessRequests", "requesterUid", "==", authUser.uid).catch(() => []))
    .sort((a, b) => timestampMs(b.updatedAt || b.createdAt) - timestampMs(a.updatedAt || a.createdAt));
  return `<section class="panel emp11-section"><div class="panel-header"><div><p class="eyebrow">Report Access</p><h2>Your full-report requests</h2></div><a class="button button-light" href="#/reports">Reports & Access</a></div>
    ${requests.length ? `<div class="emp11-access-list">${requests.map((request) => `<article><div><span>${escapeHtml(request.reportCognitusId || request.reportId)}</span><strong>${escapeHtml(request.requestReason || "Full-report access request")}</strong><small>${escapeHtml(formatTimestamp(request.updatedAt || request.createdAt))}</small></div>${badge(request.status || "pending")}</article>`).join("")}</div>` : `<div class="empty-state"><h3>No access requests yet.</h3><p>Open a candidate file to review screening summaries and request the full report when deeper vetting is justified.</p></div>`}
  </section>`;
}

function employmentRecordCard(record, employerView = false) {
  const canEdit = employerView && (record.createdByUid === authUser?.uid || orgAdmin() || reviewerRole());
  return `<article class="emp11-employment-card" data-record-id="${escapeHtml(record.id)}">
    <div class="emp11-employment-top"><div><span>${escapeHtml(record.cognitusId || record.id)}</span><h3>${escapeHtml(record.positionTitle || "Employment Record")}</h3><p>${escapeHtml(record.organizationName || "Organization")} · ${escapeHtml(dateRange(record))}</p></div><div class="emp11-chip-row">${badge(record.recordStatus || "active")}${record.disputeStatus && record.disputeStatus !== "none" ? badge(`Dispute ${record.disputeStatus}`) : badge("Verified Employer Record", "success")}</div></div>
    <dl class="emp11-record-details"><div><dt>Department</dt><dd>${escapeHtml(record.department || "—")}</dd></div><div><dt>Type</dt><dd>${escapeHtml(record.employmentType || "—")}</dd></div><div><dt>End reason</dt><dd>${escapeHtml(record.endReason || "—")}</dd></div><div><dt>Eligible for rehire</dt><dd>${escapeHtml(humanize(record.eligibleForRehire || "unknown"))}</dd></div></dl>
    <div class="emp11-provenance"><strong>Verified Employer Record</strong><span>Submitted by ${escapeHtml(record.organizationName || "a verified organization")} · ${escapeHtml(record.createdByCognitusId || "Cognitus employer")}</span></div>
    ${record.disputeNote ? `<div class="emp11-dispute-note"><strong>Cognitus dispute note</strong><p>${escapeHtml(record.disputeNote)}</p></div>` : ""}
    ${canEdit ? `<div class="emp11-actions"><button class="button button-light" type="button" data-emp11-edit-record="${escapeHtml(record.id)}">Edit Record</button>${(orgAdmin() || userDoc?.role === "owner") ? `<button class="button button-danger" type="button" data-emp11-delete-record="${escapeHtml(record.id)}">Delete</button>` : ""}</div>` : ""}
  </article>`;
}

function employmentForm(profile, org) {
  return `<section class="panel emp11-section"><div class="panel-header"><div><p class="eyebrow">Employer Record</p><h2>Add employment history</h2></div>${badge("Shared Record", "success")}</div>
    <form class="emp11-form" data-emp11-employment-form>
      <input type="hidden" name="recordId" value="" />
      <input type="hidden" name="profileId" value="${escapeHtml(profile.id)}" />
      <div class="emp11-form-grid"><label>Position / title<input name="positionTitle" maxlength="120" required placeholder="Example: Senior Moderator" /></label><label>Department<input name="department" maxlength="100" placeholder="Example: Human Resources" /></label></div>
      <div class="emp11-form-grid"><label>Employment type<select name="employmentType">${EMPLOYMENT_TYPES.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></label><label>Eligible for rehire<select name="eligibleForRehire">${REHIRE.map((item) => `<option value="${item}">${humanize(item)}</option>`).join("")}</select></label></div>
      <div class="emp11-form-grid"><label>Started<input type="date" name="startedOn" required /></label><label>Ended<input type="date" name="endedOn" /></label></div>
      <label>End reason / factual record note<input name="endReason" maxlength="300" placeholder="Optional; keep this factual" /></label>
      <p class="emp11-form-note">This record will be attributed to <strong>${escapeHtml(org.name)}</strong> and visible in the person's Cognitus employment history. Use the private Candidate Notes area for internal opinions or hiring discussion.</p>
      <div class="emp11-submit-row"><button class="button button-dark" type="submit">Add Employment Record</button><button class="button button-light" type="button" data-emp11-cancel-edit hidden>Cancel Edit</button><span data-emp11-employment-message aria-live="polite"></span></div>
    </form>
  </section>`;
}

async function renderCandidateFile(org, profileId) {
  const profile = await readDoc("profiles", profileId).catch(() => null);
  if (!profile) {
    root.innerHTML = `<section class="emp11-gate" data-emp11-page data-emp11-key="${escapeHtml(routeKey())}"><p class="eyebrow">Candidate File</p><h1>Person record not found.</h1><a class="button button-dark" href="#/employer?tab=people">Back to People</a></section>`;
    return;
  }
  const bookmarkId = `${org.id}__${profile.id}`;
  const [bookmark, employment, summaries, myRequests] = await Promise.all([
    readDoc("employerCandidates", bookmarkId).catch(() => null),
    readWhere("employmentRecords", "profileId", "==", profile.id).catch(() => []),
    readWhere("screeningReportSummaries", "subjectProfileId", "==", profile.id).catch(() => []),
    readWhere("reportAccessRequests", "requesterUid", "==", authUser.uid).catch(() => [])
  ]);
  const requestsByReport = new Map(myRequests.map((item) => [item.reportId, item]));
  const sortedEmployment = [...employment].sort((a, b) => clean(b.startedOn).localeCompare(clean(a.startedOn)));
  currentEmploymentRecords = new Map(sortedEmployment.map((record) => [record.id, record]));
  document.title = `${profile.displayName || "Candidate"} · Employer Hub · Cognitus Solutions`;
  root.innerHTML = `<main class="emp11-shell" data-emp11-page data-emp11-key="${escapeHtml(routeKey())}">
    <section class="emp11-candidate-hero">
      <div><p class="eyebrow">Candidate File</p><div class="emp11-title-row"><div><h1>${escapeHtml(profile.displayName || "Unnamed Person")}</h1><p>${escapeHtml(identityLine(profile))}</p></div><div class="emp11-chip-row">${badge(profile.professionalStanding || "unreviewed")}${badge(profile.riskLevel || "unreviewed")}${badge(profile.linkedUserId ? "Account Linked" : "Unclaimed")}</div></div><div class="emp11-actions"><a class="button button-light" href="#/employer?tab=talent">Talent List</a><a class="button button-light" href="#/search">Run New Check</a></div></div>
      <aside><span>Profile ID</span><strong>${escapeHtml(profile.cognitusId || profile.id)}</strong><small>${escapeHtml(profile.recordOrigin === "employer_created" ? `Employer supplied by ${profile.createdByOrganizationId || "organization"}` : humanize(profile.identityStatus || "self_declared"))}</small></aside>
    </section>
    <section class="emp11-candidate-grid">
      <article class="panel emp11-candidate-control"><div class="panel-header"><div><p class="eyebrow">Private Workspace</p><h2>${bookmark ? "Talent tracking" : "Save this person"}</h2></div>${bookmark ? badge(bookmark.pipelineStatus || "considering") : ""}</div>
        ${bookmark ? `<form class="emp11-form" data-emp11-bookmark-form><label>Pipeline status<select name="pipelineStatus">${PIPELINE.map((item) => `<option value="${item}" ${bookmark.pipelineStatus === item ? "selected" : ""}>${humanize(item)}</option>`).join("")}</select></label><label>Private organization notes<textarea name="privateNotes" rows="6" maxlength="3000" placeholder="Only ${escapeHtml(org.name)} can see these notes.">${escapeHtml(bookmark.privateNotes || "")}</textarea></label><div class="emp11-submit-row"><button class="button button-dark" type="submit">Save Candidate File</button><button class="button button-danger" type="button" data-emp11-remove-candidate>Remove from Talent List</button><span data-emp11-bookmark-message></span></div></form>` : `<p>This profile is not on ${escapeHtml(org.name)}'s private Talent List.</p><button class="button button-dark" type="button" data-emp11-save-candidate>☆ Save to Talent List</button>`}
      </article>
      <article class="panel"><p class="eyebrow">Assessment</p><h2>Current Cognitus assessment</h2><dl class="emp11-assessment"><div><dt>Standing</dt><dd>${badge(profile.professionalStanding || "unreviewed")}</dd></div><div><dt>Risk</dt><dd>${badge(profile.riskLevel || "unreviewed")}</dd></div><div><dt>Identity</dt><dd>${badge(profile.identityStatus || "unreviewed")}</dd></div><div><dt>Confidence</dt><dd>${Number(profile.identityConfidence || 0)}%</dd></div></dl><p class="emp11-intro">Employer records and private notes do not directly change Cognitus Standing or Risk.</p></article>
    </section>
    <section class="panel emp11-section"><div class="panel-header"><div><p class="eyebrow">Reports</p><h2>Screening summaries</h2></div><a class="button button-light" href="#/reports">Reports & Access</a></div>
      ${summaries.length ? `<div class="emp11-report-grid">${summaries.sort((a,b)=>timestampMs(b.reportCreatedAt)-timestampMs(a.reportCreatedAt)).map((summary) => reportSummaryCard(summary, requestsByReport.get(summary.reportId))).join("")}</div>` : `<div class="empty-state"><p>No reviewed screening reports are available for this profile.</p></div>`}
    </section>
    <section class="panel emp11-section"><div class="panel-header"><div><p class="eyebrow">Employment</p><h2>Employment history</h2></div><span>${sortedEmployment.length} record${sortedEmployment.length === 1 ? "" : "s"}</span></div>
      ${sortedEmployment.length ? `<div class="emp11-employment-list">${sortedEmployment.map((record) => employmentRecordCard(record, record.organizationId === org.id)).join("")}</div>` : `<div class="empty-state"><p>No employer-submitted employment history is on file yet.</p></div>`}
    </section>
    ${employmentForm(profile, org)}
  </main>`;
  bindCandidateEvents(profile, org, bookmark, bookmarkId);
}

function reportSummaryCard(summary, request) {
  const approved = request?.status === "approved";
  return `<article class="emp11-report-card"><div class="emp11-report-head"><div><span>${escapeHtml(summary.reportCognitusId || summary.reportId)}</span><h3>${escapeHtml(summary.category || "Screening Report")}</h3></div>${badge(summary.severity || "Informational")}</div><p>${escapeHtml(summary.summary || "No summary available.")}</p><div class="emp11-chip-row">${badge(summary.status || "approved")}${request ? badge(`Access ${request.status}`) : ""}</div><div class="emp11-actions">${approved ? `<a class="button button-dark" href="#/reports/view?report=${encodeURIComponent(summary.reportId)}">Open Full Report</a>` : request?.status === "pending" ? `<span class="emp11-muted">Full-report request pending.</span>` : `<details class="emp11-request-details"><summary class="button button-light">Request Full Report</summary><form data-emp11-report-request="${escapeHtml(summary.reportId)}"><textarea name="reason" maxlength="500" rows="4" required placeholder="Explain why deeper access is needed for this hiring or organizational review."></textarea><button class="button button-dark" type="submit">Send Request</button><span data-request-message></span></form></details>`}</div></article>`;
}

async function requestFullReport(summary, reason) {
  if (!employerRole()) throw new Error("Employer access is required.");
  const id = `${summary.reportId}__${authUser.uid}`;
  const ref = Fire.doc(db, "reportAccessRequests", id);
  const existing = await readDoc("reportAccessRequests", id).catch(() => null);
  const payload = {
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
    updatedAt: Fire.serverTimestamp()
  };
  if (existing && ["denied", "revoked", "cancelled"].includes(existing.status)) {
    await Fire.updateDoc(ref, { requestReason: payload.requestReason, status: "pending", decidedAt: null, decidedByUid: null, updatedAt: payload.updatedAt });
  } else if (existing) {
    throw new Error(existing.status === "approved" ? "You already have access to this report." : "A request is already pending.");
  } else {
    await Fire.setDoc(ref, { ...payload, createdAt: Fire.serverTimestamp() });
  }
  await audit("REPORT_ACCESS_REQUESTED_FROM_CANDIDATE", "report", summary.reportId, "Requested full-report access from Employer Candidate File.", { profileId: summary.subjectProfileId });
}

async function searchProfiles(field, query) {
  const value = clean(query);
  if (!value) return [];
  if (field === "discordId") return readWhere("profiles", "discordIds", "array-contains", value.replace(/\D/g, ""));
  if (field === "discordUsername") return readWhere("profiles", "discordUsernamesNormalized", "array-contains", lower(value));
  if (field === "robloxUsername") return readWhere("profiles", "robloxUsernamesNormalized", "array-contains", lower(value));
  if (field === "displayName") return readWhere("profiles", "displayName", "==", value);
  return readWhere("profiles", "cognitusId", "==", value.toUpperCase());
}

async function obviousProfileMatches(discordId, discordUsername, robloxUsernames) {
  const tasks = [];
  if (discordId) tasks.push(readWhere("profiles", "discordIds", "array-contains", discordId).catch(() => []));
  if (discordUsername) tasks.push(readWhere("profiles", "discordUsernamesNormalized", "array-contains", lower(discordUsername)).catch(() => []));
  for (const username of robloxUsernames.slice(0, 4)) tasks.push(readWhere("profiles", "robloxUsernamesNormalized", "array-contains", lower(username)).catch(() => []));
  const matches = (await Promise.all(tasks)).flat();
  return [...new Map(matches.map((item) => [item.id, item])).values()];
}

async function createExternalPerson(form, org) {
  const displayName = clean(form.displayName).slice(0, 64);
  const discordUsername = clean(form.discordUsername).slice(0, 64);
  const discordId = clean(form.discordId).replace(/\D/g, "");
  const robloxUsernames = clean(form.robloxUsernames).split(",").map(clean).filter(Boolean).slice(0, 10);
  const aliases = clean(form.aliases).split(",").map(clean).filter(Boolean).slice(0, 10);
  if (!displayName) throw new Error("Display name is required.");
  if (discordId && !/^\d{15,25}$/.test(discordId)) throw new Error("Discord ID must contain 15–25 digits.");
  if (!discordId && !discordUsername && !robloxUsernames.length) throw new Error("Provide at least one Discord or Roblox identifier.");
  const duplicates = await obviousProfileMatches(discordId, discordUsername, robloxUsernames);
  if (duplicates.length) throw new Error(`A possible matching Cognitus profile already exists (${duplicates[0].cognitusId || duplicates[0].id}). Search for that person before creating another record.`);
  const ref = Fire.doc(Fire.collection(db, "profiles"));
  const now = Fire.serverTimestamp();
  await Fire.setDoc(ref, {
    id: ref.id,
    cognitusId: createCognitusId("PRF"),
    linkedUserId: null,
    type: "person",
    displayName,
    robloxUsernames,
    robloxUsernamesNormalized: robloxUsernames.map(lower),
    discordUsernames: discordUsername ? [discordUsername] : [],
    discordUsernamesNormalized: discordUsername ? [lower(discordUsername)] : [],
    discordIds: discordId ? [discordId] : [],
    knownAliases: aliases,
    claimedByUid: null,
    identityStatus: "employer_supplied",
    identityConfidence: 0,
    professionalStanding: "unreviewed",
    riskLevel: "unreviewed",
    reportCount: 0,
    appealCount: 0,
    recordOrigin: "employer_created",
    createdByOrganizationId: org.id,
    createdByUid: authUser.uid,
    createdAt: now,
    updatedAt: now
  });
  await audit("EMPLOYER_PERSON_RECORD_CREATED", "profile", ref.id, `Created employer-supplied Person Record for ${displayName}.`, { organizationId: org.id });
  return { id: ref.id };
}

async function saveCandidate(profile, org, pipelineStatus = "considering") {
  const id = `${org.id}__${profile.id}`;
  const ref = Fire.doc(db, "employerCandidates", id);
  const existing = await readDoc("employerCandidates", id).catch(() => null);
  if (existing) return existing;
  await Fire.setDoc(ref, {
    id,
    organizationId: org.id,
    organizationCognitusId: org.cognitusId || "",
    profileId: profile.id,
    profileCognitusId: profile.cognitusId || "",
    profileDisplayName: profile.displayName || "Person",
    pipelineStatus,
    privateNotes: "",
    addedByUid: authUser.uid,
    addedByCognitusId: userDoc.cognitusId,
    createdAt: Fire.serverTimestamp(),
    updatedAt: Fire.serverTimestamp()
  });
  await audit("EMPLOYER_CANDIDATE_SAVED", "profile", profile.id, `Saved ${profile.displayName || profile.cognitusId || "person"} to ${org.name}'s Talent List.`, { organizationId: org.id });
}

async function updateCandidate(bookmarkId, pipelineStatus, privateNotes) {
  if (!PIPELINE.includes(pipelineStatus)) throw new Error("Choose a valid pipeline status.");
  await Fire.updateDoc(Fire.doc(db, "employerCandidates", bookmarkId), {
    pipelineStatus,
    privateNotes: clean(privateNotes).slice(0, 3000),
    updatedAt: Fire.serverTimestamp()
  });
  await audit("EMPLOYER_CANDIDATE_UPDATED", "candidate", bookmarkId, `Updated candidate pipeline status to ${pipelineStatus}.`);
}

async function saveEmploymentRecord(form, profile, org) {
  const recordId = clean(form.recordId);
  const positionTitle = clean(form.positionTitle).slice(0, 120);
  const department = clean(form.department).slice(0, 100);
  const employmentType = clean(form.employmentType);
  const startedOn = clean(form.startedOn);
  const endedOn = clean(form.endedOn);
  const endReason = clean(form.endReason).slice(0, 300);
  const eligibleForRehire = clean(form.eligibleForRehire);
  if (!positionTitle || !startedOn) throw new Error("Position and start date are required.");
  if (!EMPLOYMENT_TYPES.includes(employmentType)) throw new Error("Choose a valid employment type.");
  if (!REHIRE.includes(eligibleForRehire)) throw new Error("Choose a valid rehire status.");
  if (endedOn && endedOn < startedOn) throw new Error("End date cannot be before the start date.");
  const recordStatus = endedOn ? "ended" : "active";
  if (recordId) {
    const existing = currentEmploymentRecords.get(recordId) || await readDoc("employmentRecords", recordId);
    if (!existing || existing.organizationId !== org.id || existing.profileId !== profile.id) throw new Error("Employment record is unavailable.");
    await Fire.updateDoc(Fire.doc(db, "employmentRecords", recordId), {
      positionTitle, department, employmentType, startedOn, endedOn: endedOn || null, endReason, eligibleForRehire, recordStatus, updatedAt: Fire.serverTimestamp()
    });
    await audit("EMPLOYMENT_RECORD_UPDATED", "employment_record", recordId, `Updated employment record for ${profile.displayName}.`, { organizationId: org.id, profileId: profile.id });
    return;
  }
  const ref = Fire.doc(Fire.collection(db, "employmentRecords"));
  await Fire.setDoc(ref, {
    id: ref.id,
    cognitusId: createCognitusId("EMR"),
    profileId: profile.id,
    profileCognitusId: profile.cognitusId || "",
    organizationId: org.id,
    organizationCognitusId: org.cognitusId || "",
    organizationName: org.name || "Organization",
    positionTitle,
    department,
    employmentType,
    startedOn,
    endedOn: endedOn || null,
    endReason,
    eligibleForRehire,
    recordStatus,
    visibility: "shared_profile",
    sourceType: "verified_employer",
    disputeStatus: "none",
    disputeNote: "",
    createdByUid: authUser.uid,
    createdByCognitusId: userDoc.cognitusId,
    createdAt: Fire.serverTimestamp(),
    updatedAt: Fire.serverTimestamp()
  });
  await audit("EMPLOYMENT_RECORD_CREATED", "employment_record", ref.id, `Added ${positionTitle} employment history for ${profile.displayName}.`, { organizationId: org.id, profileId: profile.id });
}

function fillEmploymentForm(record) {
  const form = root.querySelector("[data-emp11-employment-form]");
  if (!form || !record) return;
  for (const [name, value] of Object.entries(record)) {
    const input = form.elements.namedItem(name);
    if (input && ["recordId","positionTitle","department","employmentType","startedOn","endedOn","endReason","eligibleForRehire"].includes(name)) input.value = value ?? "";
  }
  form.elements.namedItem("recordId").value = record.id;
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.textContent = "Save Record Changes";
  const cancel = form.querySelector("[data-emp11-cancel-edit]");
  if (cancel) cancel.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}
function resetEmploymentForm() {
  const form = root.querySelector("[data-emp11-employment-form]");
  if (!form) return;
  const profileId = form.elements.namedItem("profileId")?.value || "";
  form.reset();
  if (form.elements.namedItem("profileId")) form.elements.namedItem("profileId").value = profileId;
  if (form.elements.namedItem("recordId")) form.elements.namedItem("recordId").value = "";
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.textContent = "Add Employment Record";
  const cancel = form.querySelector("[data-emp11-cancel-edit]");
  if (cancel) cancel.hidden = true;
}

function bindCandidateEvents(profile, org, bookmark, bookmarkId) {
  root.querySelector("[data-emp11-save-candidate]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    try { await saveCandidate(profile, org); schedule(true); } catch (error) { event.currentTarget.disabled = false; window.alert(error?.message || "Could not save candidate."); }
  });
  root.querySelector("[data-emp11-bookmark-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const message = event.currentTarget.querySelector("[data-emp11-bookmark-message]");
    try { await updateCandidate(bookmarkId, data.pipelineStatus, data.privateNotes); message.textContent = "Saved ✓"; message.className = "is-success"; }
    catch (error) { message.textContent = error?.message || "Could not save candidate file."; message.className = "is-error"; }
  });
  root.querySelector("[data-emp11-remove-candidate]")?.addEventListener("click", async () => {
    if (!window.confirm("Remove this person from the organization's Talent List? Employment records will not be deleted.")) return;
    await Fire.deleteDoc(Fire.doc(db, "employerCandidates", bookmarkId));
    await audit("EMPLOYER_CANDIDATE_REMOVED", "profile", profile.id, `Removed ${profile.displayName} from ${org.name}'s Talent List.`, { organizationId: org.id });
    schedule(true);
  });
  root.querySelectorAll("[data-emp11-report-request]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const reportId = form.dataset.emp11ReportRequest;
    const summary = await readDoc("screeningReportSummaries", reportId).catch(() => null);
    const message = form.querySelector("[data-request-message]");
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try { await requestFullReport(summary, new FormData(form).get("reason")); message.textContent = "Request sent."; message.className = "is-success"; setTimeout(() => schedule(true), 350); }
    catch (error) { message.textContent = error?.message || "Request failed."; message.className = "is-error"; button.disabled = false; }
  }));
  root.querySelector("[data-emp11-employment-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const message = event.currentTarget.querySelector("[data-emp11-employment-message]");
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try { await saveEmploymentRecord(data, profile, org); message.textContent = data.recordId ? "Record updated ✓" : "Employment record added ✓"; message.className = "is-success"; setTimeout(() => schedule(true), 450); }
    catch (error) { message.textContent = error?.message || "Employment record could not be saved."; message.className = "is-error"; button.disabled = false; }
  });
  root.querySelector("[data-emp11-cancel-edit]")?.addEventListener("click", resetEmploymentForm);
  root.querySelectorAll("[data-emp11-edit-record]").forEach((button) => button.addEventListener("click", () => fillEmploymentForm(currentEmploymentRecords.get(button.dataset.emp11EditRecord))));
  root.querySelectorAll("[data-emp11-delete-record]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm("Permanently delete this employment record?")) return;
    button.disabled = true;
    try { await Fire.deleteDoc(Fire.doc(db, "employmentRecords", button.dataset.emp11DeleteRecord)); await audit("EMPLOYMENT_RECORD_DELETED", "employment_record", button.dataset.emp11DeleteRecord, "Deleted organization employment record.", { organizationId: org.id }); schedule(true); }
    catch (error) { window.alert(error?.message || "Record could not be deleted."); button.disabled = false; }
  }));
}

async function bindHubEvents(org) {
  root.querySelector("[data-emp11-search-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const target = root.querySelector("[data-emp11-search-results]");
    target.innerHTML = `<div class="empty-state"><p>Searching Cognitus…</p></div>`;
    try {
      peopleSearchResults = await searchProfiles(data.field, data.query);
      target.innerHTML = peopleSearchResults.length ? `<div class="emp11-person-grid">${peopleSearchResults.map((profile) => profileMiniCard(profile)).join("")}</div>` : `<div class="empty-state"><h3>No matching person found.</h3><p>If this person has never existed in Cognitus, use Create a Person Record.</p></div>`;
    } catch (error) { target.innerHTML = `<div class="empty-state"><p>${escapeHtml(error?.message || "Search failed.")}</p></div>`; }
  });
  root.querySelector("[data-emp11-create-person]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const message = form.querySelector("[data-emp11-create-message]");
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    message.textContent = "Creating record…";
    try { const created = await createExternalPerson(data, org); message.textContent = "Person Record created. Opening candidate file…"; message.className = "is-success"; location.hash = `#/employer/candidate?profile=${encodeURIComponent(created.id)}`; }
    catch (error) { message.textContent = error?.message || "Person Record could not be created."; message.className = "is-error"; button.disabled = false; }
  });
  root.querySelectorAll("[data-emp11-edit-record]").forEach((button) => button.addEventListener("click", () => { const record = currentEmploymentRecords.get(button.dataset.emp11EditRecord); if (record) location.hash = `#/employer/candidate?profile=${encodeURIComponent(record.profileId)}&edit=${encodeURIComponent(record.id)}`; }));
}

async function moderationPanels() {
  if (!reviewerRole()) return "";
  const [disputes, claims] = await Promise.all([
    readWhere("employmentRecordDisputes", "status", "==", "pending").catch(() => []),
    readWhere("externalProfileClaims", "status", "==", "pending").catch(() => [])
  ]);
  return `<section class="emp11-moderation"><div class="emp11-moderation-head"><p class="eyebrow">Cognitus Review</p><h2>Employment & profile-link review</h2><p>These queues are Cognitus moderation work, separate from an employer's private talent decisions.</p></div>
    <div class="emp11-two-column"><section class="panel"><div class="panel-header"><div><h3>Employment disputes</h3></div><span>${disputes.length} pending</span></div>${disputes.length ? `<div class="emp11-review-list">${disputes.map((item) => `<article><strong>${escapeHtml(item.recordCognitusId || item.recordId)}</strong><span>${escapeHtml(item.applicantDisplayName || item.applicantCognitusId)}</span><p>${escapeHtml(item.statement || "")}</p><textarea data-dispute-notes="${escapeHtml(item.id)}" rows="3" maxlength="1000" placeholder="Reviewer notes"></textarea><div class="emp11-actions"><button class="button button-dark" data-dispute-action="accepted" data-id="${escapeHtml(item.id)}">Accept Dispute</button><button class="button button-light" data-dispute-action="denied" data-id="${escapeHtml(item.id)}">Deny</button></div></article>`).join("")}</div>` : `<div class="empty-state"><p>No pending employment disputes.</p></div>`}</section>
    <section class="panel"><div class="panel-header"><div><h3>External profile claims</h3></div><span>${claims.length} pending</span></div>${claims.length ? `<div class="emp11-review-list">${claims.map((item) => `<article><strong>${escapeHtml(item.profileCognitusId || item.profileId)}</strong><span>${escapeHtml(item.applicantDisplayName || item.applicantCognitusId)}</span><p>${escapeHtml(item.claimReason || "Request to link employer-created record to account.")}</p><textarea data-claim-notes="${escapeHtml(item.id)}" rows="3" maxlength="1000" placeholder="Reviewer notes"></textarea><div class="emp11-actions"><button class="button button-dark" data-claim-action="approved" data-id="${escapeHtml(item.id)}">Approve Link</button><button class="button button-light" data-claim-action="denied" data-id="${escapeHtml(item.id)}">Deny</button></div></article>`).join("")}</div>` : `<div class="empty-state"><p>No pending external profile claims.</p></div>`}</section></div>
  </section>`;
}

async function decideEmploymentDispute(id, decision, notes) {
  const dispute = await readDoc("employmentRecordDisputes", id);
  if (!dispute || dispute.status !== "pending") throw new Error("Dispute is no longer pending.");
  const record = await readDoc("employmentRecords", dispute.recordId);
  if (!record) throw new Error("Employment record no longer exists.");
  const batch = Fire.writeBatch(db);
  batch.update(Fire.doc(db, "employmentRecordDisputes", id), { status: decision, reviewedByUid: authUser.uid, reviewerNotes: clean(notes).slice(0,1000), reviewedAt: Fire.serverTimestamp(), updatedAt: Fire.serverTimestamp() });
  batch.update(Fire.doc(db, "employmentRecords", dispute.recordId), { disputeStatus: decision, disputeNote: clean(notes).slice(0,1000), updatedAt: Fire.serverTimestamp() });
  await batch.commit();
  await audit("EMPLOYMENT_DISPUTE_DECIDED", "employment_record", dispute.recordId, `${humanize(decision)} employment record dispute.`, { disputeId: id });
}

async function decideExternalClaim(id, decision, notes) {
  const claim = await readDoc("externalProfileClaims", id);
  if (!claim || claim.status !== "pending") throw new Error("Claim is no longer pending.");
  const profile = await readDoc("profiles", claim.profileId);
  if (!profile || profile.linkedUserId) throw new Error("This Person Record is already linked.");
  const batch = Fire.writeBatch(db);
  batch.update(Fire.doc(db, "externalProfileClaims", id), { status: decision, reviewedByUid: authUser.uid, reviewerNotes: clean(notes).slice(0,1000), reviewedAt: Fire.serverTimestamp(), updatedAt: Fire.serverTimestamp() });
  if (decision === "approved") batch.update(Fire.doc(db, "profiles", claim.profileId), { linkedUserId: claim.applicantUid, claimedByUid: claim.applicantUid, identityStatus: "claimed", updatedAt: Fire.serverTimestamp() });
  await batch.commit();
  await audit("EXTERNAL_PROFILE_CLAIM_DECIDED", "profile", claim.profileId, `${humanize(decision)} external Person Record claim.`, { claimId: id, applicantUid: claim.applicantUid });
}

function bindModerationEvents() {
  root.querySelectorAll("[data-dispute-action]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    const notes = root.querySelector(`[data-dispute-notes="${CSS.escape(button.dataset.id)}"]`)?.value || "";
    try { await decideEmploymentDispute(button.dataset.id, button.dataset.disputeAction, notes); schedule(true); } catch (error) { window.alert(error?.message || "Could not decide dispute."); button.disabled = false; }
  }));
  root.querySelectorAll("[data-claim-action]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    const notes = root.querySelector(`[data-claim-notes="${CSS.escape(button.dataset.id)}"]`)?.value || "";
    try { await decideExternalClaim(button.dataset.id, button.dataset.claimAction, notes); schedule(true); } catch (error) { window.alert(error?.message || "Could not decide profile claim."); button.disabled = false; }
  }));
}

async function renderEmployerHub() {
  if (route() !== "/employer" || !root || !authUser || !userDoc) return;
  const key = routeKey();
  if (root.querySelector(`[data-emp11-page][data-emp11-key="${CSS.escape(key)}"]`)) return;
  if (!employerRole()) { root.innerHTML = noEmployerAccess(); return; }
  const org = await loadOrganizationContext();
  const moderation = await moderationPanels();
  if (!org) { root.innerHTML = `${noOrganization()}${moderation}`; bindModerationEvents(); return; }
  const tab = ["overview","talent","people","employment","access"].includes(params().get("tab")) ? params().get("tab") : "overview";
  let content = "";
  if (tab === "overview") content = await overviewPanel(org);
  if (tab === "talent") content = await talentPanel(org);
  if (tab === "people") content = peoplePanel(org);
  if (tab === "employment") content = await employmentPanel(org);
  if (tab === "access") content = await accessPanel();
  document.title = `Employer Hub · Cognitus Solutions`;
  root.innerHTML = `<main class="emp11-shell" data-emp11-page data-emp11-key="${escapeHtml(key)}"><section class="emp11-workspace-hero"><div><p class="eyebrow">Employer Workspace</p><h1>${escapeHtml(org.name || "Employer Hub")}</h1><p>A private talent workspace for candidate tracking, factual employment history, deeper report vetting, and organization screening activity.</p></div><aside><span>Organization</span><strong>${escapeHtml(org.cognitusId || org.id)}</strong><small>${escapeHtml(humanize(org.verificationStatus || "unknown"))} · ${escapeHtml(humanize(userDoc.role))}</small></aside></section>${workspaceTabs(tab)}${content}${moderation}</main>`;
  await bindHubEvents(org);
  bindModerationEvents();
}

async function renderCandidateRoute() {
  if (route() !== "/employer/candidate" || !root || !authUser || !userDoc) return;
  const key = routeKey();
  if (root.querySelector(`[data-emp11-page][data-emp11-key="${CSS.escape(key)}"]`)) return;
  if (!employerRole()) { root.innerHTML = noEmployerAccess(); return; }
  const org = await loadOrganizationContext();
  if (!org) { root.innerHTML = noOrganization(); return; }
  const profileId = params().get("profile");
  if (!profileId) { location.hash = "#/employer?tab=people"; return; }
  await renderCandidateFile(org, profileId);
  const editId = params().get("edit");
  if (editId && currentEmploymentRecords.has(editId)) setTimeout(() => fillEmploymentForm(currentEmploymentRecords.get(editId)), 80);
}

async function createEmploymentDispute(record, statement) {
  const id = `${record.id}__${authUser.uid}`;
  const existing = await readDoc("employmentRecordDisputes", id).catch(() => null);
  if (existing?.status === "pending") throw new Error("A dispute for this record is already pending.");
  const ref = Fire.doc(db, "employmentRecordDisputes", id);
  const payload = {
    id,
    cognitusId: existing?.cognitusId || createCognitusId("EDP"),
    recordId: record.id,
    recordCognitusId: record.cognitusId || "",
    profileId: record.profileId,
    organizationId: record.organizationId,
    applicantUid: authUser.uid,
    applicantCognitusId: userDoc.cognitusId,
    applicantDisplayName: userDoc.displayName || userDoc.discordUsername || "Cognitus User",
    statement: clean(statement).slice(0,2000),
    status: "pending",
    reviewedByUid: null,
    reviewerNotes: "",
    reviewedAt: null,
    submittedAt: Fire.serverTimestamp(),
    updatedAt: Fire.serverTimestamp()
  };
  await Fire.setDoc(ref, payload);
  await audit("EMPLOYMENT_RECORD_DISPUTED", "employment_record", record.id, "Submitted dispute against employer employment record.", { disputeId: id });
}

async function requestExternalProfileLink(profile, reason) {
  const id = `${profile.id}__${authUser.uid}`;
  const existing = await readDoc("externalProfileClaims", id).catch(() => null);
  if (existing?.status === "pending") throw new Error("A link request for this Person Record is already pending.");
  const ref = Fire.doc(db, "externalProfileClaims", id);
  await Fire.setDoc(ref, {
    id,
    cognitusId: existing?.cognitusId || createCognitusId("PCL"),
    profileId: profile.id,
    profileCognitusId: profile.cognitusId || "",
    applicantUid: authUser.uid,
    applicantCognitusId: userDoc.cognitusId,
    applicantDisplayName: userDoc.displayName || userDoc.discordUsername || "Cognitus User",
    claimReason: clean(reason).slice(0,1200),
    verificationMethod: (profile.discordIds || []).includes(userDoc.discordId) ? "discord_id_match" : "manual_review",
    status: "pending",
    reviewedByUid: null,
    reviewerNotes: "",
    reviewedAt: null,
    submittedAt: Fire.serverTimestamp(),
    updatedAt: Fire.serverTimestamp()
  });
  await audit("EXTERNAL_PROFILE_LINK_REQUESTED", "profile", profile.id, "Requested link to employer-created Person Record.", { claimId: id });
}

function profileEmploymentCard(record, dispute) {
  return `<article class="emp11-employment-card"><div class="emp11-employment-top"><div><span>${escapeHtml(record.cognitusId || record.id)}</span><h3>${escapeHtml(record.positionTitle || "Employment Record")}</h3><p>${escapeHtml(record.organizationName || "Organization")} · ${escapeHtml(dateRange(record))}</p></div><div class="emp11-chip-row">${badge(record.recordStatus || "active")}${record.disputeStatus && record.disputeStatus !== "none" ? badge(`Dispute ${record.disputeStatus}`) : badge("Verified Employer Record", "success")}</div></div><dl class="emp11-record-details"><div><dt>Department</dt><dd>${escapeHtml(record.department || "—")}</dd></div><div><dt>Type</dt><dd>${escapeHtml(record.employmentType || "—")}</dd></div><div><dt>End reason</dt><dd>${escapeHtml(record.endReason || "—")}</dd></div><div><dt>Eligible for rehire</dt><dd>${escapeHtml(humanize(record.eligibleForRehire || "unknown"))}</dd></div></dl><div class="emp11-provenance"><strong>Verified Employer Record</strong><span>Submitted by ${escapeHtml(record.organizationName || "a verified organization")}</span></div>${record.disputeNote ? `<div class="emp11-dispute-note"><strong>Cognitus dispute note</strong><p>${escapeHtml(record.disputeNote)}</p></div>` : ""}<div class="emp11-actions">${dispute?.status === "pending" ? badge("Dispute Pending", "warning") : `<details class="emp11-dispute-details"><summary class="button button-light">Dispute This Record</summary><form data-emp11-dispute="${escapeHtml(record.id)}"><textarea name="statement" rows="4" maxlength="2000" required placeholder="Explain what is inaccurate or missing and what should be reviewed."></textarea><button class="button button-dark" type="submit">Submit Dispute</button><span data-dispute-message></span></form></details>`}</div></article>`;
}

async function enhanceOwnProfile() {
  if (route() !== "/profile" || !authUser || !userDoc || !root) return;
  if (root.querySelector("[data-emp11-profile-employment]")) return;
  const anchor = root.querySelector("#profile-reports");
  if (!anchor) return;
  const linkedProfiles = await readWhere("profiles", "linkedUserId", "==", authUser.uid).catch(() => []);
  const profileIds = [...new Set([authUser.uid, ...linkedProfiles.map((item) => item.id)])];
  const employment = (await Promise.all(profileIds.map((id) => readWhere("employmentRecords", "profileId", "==", id).catch(() => [])))).flat();
  const disputes = await readWhere("employmentRecordDisputes", "applicantUid", "==", authUser.uid).catch(() => []);
  const disputeByRecord = new Map(disputes.map((item) => [item.recordId, item]));
  const claimable = (await readWhere("profiles", "discordIds", "array-contains", userDoc.discordId).catch(() => []))
    .filter((profile) => !profile.linkedUserId && profile.id !== authUser.uid && profile.recordOrigin === "employer_created");
  const claims = await readWhere("externalProfileClaims", "applicantUid", "==", authUser.uid).catch(() => []);
  const claimByProfile = new Map(claims.map((item) => [item.profileId, item]));
  const panel = document.createElement("section");
  panel.className = "panel v5-profile-section emp11-profile-employment";
  panel.dataset.emp11ProfileEmployment = "true";
  panel.innerHTML = `<div class="panel-header"><div><p class="eyebrow">Employment History</p><h2>Employer-submitted records</h2></div><span>${employment.length} record${employment.length === 1 ? "" : "s"}</span></div><p class="emp11-intro">These are attributable records submitted by verified employers. Private candidate notes are never shown here.</p>${employment.length ? `<div class="emp11-employment-list">${employment.sort((a,b)=>clean(b.startedOn).localeCompare(clean(a.startedOn))).map((record)=>profileEmploymentCard(record, disputeByRecord.get(record.id))).join("")}</div>` : `<div class="empty-state"><p>No employer-submitted employment history is tied to your account.</p></div>`}${claimable.length ? `<div class="emp11-claimable"><div class="panel-header"><div><p class="eyebrow">Possible Match</p><h3>Unclaimed Person Record(s)</h3></div></div><p>Cognitus found employer-created records with your immutable Discord ID. You can request that staff link them to your account.</p>${claimable.map((profile)=>{const claim=claimByProfile.get(profile.id);return `<article><div><strong>${escapeHtml(profile.displayName || profile.cognitusId)}</strong><span>${escapeHtml(profile.cognitusId || profile.id)} · ${escapeHtml(identityLine(profile))}</span></div>${claim?.status === "pending" ? badge("Link Pending","warning") : `<button class="button button-light" data-emp11-claim-profile="${escapeHtml(profile.id)}">Request Account Link</button>`}</article>`;}).join("")}</div>` : ""}`;
  anchor.insertAdjacentElement("beforebegin", panel);
  panel.querySelectorAll("[data-emp11-dispute]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const record = employment.find((item)=>item.id===form.dataset.emp11Dispute);
    const message=form.querySelector("[data-dispute-message]");
    try { await createEmploymentDispute(record,new FormData(form).get("statement")); message.textContent="Dispute submitted.";message.className="is-success";setTimeout(()=>{panel.remove();enhanceOwnProfile();},400); }
    catch(error){message.textContent=error?.message||"Dispute could not be submitted.";message.className="is-error";}
  }));
  panel.querySelectorAll("[data-emp11-claim-profile]").forEach((button)=>button.addEventListener("click",async()=>{
    const profile=claimable.find((item)=>item.id===button.dataset.emp11ClaimProfile);button.disabled=true;
    try{await requestExternalProfileLink(profile,"This employer-created Person Record appears to represent my Cognitus identity and should be linked to my account.");button.textContent="Link Requested ✓";}
    catch(error){window.alert(error?.message||"Link request failed.");button.disabled=false;}
  }));
}

async function enhance() {
  injectEmployerNav();
  await renderEmployerHub();
  await renderCandidateRoute();
  await enhanceOwnProfile();
}
function schedule(force = false) {
  if (force) root?.querySelectorAll("[data-emp11-page]").forEach((node) => node.removeAttribute("data-emp11-key"));
  timers.forEach(clearTimeout);
  timers = [0, 140, 420, 900, 1600].map((delay) => setTimeout(() => enhance().catch((error) => console.warn("Employer Workspace V11 enhancement failed", error)), delay));
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
    peopleSearchResults = [];
    schedule(true);
  });
  window.addEventListener("hashchange", () => { peopleSearchResults = []; schedule(true); });
  window.addEventListener("pageshow", schedule);
  window.addEventListener("DOMContentLoaded", schedule);
  schedule();
}

initialize().catch((error) => console.warn("Employer Workspace V11 failed to initialize", error));
