import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
const nav = document.querySelector(".topnav");

let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userDoc = null;
let ownMemberDoc = null;
let renderSequence = 0;
let healthState = null;
let mergePreviewState = null;
let privacySnapshotState = null;
let actionCount = 0;

const FOUNDATION_ROUTES = new Set([
  "/actions",
  "/people/master",
  "/people-integrity",
  "/employer/members",
  "/system-health",
  "/audit",
  "/privacy-center"
]);
const EMPLOYER_ROLES = new Set(["verified_employer_member", "org_admin", "reviewer", "admin", "owner"]);
const ADMIN_ROLES = new Set(["admin", "owner"]);
const REVIEWER_ROLES = new Set(["reviewer", "admin", "owner"]);
const PIPELINE_ORDER = ["considering", "interview", "shortlist", "offer", "hired", "passed", "do_not_reconsider", "archived"];
const DEFAULT_RETENTION = Object.freeze({
  closedWorkflowDays: 365,
  auditDays: 730,
  inactiveAccountDays: 365
});

const clean = (value) => String(value ?? "").trim();
const lower = (value) => clean(value).toLowerCase();
const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const params = () => new URLSearchParams(location.hash.split("?")[1] || "");
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
function isActive() { return userDoc?.status === "active"; }
function isOwner() { return isActive() && userDoc?.role === "owner"; }
function isAdmin() { return isActive() && ADMIN_ROLES.has(userDoc?.role); }
function isReviewer() { return isActive() && REVIEWER_ROLES.has(userDoc?.role); }
function employerCapable() { return isActive() && EMPLOYER_ROLES.has(userDoc?.role); }
function uniq(values, limit = 50) {
  return [...new Set((values || []).map(clean).filter(Boolean))].slice(0, limit);
}
function uniqLower(values, limit = 50) {
  return [...new Set((values || []).map(lower).filter(Boolean))].slice(0, limit);
}
function tone(value) {
  const status = lower(value);
  if (["active","approved","accepted","completed","verified","good_standing","good","low","claimed"].includes(status)) return "good";
  if (["denied","removed","banned","restricted","critical","high","high_risk"].includes(status)) return "bad";
  if (["pending","pending_review","removal_requested","suspended","watch","moderate","concern","disputed"].includes(status)) return "warn";
  return "info";
}
function badge(value, forced = null) {
  return `<span class="f19-badge ${escapeHtml(forced || tone(value))}">${escapeHtml(humanize(value))}</span>`;
}
function button(href, label, primary = false) {
  return `<a class="button ${primary ? "button-dark" : "button-light"}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}
function emptyState(title, body) {
  return `<div class="f19-empty"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div>`;
}
function hero(eyebrow, title, body, aside = "") {
  return `<section class="f19-hero"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p></div><aside class="f19-hero-aside">${aside || `<span>Cognitus Foundation</span><strong>Canonical, auditable, repairable.</strong><small>Foundation V19</small>`}</aside></section>`;
}

function mountStyles() {
  if (document.querySelector("#cognitus-foundation-v19")) return;
  const link = document.createElement("link");
  link.id = "cognitus-foundation-v19";
  link.rel = "stylesheet";
  link.href = "./src/foundationV19.css?v=20260816-1";
  document.head.appendChild(link);
}

async function readDoc(collectionName, id) {
  if (!id) return null;
  const snap = await Fire.getDoc(Fire.doc(db, collectionName, id));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}
async function readWhere(collectionName, field, op, value, extra = []) {
  if (value === undefined || value === null || value === "") return [];
  const constraints = [Fire.where(field, op, value), ...extra];
  const snap = await Fire.getDocs(Fire.query(Fire.collection(db, collectionName), ...constraints));
  return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}
async function readAll(collectionName) {
  const snap = await Fire.getDocs(Fire.collection(db, collectionName));
  return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}
async function resolveOrganizationReference(reference) {
  const value = clean(reference);
  if (!value) return null;
  const direct = await readDoc("organizations", value).catch(() => null);
  if (direct) return direct;
  const matches = await readWhere("organizations", "cognitusId", "==", value).catch(() => []);
  return matches[0] || null;
}
async function resolveProfileReference(reference) {
  const value = clean(reference);
  if (!value) return null;
  const direct = await readDoc("profiles", value).catch(() => null);
  if (direct) return direct;
  const matches = await readWhere("profiles", "cognitusId", "==", value.toUpperCase()).catch(() => []);
  return matches[0] || null;
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
      action: clean(action).slice(0, 80),
      targetType: clean(targetType).slice(0, 80),
      targetId: targetId || null,
      summary: clean(summary).slice(0, 500),
      metadata,
      createdAt: Fire.serverTimestamp()
    });
  } catch (error) {
    console.warn("Foundation V19 audit failed", error);
  }
}

function defaultPermissions() {
  return {
    runChecks: true,
    manageTalent: true,
    addEmploymentRecords: true,
    requestReports: true,
    manageMembers: false
  };
}
function memberId(orgId, uid) { return `${orgId}__${uid}`; }
function buildMembership(user, org, positionTitle = "Employer Member", grantedByUid = authUser?.uid) {
  return {
    id: memberId(org.id, user.id || user.uid),
    organizationId: org.id,
    organizationCognitusId: org.cognitusId || "",
    userUid: user.id || user.uid,
    userCognitusId: user.cognitusId || "",
    displayName: user.displayName || user.discordUsername || "Cognitus User",
    positionTitle: clean(positionTitle || "Employer Member").slice(0, 100),
    memberStatus: "active",
    permissions: defaultPermissions(),
    grantedByUid: grantedByUid || user.id || user.uid,
    removalRequestedByUid: null,
    removalRequestedAt: null,
    removedByUid: null,
    removedAt: null,
    createdAt: Fire.serverTimestamp(),
    updatedAt: Fire.serverTimestamp()
  };
}
async function ensureOwnMembership() {
  ownMemberDoc = null;
  if (!authUser || !userDoc || !employerCapable() || !userDoc.organizationId) return;
  const org = await resolveOrganizationReference(userDoc.organizationId).catch(() => null);
  if (!org || org.id !== userDoc.organizationId) return;
  const id = memberId(org.id, authUser.uid);
  ownMemberDoc = await readDoc("organizationMembers", id).catch(() => null);
  if (ownMemberDoc) return;
  const approved = await readDoc("employerStatusRequests", authUser.uid).catch(() => null);
  try {
    const payload = buildMembership(userDoc, org, approved?.positionTitle || "Employer Member", authUser.uid);
    await Fire.setDoc(Fire.doc(db, "organizationMembers", id), payload);
    ownMemberDoc = { ...payload, id };
  } catch (error) {
    console.warn("Foundation V19 membership bootstrap unavailable", error);
  }
}
function effectivePermissions(member = ownMemberDoc) {
  if (isAdmin() || userDoc?.role === "org_admin") return {
    runChecks: true, manageTalent: true, addEmploymentRecords: true, requestReports: true, manageMembers: true
  };
  if (userDoc?.role === "reviewer") return {
    runChecks: true, manageTalent: true, addEmploymentRecords: true, requestReports: true, manageMembers: false
  };
  return member?.memberStatus === "active" ? { ...defaultPermissions(), ...(member.permissions || {}) } : defaultPermissions();
}

function operationsItems() {
  const items = [
    ["#/actions", "Action Center", "Pending decisions and workflow changes"],
    ["#/privacy-center", "Data & Privacy", "Your data, corrections, deletion requests, retention"]
  ];
  if (employerCapable()) items.push(["#/employer/members", "Organization Members", "Members, positions, and employer permissions"]);
  if (isAdmin()) items.push(["#/audit", "Audit Center", "Trace sensitive actions across Cognitus"]);
  if (isOwner()) {
    items.push(["#/people-integrity", "People Integrity", "Duplicates, canonical records, and merges"]);
    items.push(["#/system-health", "System Health", "Diagnose and repair data integrity"]);
  }
  return items;
}
function ensureFoundationNav() {
  if (!nav) return;
  if (!authUser || !userDoc) {
    nav.querySelector("[data-f19-actions-nav]")?.remove();
    nav.querySelector("[data-f19-ops]")?.remove();
    return;
  }
  let actionLink = nav.querySelector("[data-f19-actions-nav]");
  if (!actionLink) {
    actionLink = document.createElement("a");
    actionLink.href = "#/actions";
    actionLink.className = "f19-action-link";
    actionLink.dataset.f19ActionsNav = "true";
    actionLink.innerHTML = `Action Center <span class="f19-action-count" data-f19-action-count></span>`;
  }
  const more = nav.querySelector(".nav6-more");
  if (more) nav.insertBefore(actionLink, more);
  else {
    const settings = nav.querySelector('a[href="#/settings"]');
    if (settings) nav.insertBefore(actionLink, settings); else nav.appendChild(actionLink);
  }
  const count = actionLink.querySelector("[data-f19-action-count]");
  if (count) count.textContent = actionCount > 0 ? String(Math.min(actionCount, 99)) : "";

  let ops = nav.querySelector("[data-f19-ops]");
  if (!ops) {
    ops = document.createElement("div");
    ops.className = "f19-ops";
    ops.dataset.f19Ops = "true";
    ops.innerHTML = `<button type="button" data-f19-ops-button aria-expanded="false">Operations ▾</button><div class="f19-ops-menu" data-f19-ops-menu></div>`;
  }
  const menu = ops.querySelector("[data-f19-ops-menu]");
  menu.innerHTML = operationsItems().map(([href, label, note]) => `<a href="${href}"><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small></a>`).join("");
  const settings = nav.querySelector('a[href="#/settings"]');
  if (settings) nav.insertBefore(ops, settings); else nav.appendChild(ops);

  const base = (location.hash || "#/").split("?")[0];
  actionLink.classList.toggle("v4-active", base === "#/actions");
  ops.querySelector("[data-f19-ops-button]")?.classList.toggle("v4-active", ["#/privacy-center","#/employer/members","#/audit","#/people-integrity","#/system-health","#/people/master"].includes(base));
}
function closeOperationsMenu() {
  const ops = nav?.querySelector("[data-f19-ops]");
  ops?.classList.remove("is-open");
  ops?.querySelector("[data-f19-ops-button]")?.setAttribute("aria-expanded", "false");
}

async function getOwnProfiles() {
  if (!authUser) return [];
  const [direct, linked] = await Promise.all([
    readDoc("profiles", authUser.uid).catch(() => null),
    readWhere("profiles", "linkedUserId", "==", authUser.uid).catch(() => [])
  ]);
  const map = new Map();
  if (direct) map.set(direct.id, direct);
  for (const profile of linked) map.set(profile.id, profile);
  return [...map.values()];
}
async function collectActionItems() {
  if (!authUser || !userDoc) return [];
  const profiles = await getOwnProfiles();
  const items = [];
  const ownRequests = await Promise.all([
    readDoc("employerStatusRequests", authUser.uid).catch(() => null),
    readWhere("reportAccessRequests", "requesterUid", "==", authUser.uid).catch(() => []),
    readWhere("employmentRecordDisputes", "applicantUid", "==", authUser.uid).catch(() => []),
    readWhere("externalProfileClaims", "applicantUid", "==", authUser.uid).catch(() => []),
    readWhere("claims", "submittedByUid", "==", authUser.uid).catch(() => []),
    readWhere("appeals", "submittedByUid", "==", authUser.uid).catch(() => []),
    readWhere("privacyRequests", "requesterUid", "==", authUser.uid).catch(() => [])
  ]);
  const employerStatus = ownRequests[0];
  if (employerStatus?.status === "pending") items.push({ title: "Employer Status awaiting review", detail: employerStatus.organizationName, status: "pending", href: "#/employer-status", at: employerStatus.updatedAt });
  if (["approved","denied"].includes(employerStatus?.status)) items.push({ title: `Employer Status ${humanize(employerStatus.status)}`, detail: employerStatus.reviewerNotes || employerStatus.organizationName, status: employerStatus.status, href: "#/employer-status", at: employerStatus.reviewedAt });
  for (const request of ownRequests[1]) if (["pending","approved","denied","revoked"].includes(request.status)) items.push({ title: `Report access ${humanize(request.status)}`, detail: request.reportCognitusId || request.reportId, status: request.status, href: "#/reports", at: request.updatedAt });
  for (const dispute of ownRequests[2]) if (dispute.status === "pending") items.push({ title: "Employment dispute pending", detail: dispute.recordCognitusId || dispute.recordId, status: "pending", href: "#/profile", at: dispute.updatedAt });
  for (const claim of ownRequests[3]) if (claim.status === "pending") items.push({ title: "Profile-link review pending", detail: claim.profileCognitusId || claim.profileId, status: "pending", href: "#/profile", at: claim.updatedAt });
  for (const claim of ownRequests[4]) if (claim.status === "pending_review") items.push({ title: "Profile claim pending", detail: claim.cognitusId || claim.id, status: "pending", href: "#/claims", at: claim.updatedAt });
  for (const appeal of ownRequests[5]) if (appeal.status?.startsWith("pending")) items.push({ title: "Appeal pending", detail: appeal.cognitusId || appeal.id, status: "pending", href: "#/appeals", at: appeal.updatedAt });
  for (const request of ownRequests[6]) if (request.status === "pending") items.push({ title: `Privacy ${humanize(request.requestType)} request`, detail: request.cognitusId || request.id, status: "pending", href: "#/privacy-center", at: request.updatedAt });

  for (const profile of profiles) {
    const inbound = await readWhere("reportAccessRequests", "subjectProfileId", "==", profile.id).catch(() => []);
    for (const request of inbound) if (request.status === "pending") items.push({ title: "Someone requested your full report", detail: request.requesterDisplayName || request.requesterCognitusId, status: "pending", href: "#/reports", at: request.updatedAt });
  }

  if (isAdmin()) {
    const [employerQueue, disputeQueue, claimQueue, privacyQueue, removals] = await Promise.all([
      readWhere("employerStatusRequests", "status", "==", "pending").catch(() => []),
      readWhere("employmentRecordDisputes", "status", "==", "pending").catch(() => []),
      readWhere("externalProfileClaims", "status", "==", "pending").catch(() => []),
      readWhere("privacyRequests", "status", "==", "pending").catch(() => []),
      readWhere("organizationMembers", "memberStatus", "==", "removal_requested").catch(() => [])
    ]);
    for (const request of employerQueue) items.push({ title: "Employer application needs review", detail: request.applicantDisplayName, status: "pending", href: "#/employer-status", at: request.updatedAt });
    for (const dispute of disputeQueue) items.push({ title: "Employment dispute needs review", detail: dispute.recordCognitusId || dispute.recordId, status: "pending", href: "#/employer", at: dispute.updatedAt });
    for (const claim of claimQueue) items.push({ title: "Profile-link claim needs review", detail: claim.applicantDisplayName, status: "pending", href: "#/employer", at: claim.updatedAt });
    for (const request of privacyQueue) items.push({ title: "Privacy request needs review", detail: request.requesterCognitusId, status: "pending", href: "#/privacy-center", at: request.updatedAt });
    for (const member of removals) items.push({ title: "Organization member removal requested", detail: member.displayName, status: "pending", href: `#/employer/members?org=${encodeURIComponent(member.organizationId)}`, at: member.updatedAt });
  }
  return items.sort((a, b) => timestampMs(b.at) - timestampMs(a.at));
}
async function refreshActionCount() {
  try {
    const items = await collectActionItems();
    actionCount = items.filter((item) => item.status === "pending" || item.status === "pending_review").length;
  } catch {
    actionCount = 0;
  }
  ensureFoundationNav();
}
async function renderActionCenter() {
  const items = await collectActionItems();
  if (route() !== "/actions") return;
  actionCount = items.filter((item) => item.status === "pending" || item.status === "pending_review").length;
  ensureFoundationNav();
  const pending = items.filter((item) => item.status === "pending" || item.status === "pending_review");
  const recent = items.filter((item) => !pending.includes(item)).slice(0, 12);
  root.innerHTML = `<main class="f19-shell">${hero("Action Center","What needs attention.","Cognitus brings pending requests, reviews, disputes, access decisions, and organization actions into one place.",`<span>Pending actions</span><strong>${pending.length}</strong><small>${recent.length} recent decisions shown</small>`)}
    <section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Pending</p><h2>Needs attention</h2></div>${badge(`${pending.length} pending`, pending.length ? "warn" : "good")}</div>${pending.length ? `<div class="f19-list">${pending.map((item) => `<article class="f19-row"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail || "")}</span><small>${escapeHtml(formatTimestamp(item.at))}</small></div>${button(item.href,"Open",true)}</article>`).join("")}</div>` : emptyState("You're caught up.","No Cognitus workflow currently needs your attention.")}</section>
    <section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Recent</p><h2>Recent decisions & status changes</h2></div></div>${recent.length ? `<div class="f19-list">${recent.map((item) => `<article class="f19-row"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail || "")}</span><small>${escapeHtml(formatTimestamp(item.at))}</small></div>${badge(item.status)}</article>`).join("")}</div>` : emptyState("Nothing recent.","Recent workflow decisions will appear here as Cognitus activity develops.")}</section></main>`;
}

async function canonicalContext(reference) {
  const requested = await resolveProfileReference(reference);
  if (!requested) return null;
  let target = requested;
  if (requested.mergedIntoProfileId) target = await readDoc("profiles", requested.mergedIntoProfileId).catch(() => requested);
  else {
    const map = await readDoc("profileMergeMap", requested.id).catch(() => null);
    if (map?.targetProfileId) target = await readDoc("profiles", map.targetProfileId).catch(() => requested);
  }
  const mergeMaps = await readWhere("profileMergeMap", "targetProfileId", "==", target.id).catch(() => []);
  const sourceProfiles = (await Promise.all(mergeMaps.map((map) => readDoc("profiles", map.sourceProfileId).catch(() => null)))).filter(Boolean);
  return { requested, target, mergeMaps, sourceProfiles };
}
async function readForProfileIds(collectionName, field, ids) {
  const groups = await Promise.all(ids.map((id) => readWhere(collectionName, field, "==", id).catch(() => [])));
  const map = new Map();
  for (const row of groups.flat()) if (row?.id) map.set(row.id, row);
  return [...map.values()];
}
function identityLine(profile) {
  const discord = uniq(profile.discordUsernames || [profile.discordUsername], 10);
  const roblox = uniq(profile.robloxUsernames || [profile.robloxUsername], 10);
  return [discord.length ? `Discord: ${discord.join(", ")}` : "", roblox.length ? `Roblox: ${roblox.join(", ")}` : ""].filter(Boolean).join(" · ") || "No usernames listed";
}
async function renderMasterRecord() {
  const reference = params().get("profile");
  if (!reference) {
    root.innerHTML = `<main class="f19-shell">${hero("Master Record","Choose a person.","Open a Master Record from Run Check, Employer Hub, People Integrity, or enter a profile reference in the URL.")}</main>`;
    return;
  }
  const context = await canonicalContext(reference);
  if (!context) {
    root.innerHTML = `<main class="f19-shell">${hero("Master Record","Person not found.","Cognitus could not resolve that profile or canonical merge record.")}</main>`;
    return;
  }
  const ids = uniq([context.target.id, ...context.sourceProfiles.map((profile) => profile.id)], 50);
  const [employment, summaries, fullReports, disputes, appeals, claims, accessRequests, auditRows] = await Promise.all([
    readForProfileIds("employmentRecords", "profileId", ids),
    readForProfileIds("screeningReportSummaries", "subjectProfileId", ids),
    readForProfileIds("reports", "subjectProfileId", ids).catch(() => []),
    readForProfileIds("employmentRecordDisputes", "profileId", ids).catch(() => []),
    readForProfileIds("appeals", "profileId", ids).catch(() => []),
    readForProfileIds("claims", "profileId", ids).catch(() => []),
    readForProfileIds("reportAccessRequests", "subjectProfileId", ids).catch(() => []),
    isAdmin() ? readForProfileIds("auditLogs", "targetId", ids).catch(() => []) : Promise.resolve([])
  ]);
  if (route() !== "/people/master") return;
  const profile = context.target;
  const fullById = new Map(fullReports.map((report) => [report.id, report]));
  const timeline = [
    ...employment.map((row) => ({ at: row.startedOn, title: `${row.positionTitle || "Employment"} · ${row.organizationName || "Organization"}`, detail: row.endedOn ? `Ended ${row.endedOn}` : "Current employment", type: "Employment" })),
    ...summaries.map((row) => ({ at: row.reportCreatedAt, title: `${row.category || "Reviewed Report"} · ${row.severity || "Informational"}`, detail: row.summary || "", type: "Reviewed Record" })),
    ...disputes.map((row) => ({ at: row.submittedAt, title: `Employment dispute · ${humanize(row.status)}`, detail: row.statement || "", type: "Dispute" }))
  ].sort((a, b) => timestampMs(b.at) - timestampMs(a.at));
  const aliases = uniq([...(profile.knownAliases || []), ...context.sourceProfiles.map((row) => row.displayName)], 20);
  const provenance = context.sourceProfiles.length ? `${context.sourceProfiles.length} historical profile record${context.sourceProfiles.length === 1 ? "" : "s"} merged into this canonical identity.` : "This profile is its own canonical Cognitus identity.";
  root.innerHTML = `<main class="f19-shell">${hero("Canonical Person Record",profile.displayName || "Unnamed Person","One Cognitus view of identity, assessment, employment, reviewed records, disputes, access, and provenance.",`<span>Canonical Profile</span><strong>${escapeHtml(profile.cognitusId || profile.id)}</strong><small>${escapeHtml(provenance)}</small>`)}
    <section class="f19-grid"><article class="f19-card f19-stat"><span>Professional Standing</span><strong>${escapeHtml(humanize(profile.professionalStanding || "unreviewed"))}</strong>${badge(profile.professionalStanding || "unreviewed")}</article><article class="f19-card f19-stat"><span>Risk Level</span><strong>${escapeHtml(humanize(profile.riskLevel || "unreviewed"))}</strong>${badge(profile.riskLevel || "unreviewed")}</article><article class="f19-card f19-stat"><span>Identity Confidence</span><strong>${Number(profile.identityConfidence || 0)}%</strong>${badge(profile.identityStatus || "unreviewed")}</article></section>
    <section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Identity</p><h2>Identity & provenance</h2><p>${escapeHtml(identityLine(profile))}</p></div>${profile.linkedUserId ? badge("Account Linked","good") : badge("Unclaimed","info")}</div><div class="f19-detail-grid"><div class="f19-detail"><span>Document ID</span><strong class="f19-code">${escapeHtml(profile.id)}</strong></div><div class="f19-detail"><span>Cognitus ID</span><strong>${escapeHtml(profile.cognitusId || "—")}</strong></div><div class="f19-detail"><span>Aliases</span><strong>${escapeHtml(aliases.join(", ") || "None recorded")}</strong></div><div class="f19-detail"><span>Record origin</span><strong>${escapeHtml(humanize(profile.recordOrigin || "Cognitus account"))}</strong></div></div>${context.sourceProfiles.length ? `<div class="f19-notice"><strong>Merged provenance:</strong> ${context.sourceProfiles.map((row) => escapeHtml(row.cognitusId || row.id)).join(", ")} now resolve to this canonical record.</div>` : ""}</section>
    <section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Employment</p><h2>Complete employment history</h2></div><span>${employment.length} records</span></div>${employment.length ? `<div class="f19-list">${employment.sort((a,b)=>clean(b.startedOn).localeCompare(clean(a.startedOn))).map((row)=>`<article class="f19-row"><div><strong>${escapeHtml(row.positionTitle || "Employment Record")}</strong><span>${escapeHtml(row.organizationName || row.organizationCognitusId || "Organization")} · ${escapeHtml(row.startedOn || "?")} — ${escapeHtml(row.endedOn || "Present")}</span><small>${escapeHtml(humanize(row.employmentType || "Other"))} · Rehire: ${escapeHtml(humanize(row.eligibleForRehire || "unknown"))}${row.disputeStatus && row.disputeStatus !== "none" ? ` · Dispute ${escapeHtml(humanize(row.disputeStatus))}` : ""}</small></div>${badge("Verified Employer Record","good")}</article>`).join("")}</div>` : emptyState("No employment history.","No verified employer-submitted employment records are attached to this canonical person.")}</section>
    <section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Reviewed Records</p><h2>Screening reports</h2></div><span>${summaries.length} reviewed</span></div>${summaries.length ? `<div class="f19-list">${summaries.sort((a,b)=>timestampMs(b.reportCreatedAt)-timestampMs(a.reportCreatedAt)).map((row)=>{const full=fullById.get(row.reportId||row.id);return `<article class="f19-row"><div><strong>${escapeHtml(row.category || "Reviewed Report")}</strong><span>${escapeHtml(row.summary || "")}</span><small>${escapeHtml(row.reportCognitusId || row.reportId || row.id)} · ${escapeHtml(humanize(row.severity || "Informational"))}</small></div><div class="f19-actions">${badge(row.severity || "Informational")}${full ? button(`#/reports/view?report=${encodeURIComponent(full.id)}`,"Open Full Report",true) : button("#/reports","Request / Review Access")}</div></article>`;}).join("")}</div>` : emptyState("No reviewed reports.","No approved screening summaries are associated with this person.")}</section>
    <section class="f19-grid two"><article class="f19-card"><div class="f19-section-head"><div><p class="eyebrow">Challenges</p><h2>Disputes & appeals</h2></div></div><div class="f19-detail-grid"><div class="f19-detail"><span>Employment disputes</span><strong>${disputes.length}</strong></div><div class="f19-detail"><span>Report appeals</span><strong>${appeals.length}</strong></div><div class="f19-detail"><span>Profile claims</span><strong>${claims.length}</strong></div><div class="f19-detail"><span>Access records</span><strong>${accessRequests.length}</strong></div></div></article><article class="f19-card"><div class="f19-section-head"><div><p class="eyebrow">Scope</p><h2>What this record excludes</h2></div></div><p>Organization-private Talent List status and private employer hiring notes are intentionally excluded. The Master Record contains canonical identity, attributable employment records, Cognitus assessments, reviewed reports, disputes, appeals, and authorized access context.</p></article></section>
    <section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Timeline</p><h2>Person-level chronology</h2></div></div>${timeline.length ? `<div class="f19-timeline">${timeline.slice(0,80).map((item)=>`<article><small>${escapeHtml(item.type)} · ${escapeHtml(formatTimestamp(item.at) !== "—" ? formatTimestamp(item.at) : clean(item.at))}</small><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></article>`).join("")}</div>` : emptyState("No timeline events.","Employment and reviewed-record events will appear here.")}</section>
    ${isAdmin() ? `<section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Audit</p><h2>Direct profile activity</h2></div>${button(`#/audit?target=${encodeURIComponent(profile.id)}`,"Open Audit Center")}</div>${auditRows.length ? `<div class="f19-list">${auditRows.sort((a,b)=>timestampMs(b.createdAt)-timestampMs(a.createdAt)).slice(0,20).map((row)=>`<article class="f19-row"><div><strong>${escapeHtml(row.action)}</strong><span>${escapeHtml(row.summary || "")}</span><small>${escapeHtml(row.actorCognitusId || row.actorUid)} · ${escapeHtml(formatTimestamp(row.createdAt))}</small></div></article>`).join("")}</div>` : emptyState("No direct audit rows.","Related actions may be recorded against reports, employment records, or organization records instead.")}</section>` : ""}
  </main>`;
}

function duplicateGroups(profiles) {
  const buckets = new Map();
  for (const profile of profiles.filter((row) => !row.mergedIntoProfileId && lower(row.identityStatus) !== "merged")) {
    for (const id of uniq(profile.discordIds || [], 10)) {
      const key = `discord-id:${id}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(profile);
    }
    for (const username of uniqLower(profile.discordUsernames || [profile.discordUsername], 10)) {
      const key = `discord:${username}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(profile);
    }
    for (const username of uniqLower(profile.robloxUsernames || [profile.robloxUsername], 10)) {
      const key = `roblox:${username}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(profile);
    }
  }
  const pairs = new Map();
  for (const [key, rows] of buckets.entries()) {
    const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];
    if (uniqueRows.length < 2) continue;
    for (let i = 0; i < uniqueRows.length; i++) for (let j = i + 1; j < uniqueRows.length; j++) {
      const pairKey = [uniqueRows[i].id, uniqueRows[j].id].sort().join("__");
      const existing = pairs.get(pairKey) || { a: uniqueRows[i], b: uniqueRows[j], signals: [] };
      existing.signals.push(key);
      pairs.set(pairKey, existing);
    }
  }
  return [...pairs.values()].sort((a,b)=>b.signals.length-a.signals.length);
}
async function renderPeopleIntegrity() {
  if (!isOwner()) {
    root.innerHTML = `<main class="f19-shell">${hero("People Integrity","Owner access required.","Canonical profile merges can affect reports, employment records, access grants, and candidate files, so this workflow is Owner-only.")}</main>`;
    return;
  }
  const profiles = await readAll("profiles").catch(() => []);
  const duplicates = duplicateGroups(profiles);
  const preSource = params().get("source") || "";
  const preTarget = params().get("target") || "";
  root.innerHTML = `<main class="f19-shell">${hero("People Integrity","One person. One canonical record.","Review likely duplicates, preview every merge, and preserve historical provenance instead of deleting records.",`<span>Possible duplicate pairs</span><strong>${duplicates.length}</strong><small>Exact identifiers are weighted highest.</small>`)}
    <section class="f19-grid two"><article class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Merge Tool</p><h2>Preview a canonical merge</h2><p>The source becomes historical. The target remains canonical.</p></div></div><form class="f19-form" data-f19-merge-preview-form><label>Source profile ID / Cognitus ID<input name="source" required value="${escapeHtml(preSource)}" placeholder="Profile to merge away"></label><label>Target canonical profile ID / Cognitus ID<input name="target" required value="${escapeHtml(preTarget)}" placeholder="Profile to keep"></label><label>Merge reason<textarea name="reason" rows="4" maxlength="1000" required placeholder="Explain why these records represent the same person."></textarea></label><button class="button button-dark" type="submit">Preview Merge</button></form><div data-f19-merge-preview></div></article>
    <article class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Guardrails</p><h2>Merge behavior</h2></div></div><div class="f19-list"><div class="f19-notice">Employment records, reports, summaries, disputes, access requests, claims, appeals, checks, and Talent List references are moved to the canonical profile where supported.</div><div class="f19-notice warn">Cognitus does not automatically overwrite the target's Professional Standing or Risk Level. Those remain authoritative reviewer decisions.</div><div class="f19-notice">The source profile is retained as a merged historical record and points to the canonical target.</div></div></article></section>
    <section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Detection</p><h2>Likely duplicate profiles</h2></div><span>${duplicates.length} pairs</span></div>${duplicates.length ? `<div class="f19-list">${duplicates.slice(0,80).map((pair)=>`<article class="f19-row"><div><strong>${escapeHtml(pair.a.displayName || pair.a.cognitusId)} ↔ ${escapeHtml(pair.b.displayName || pair.b.cognitusId)}</strong><span>${escapeHtml(pair.a.cognitusId || pair.a.id)} · ${escapeHtml(pair.b.cognitusId || pair.b.id)}</span><small>Signals: ${escapeHtml(pair.signals.join(", "))}</small></div><div class="f19-actions">${button(`#/people/master?profile=${encodeURIComponent(pair.a.id)}`,"Record A")}${button(`#/people/master?profile=${encodeURIComponent(pair.b.id)}`,"Record B")}${button(`#/people-integrity?source=${encodeURIComponent(pair.b.id)}&target=${encodeURIComponent(pair.a.id)}`,"Prepare Merge",true)}</div></article>`).join("")}</div>` : emptyState("No likely duplicates detected.","Exact Discord IDs and normalized Discord/Roblox usernames do not currently produce duplicate pairs.")}</section></main>`;
}
async function previewMerge(sourceRef, targetRef, reason) {
  const [source, target] = await Promise.all([resolveProfileReference(sourceRef), resolveProfileReference(targetRef)]);
  if (!source || !target) throw new Error("Both source and target profiles must exist.");
  if (source.id === target.id) throw new Error("Source and target cannot be the same profile.");
  if (source.mergedIntoProfileId || lower(source.identityStatus) === "merged") throw new Error("The source profile is already merged.");
  if (source.linkedUserId && source.linkedUserId !== target.linkedUserId) throw new Error("A separately linked account cannot be merged into a different linked profile. Keep the claimed account as the canonical target or resolve identity ownership first.");
  const related = await Promise.all([
    readWhere("employmentRecords","profileId","==",source.id).catch(()=>[]),
    readWhere("reports","subjectProfileId","==",source.id).catch(()=>[]),
    readWhere("screeningReportSummaries","subjectProfileId","==",source.id).catch(()=>[]),
    readWhere("employerCandidates","profileId","==",source.id).catch(()=>[]),
    readWhere("reportAccessRequests","subjectProfileId","==",source.id).catch(()=>[]),
    readWhere("reportAccessGrants","subjectProfileId","==",source.id).catch(()=>[]),
    readWhere("employmentRecordDisputes","profileId","==",source.id).catch(()=>[]),
    readWhere("claims","profileId","==",source.id).catch(()=>[]),
    readWhere("appeals","profileId","==",source.id).catch(()=>[]),
    readWhere("checkLogs","targetProfileId","==",source.id).catch(()=>[])
  ]);
  const labels = ["Employment","Reports","Summaries","Talent Lists","Access Requests","Access Grants","Employment Disputes","Claims","Appeals","Checks"];
  const counts = Object.fromEntries(labels.map((label,index)=>[label,related[index].length]));
  mergePreviewState = { source, target, reason: clean(reason).slice(0,1000), related, counts };
  return mergePreviewState;
}
function renderMergePreview(state) {
  const total = Object.values(state.counts).reduce((sum, value) => sum + value, 0);
  return `<div class="f19-card" style="margin-top:1rem"><div class="f19-section-head"><div><p class="eyebrow">Merge Preview</p><h3>${escapeHtml(state.source.displayName || state.source.cognitusId)} → ${escapeHtml(state.target.displayName || state.target.cognitusId)}</h3></div>${badge(`${total} references`,"warn")}</div><div class="f19-detail-grid">${Object.entries(state.counts).map(([label,count])=>`<div class="f19-detail"><span>${escapeHtml(label)}</span><strong>${count}</strong></div>`).join("")}</div><div class="f19-notice warn" style="margin-top:1rem">This is a high-impact canonical identity change. The source profile remains as historical provenance, but active references will move to the target.</div><div class="f19-actions" style="margin-top:1rem"><button class="button button-dark" type="button" data-f19-merge-execute>Merge Into Canonical Profile</button></div></div>`;
}
async function executeMerge() {
  if (!isOwner() || !mergePreviewState) throw new Error("Owner merge preview is required.");
  const { source, target, reason, related } = mergePreviewState;
  const [employment,reports,summaries,candidates,accessRequests,accessGrants,disputes,claims,appeals,checks] = related;
  const operationEstimate = 3 + employment.length + reports.length + summaries.length + candidates.length * 2 + accessRequests.length + accessGrants.length + disputes.length + claims.length + appeals.length + checks.length;
  if (operationEstimate > 430) throw new Error(`This merge touches about ${operationEstimate} writes. Split or review the record set before merging so the client stays below Firestore batch limits.`);
  const batch = Fire.writeBatch(db);
  const mergedAliases = uniq([...(target.knownAliases || []), source.displayName, ...(source.knownAliases || [])], 10);
  const discordUsernames = uniq([...(target.discordUsernames || []), ...(source.discordUsernames || [])], 10);
  const robloxUsernames = uniq([...(target.robloxUsernames || []), ...(source.robloxUsernames || [])], 10);
  const discordIds = uniq([...(target.discordIds || []), ...(source.discordIds || [])], 10);
  batch.update(Fire.doc(db,"profiles",target.id), {
    discordUsernames,
    discordUsernamesNormalized: uniqLower(discordUsernames,10),
    discordIds,
    robloxUsernames,
    robloxUsernamesNormalized: uniqLower(robloxUsernames,10),
    knownAliases: mergedAliases,
    canonicalProfileId: target.id,
    updatedAt: Fire.serverTimestamp()
  });
  batch.update(Fire.doc(db,"profiles",source.id), {
    canonicalProfileId: target.id,
    mergedIntoProfileId: target.id,
    mergedAt: Fire.serverTimestamp(),
    mergedByUid: authUser.uid,
    identityStatus: "merged",
    updatedAt: Fire.serverTimestamp()
  });
  batch.set(Fire.doc(db,"profileMergeMap",source.id), {
    sourceProfileId: source.id,
    targetProfileId: target.id,
    sourceCognitusId: source.cognitusId || "",
    targetCognitusId: target.cognitusId || "",
    reason,
    mergedByUid: authUser.uid,
    mergedAt: Fire.serverTimestamp()
  });
  for (const row of employment) batch.update(Fire.doc(db,"employmentRecords",row.id), { profileId: target.id, profileCognitusId: target.cognitusId || "", updatedAt: Fire.serverTimestamp() });
  for (const row of reports) batch.update(Fire.doc(db,"reports",row.id), { subjectProfileId: target.id, updatedAt: Fire.serverTimestamp() });
  for (const row of summaries) batch.update(Fire.doc(db,"screeningReportSummaries",row.id), { subjectProfileId: target.id, updatedAt: Fire.serverTimestamp() });
  for (const row of accessRequests) batch.update(Fire.doc(db,"reportAccessRequests",row.id), { subjectProfileId: target.id, updatedAt: Fire.serverTimestamp() });
  for (const row of accessGrants) batch.update(Fire.doc(db,"reportAccessGrants",row.id), { subjectProfileId: target.id, updatedAt: Fire.serverTimestamp() });
  for (const row of disputes) batch.update(Fire.doc(db,"employmentRecordDisputes",row.id), { profileId: target.id, updatedAt: Fire.serverTimestamp() });
  for (const row of claims) batch.update(Fire.doc(db,"claims",row.id), { profileId: target.id, updatedAt: Fire.serverTimestamp() });
  for (const row of appeals) batch.update(Fire.doc(db,"appeals",row.id), { profileId: target.id, updatedAt: Fire.serverTimestamp() });
  for (const row of checks) batch.update(Fire.doc(db,"checkLogs",row.id), { targetProfileId: target.id, updatedAt: Fire.serverTimestamp() });
  for (const row of candidates) {
    const newId = `${row.organizationId}__${target.id}`;
    const existing = await readDoc("employerCandidates",newId).catch(()=>null);
    if (existing) {
      const notes = uniq([existing.privateNotes,row.privateNotes],10).join("\n\n").slice(0,3000);
      const existingRank = PIPELINE_ORDER.indexOf(existing.pipelineStatus);
      const sourceRank = PIPELINE_ORDER.indexOf(row.pipelineStatus);
      batch.update(Fire.doc(db,"employerCandidates",newId), { pipelineStatus: sourceRank > existingRank ? row.pipelineStatus : existing.pipelineStatus, privateNotes: notes, updatedAt: Fire.serverTimestamp() });
    } else {
      batch.set(Fire.doc(db,"employerCandidates",newId), {
        id:newId,
        organizationId:row.organizationId,
        organizationCognitusId:row.organizationCognitusId || "",
        profileId:target.id,
        profileCognitusId:target.cognitusId || "",
        profileDisplayName:target.displayName || "Person",
        pipelineStatus:row.pipelineStatus || "considering",
        privateNotes:row.privateNotes || "",
        addedByUid:row.addedByUid,
        addedByCognitusId:row.addedByCognitusId,
        createdAt:row.createdAt || Fire.serverTimestamp(),
        updatedAt:Fire.serverTimestamp()
      });
    }
    batch.delete(Fire.doc(db,"employerCandidates",row.id));
  }
  await batch.commit();
  await writeAudit("PROFILE_MERGED","profile",target.id,`Merged ${source.cognitusId || source.id} into canonical profile ${target.cognitusId || target.id}.`,{sourceProfileId:source.id,targetProfileId:target.id});
  mergePreviewState = null;
}

function arraysEqual(a,b) {
  return JSON.stringify([...(a||[])].sort()) === JSON.stringify([...(b||[])].sort());
}
async function scanHealth() {
  let rulesReady = true;
  const [users, profiles, organizations, employerRequests, members, mergeMaps] = await Promise.all([
    readAll("users").catch(()=>[]),
    readAll("profiles").catch(()=>[]),
    readAll("organizations").catch(()=>[]),
    readAll("employerStatusRequests").catch(()=>[]),
    readAll("organizationMembers").catch(()=>{rulesReady=false;return[];}),
    readAll("profileMergeMap").catch(()=>{rulesReady=false;return[];})
  ]);
  const profileById = new Map(profiles.map((row)=>[row.id,row]));
  const orgById = new Map(organizations.map((row)=>[row.id,row]));
  const orgByCognitus = new Map(organizations.map((row)=>[row.cognitusId,row]));
  const memberById = new Map(members.map((row)=>[row.id,row]));
  const requestByUid = new Map(employerRequests.filter((row)=>row.status==="approved").map((row)=>[row.applicantUid,row]));
  const issues = [];
  const add = (issue) => issues.push({ id:`issue-${issues.length+1}`, ...issue });
  for (const user of users) {
    if (!profileById.has(user.id)) add({type:"missing-profile",severity:"bad",title:"User is missing the canonical account profile",detail:`${user.displayName || user.cognitusId} has users/${user.id} but no profiles/${user.id}.`,userId:user.id});
    if (user.organizationId && !orgById.has(user.organizationId)) {
      const legacy = orgByCognitus.get(user.organizationId);
      if (legacy) add({type:"normalize-user-org",severity:"warn",title:"Organization assignment uses a Cognitus ID instead of the document ID",detail:`${user.displayName || user.cognitusId} points to ${user.organizationId}.`,userId:user.id,organizationId:legacy.id});
      else add({type:"broken-user-org",severity:"bad",title:"Organization assignment points to a missing organization",detail:`${user.displayName || user.cognitusId} points to ${user.organizationId}.`,userId:user.id});
    }
    if (EMPLOYER_ROLES.has(user.role) && user.organizationId && orgById.has(user.organizationId) && !memberById.has(memberId(user.organizationId,user.id))) {
      add({type:"missing-membership",severity:"warn",title:"Employer account has no organization membership record",detail:`${user.displayName || user.cognitusId} can be migrated into granular employer permissions.`,userId:user.id,organizationId:user.organizationId});
    }
    const request = requestByUid.get(user.id);
    if (request && (user.organizationId !== request.organizationId || user.role === "user")) add({type:"sync-employer-status",severity:"warn",title:"Approved Employer Status is not synchronized to the account",detail:`${user.displayName || user.cognitusId} was approved for ${request.organizationName}.`,userId:user.id,requestId:request.id,organizationId:request.organizationId});
  }
  for (const profile of profiles) {
    const discord = uniq(profile.discordUsernames || [profile.discordUsername],10);
    const roblox = uniq(profile.robloxUsernames || [profile.robloxUsername],10);
    const discordNorm = uniqLower(discord,10);
    const robloxNorm = uniqLower(roblox,10);
    if (!arraysEqual(discordNorm, profile.discordUsernamesNormalized || []) || !arraysEqual(robloxNorm, profile.robloxUsernamesNormalized || []) || (!profile.canonicalProfileId && !profile.mergedIntoProfileId)) add({type:"normalize-profile",severity:"warn",title:"Profile search/canonical fields need normalization",detail:`${profile.displayName || profile.cognitusId} has legacy or incomplete normalized identity fields.`,profileId:profile.id});
  }
  for (const pair of duplicateGroups(profiles).slice(0,100)) add({type:"duplicate-profile",severity:pair.signals.some((s)=>s.startsWith("discord-id:"))?"bad":"warn",title:"Likely duplicate person records",detail:`${pair.a.cognitusId || pair.a.id} and ${pair.b.cognitusId || pair.b.id} share ${pair.signals.join(", ")}.`,sourceId:pair.b.id,targetId:pair.a.id});
  healthState = { rulesReady, users, profiles, organizations, employerRequests, members, mergeMaps, issues };
  return healthState;
}
async function renderSystemHealth() {
  if (!isOwner()) {
    root.innerHTML = `<main class="f19-shell">${hero("System Health","Owner access required.","Data-integrity repair can change canonical records and account assignments, so it is restricted to the Cognitus Owner.")}</main>`;
    return;
  }
  const state = await scanHealth();
  if (route() !== "/system-health") return;
  const bad = state.issues.filter((item)=>item.severity==="bad").length;
  const warn = state.issues.filter((item)=>item.severity==="warn").length;
  root.innerHTML = `<main class="f19-shell">${hero("System Health","Know what is broken before users do.","Owner diagnostics compare accounts, profiles, organization links, employer approvals, membership permissions, canonical fields, and duplicate identity signals.",`<span>Detected issues</span><strong>${state.issues.length}</strong><small>${bad} critical · ${warn} warnings</small>`)}
    ${!state.rulesReady ? `<div class="f19-notice bad"><strong>Foundation V19 rules are not deployed yet.</strong> Diagnostics can read the legacy model, but organizationMembers/profileMergeMap are unavailable until the generated V19 rules are deployed.</div>` : ""}
    <section class="f19-grid"><article class="f19-card f19-stat"><span>Users</span><strong>${state.users.length}</strong><small>registered accounts</small></article><article class="f19-card f19-stat"><span>Profiles</span><strong>${state.profiles.length}</strong><small>person records</small></article><article class="f19-card f19-stat"><span>Organizations</span><strong>${state.organizations.length}</strong><small>organization records</small></article></section>
    <section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Diagnostics</p><h2>Integrity findings</h2><p>Safe repairs change only the fields needed to restore the canonical model. Duplicate identities always require an explicit merge preview.</p></div><div class="f19-actions"><button class="button button-light" type="button" data-f19-health-rescan>Rescan</button><button class="button button-dark" type="button" data-f19-health-repair-all>Repair Safe Issues</button></div></div>${state.issues.length ? `<div class="f19-list">${state.issues.map((issue)=>`<article class="f19-issue is-${issue.severity}"><div class="f19-issue-mark">${issue.severity==="bad"?"!":"i"}</div><div><strong>${escapeHtml(issue.title)}</strong><p>${escapeHtml(issue.detail)}</p><small>${escapeHtml(humanize(issue.type))}</small></div><div>${issue.type==="duplicate-profile" ? button(`#/people-integrity?source=${encodeURIComponent(issue.sourceId)}&target=${encodeURIComponent(issue.targetId)}`,"Review Merge",true) : issue.type==="broken-user-org" ? badge("Manual Review","bad") : `<button class="button button-light" type="button" data-f19-repair="${escapeHtml(issue.id)}">Repair</button>`}</div></article>`).join("")}</div>` : emptyState("System checks are clean.","No current account/profile/organization integrity issue was detected.")}</section></main>`;
}
async function repairHealthIssue(issue) {
  if (!isOwner() || !healthState) throw new Error("Owner diagnostics are required.");
  if (!issue) throw new Error("Diagnostic issue no longer exists.");
  if (issue.type === "normalize-profile") {
    const profile = healthState.profiles.find((row)=>row.id===issue.profileId) || await readDoc("profiles",issue.profileId);
    const discord = uniq(profile.discordUsernames || [profile.discordUsername],10);
    const roblox = uniq(profile.robloxUsernames || [profile.robloxUsername],10);
    await Fire.updateDoc(Fire.doc(db,"profiles",profile.id), { discordUsernames:discord, discordUsernamesNormalized:uniqLower(discord,10), robloxUsernames:roblox, robloxUsernamesNormalized:uniqLower(roblox,10), canonicalProfileId:profile.mergedIntoProfileId || profile.id, updatedAt:Fire.serverTimestamp() });
    await writeAudit("PROFILE_NORMALIZED","profile",profile.id,"Normalized canonical profile search fields.");
  } else if (issue.type === "normalize-user-org") {
    await Fire.updateDoc(Fire.doc(db,"users",issue.userId), { organizationId:issue.organizationId, updatedAt:Fire.serverTimestamp() });
    await writeAudit("USER_ORGANIZATION_NORMALIZED","user",issue.userId,"Normalized organization assignment to Firestore document ID.",{organizationId:issue.organizationId});
  } else if (issue.type === "missing-membership") {
    const user = healthState.users.find((row)=>row.id===issue.userId) || await readDoc("users",issue.userId);
    const org = healthState.organizations.find((row)=>row.id===issue.organizationId) || await readDoc("organizations",issue.organizationId);
    const request = healthState.employerRequests.find((row)=>row.applicantUid===user.id && row.status==="approved");
    await Fire.setDoc(Fire.doc(db,"organizationMembers",memberId(org.id,user.id)),buildMembership(user,org,request?.positionTitle || "Employer Member",authUser.uid));
    await writeAudit("ORGANIZATION_MEMBER_REPAIRED","organization_member",memberId(org.id,user.id),"Created missing employer membership record.",{organizationId:org.id,userUid:user.id});
  } else if (issue.type === "sync-employer-status") {
    const user = healthState.users.find((row)=>row.id===issue.userId) || await readDoc("users",issue.userId);
    const org = healthState.organizations.find((row)=>row.id===issue.organizationId) || await readDoc("organizations",issue.organizationId);
    const request = healthState.employerRequests.find((row)=>row.id===issue.requestId);
    const batch = Fire.writeBatch(db);
    batch.update(Fire.doc(db,"users",user.id), { role:user.role==="user"?"verified_employer_member":user.role, organizationId:org.id, updatedAt:Fire.serverTimestamp() });
    const membership = buildMembership({...user,role:user.role==="user"?"verified_employer_member":user.role,organizationId:org.id},org,request?.positionTitle || "Employer Member",authUser.uid);
    batch.set(Fire.doc(db,"organizationMembers",membership.id),membership);
    await batch.commit();
    await writeAudit("EMPLOYER_STATUS_REPAIRED","user",user.id,"Synchronized approved Employer Status to account and membership.",{organizationId:org.id});
  } else if (issue.type === "missing-profile") {
    const user = healthState.users.find((row)=>row.id===issue.userId) || await readDoc("users",issue.userId);
    const now = Fire.serverTimestamp();
    await Fire.setDoc(Fire.doc(db,"profiles",user.id), { id:user.id,cognitusId:createCognitusId("PRF"),linkedUserId:user.id,type:"person",displayName:user.displayName||user.discordUsername||"User",robloxUsernames:[],robloxUsernamesNormalized:[],discordUsernames:[user.discordUsername].filter(Boolean),discordUsernamesNormalized:[lower(user.discordUsername)].filter(Boolean),discordIds:[user.discordId].filter(Boolean),knownAliases:[],claimedByUid:user.id,identityStatus:"self_declared",identityConfidence:0,professionalStanding:"unreviewed",riskLevel:"unreviewed",reportCount:0,appealCount:0,canonicalProfileId:user.id,createdAt:now,updatedAt:now });
    await writeAudit("MISSING_PROFILE_REPAIRED","profile",user.id,"Created missing canonical account profile.");
  }
}

async function resolveMemberOrganization() {
  const requested = params().get("org");
  if ((isAdmin() || isOwner()) && requested) return resolveOrganizationReference(requested);
  if (userDoc?.organizationId) return resolveOrganizationReference(userDoc.organizationId);
  return null;
}
function canManageMembersUi() {
  const perms = effectivePermissions();
  return isAdmin() || userDoc?.role === "org_admin" || perms.manageMembers === true;
}
async function renderOrganizationMembers() {
  if (!employerCapable() && !isAdmin()) {
    root.innerHTML = `<main class="f19-shell">${hero("Organization Members","Employer access required.","Membership management is available to verified employer organizations and Cognitus staff.")}</main>`;
    return;
  }
  const [org, organizations] = await Promise.all([
    resolveMemberOrganization(),
    isAdmin() ? readAll("organizations").catch(()=>[]) : Promise.resolve([])
  ]);
  if (!org) {
    root.innerHTML = `<main class="f19-shell">${hero("Organization Members","Choose an organization.","Your account does not currently resolve to an organization. Cognitus staff can choose one below.")}<section class="f19-section">${isAdmin() ? `<div class="f19-grid">${organizations.filter((row)=>row.verificationStatus==="verified").map((row)=>`<article class="f19-card"><h3>${escapeHtml(row.name)}</h3><p>${escapeHtml(row.cognitusId)}</p>${button(`#/employer/members?org=${encodeURIComponent(row.id)}`,"Manage Members",true)}</article>`).join("")}</div>` : emptyState("No organization attached.","Request Employer Status or ask Cognitus staff to repair the organization assignment.")}</section></main>`;
    return;
  }
  const [directUsers, legacyUsers, memberships, pendingApps] = await Promise.all([
    readWhere("users","organizationId","==",org.id).catch(()=>[]),
    org.cognitusId ? readWhere("users","organizationId","==",org.cognitusId).catch(()=>[]) : Promise.resolve([]),
    readWhere("organizationMembers","organizationId","==",org.id).catch(()=>[]),
    readWhere("employerStatusRequests","organizationId","==",org.id).catch(()=>[])
  ]);
  const users = [...new Map([...directUsers,...legacyUsers].map((row)=>[row.id,row])).values()].sort((a,b)=>clean(a.displayName).localeCompare(clean(b.displayName)));
  const memberMap = new Map(memberships.map((row)=>[row.userUid,row]));
  const manager = canManageMembersUi();
  const verifiedOrganizations = organizations.filter((row)=>row.verificationStatus==="verified").sort((a,b)=>clean(a.name).localeCompare(clean(b.name)));
  root.innerHTML = `<main class="f19-shell">${hero("Organization Members",org.name || "Employer Organization","Manage who represents this organization, what employer tools they can use, and removal requests.",`<span>Organization</span><strong>${escapeHtml(org.cognitusId || org.id)}</strong><small>${users.length} linked accounts · ${memberships.length} membership records</small>`)}
    ${isAdmin() && verifiedOrganizations.length ? `<section class="f19-section f19-print-hide"><div class="f19-toolbar"><strong>Staff organization switcher</strong><select data-f19-org-switch>${verifiedOrganizations.map((row)=>`<option value="${escapeHtml(row.id)}" ${row.id===org.id?"selected":""}>${escapeHtml(row.name)}</option>`).join("")}</select></div></section>` : ""}
    <section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Members</p><h2>Organization access</h2><p>Granular permissions are enforced by the Foundation V19 Firestore rules after deployment.</p></div>${badge(manager?"Management Enabled":"View Only",manager?"good":"info")}</div>${users.length ? `<div class="f19-list">${users.map((user)=>{const member=memberMap.get(user.id);const perms=member?.permissions||defaultPermissions();return `<article class="f19-card"><div class="f19-member-head"><div><strong>${escapeHtml(user.displayName||user.cognitusId)}</strong><span>${escapeHtml(user.cognitusId||user.id)} · ${escapeHtml(humanize(user.role))}</span><small>${escapeHtml(member?.positionTitle||"Legacy organization assignment")}</small></div>${badge(member?.memberStatus||"Legacy")}</div><div class="f19-member-permissions">${[["runChecks","Run Checks"],["manageTalent","Talent"],["addEmploymentRecords","Employment"],["requestReports","Reports"],["manageMembers","Members"]].map(([key,label])=>`<div class="f19-perm ${perms[key]?"on":""}">${label}</div>`).join("")}</div>${manager ? `<details style="margin-top:.8rem"><summary class="button button-light">Manage Access</summary><form class="f19-form" data-f19-member-form data-user-uid="${escapeHtml(user.id)}" style="margin-top:.8rem"><label>Position / title<input name="positionTitle" maxlength="100" value="${escapeHtml(member?.positionTitle||"Employer Member")}"></label><div class="f19-checks"><label class="f19-check"><input type="checkbox" name="runChecks" ${perms.runChecks?"checked":""}> Run Checks</label><label class="f19-check"><input type="checkbox" name="manageTalent" ${perms.manageTalent?"checked":""}> Manage Talent List</label><label class="f19-check"><input type="checkbox" name="addEmploymentRecords" ${perms.addEmploymentRecords?"checked":""}> Add Employment Records</label><label class="f19-check"><input type="checkbox" name="requestReports" ${perms.requestReports?"checked":""}> Request Full Reports</label><label class="f19-check"><input type="checkbox" name="manageMembers" ${perms.manageMembers?"checked":""} ${isAdmin()?"":"disabled"}> Manage Members</label></div><label>Member status<select name="memberStatus"><option value="active" ${member?.memberStatus==="active"||!member?"selected":""}>Active</option><option value="suspended" ${member?.memberStatus==="suspended"?"selected":""}>Suspended</option><option value="removal_requested" ${member?.memberStatus==="removal_requested"?"selected":""}>Removal Requested</option></select></label><div class="f19-actions"><button class="button button-dark" type="submit">Save Permissions</button>${member?.memberStatus!=="removal_requested"?`<button class="button button-light" type="button" data-f19-request-removal="${escapeHtml(user.id)}">Request Removal</button>`:""}${isAdmin()&&member?.memberStatus==="removal_requested"?`<button class="button button-danger" type="button" data-f19-finalize-removal="${escapeHtml(user.id)}">Finalize Removal</button>`:""}</div></form></details>` : ""}</article>`;}).join("")}</div>` : emptyState("No linked members.","No account currently points to this organization.")}</section>
    <section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Pending Applications</p><h2>Employer Status requests</h2></div></div>${pendingApps.filter((row)=>row.status==="pending").length ? `<div class="f19-list">${pendingApps.filter((row)=>row.status==="pending").map((row)=>`<article class="f19-row"><div><strong>${escapeHtml(row.applicantDisplayName)}</strong><span>${escapeHtml(row.positionTitle)}</span><small>${escapeHtml(formatTimestamp(row.submittedAt))}</small></div>${button("#/employer-status","Review Application",true)}</article>`).join("")}</div>` : emptyState("No pending applications.","Employer applications for this organization will appear here.")}</section></main>`;
}
async function saveMemberFromForm(form) {
  const org = await resolveMemberOrganization();
  if (!org) throw new Error("Organization could not be resolved.");
  const uid = form.dataset.userUid;
  const user = await readDoc("users",uid);
  if (!user) throw new Error("User no longer exists.");
  const id = memberId(org.id,uid);
  const existing = await readDoc("organizationMembers",id).catch(()=>null);
  const data = Object.fromEntries(new FormData(form).entries());
  const permissions = {
    runChecks:data.runChecks==="on",
    manageTalent:data.manageTalent==="on",
    addEmploymentRecords:data.addEmploymentRecords==="on",
    requestReports:data.requestReports==="on",
    manageMembers:isAdmin()?data.manageMembers==="on":Boolean(existing?.permissions?.manageMembers)
  };
  if (!existing) {
    const payload = buildMembership(user,org,data.positionTitle||"Employer Member",authUser.uid);
    payload.permissions = permissions;
    payload.memberStatus = ["active","suspended","removal_requested"].includes(data.memberStatus)?data.memberStatus:"active";
    await Fire.setDoc(Fire.doc(db,"organizationMembers",id),payload);
  } else {
    await Fire.updateDoc(Fire.doc(db,"organizationMembers",id), { displayName:user.displayName||existing.displayName, positionTitle:clean(data.positionTitle).slice(0,100), memberStatus:["active","suspended","removal_requested"].includes(data.memberStatus)?data.memberStatus:existing.memberStatus, permissions, removalRequestedByUid:data.memberStatus==="removal_requested"?(existing.removalRequestedByUid||authUser.uid):existing.removalRequestedByUid||null, removalRequestedAt:data.memberStatus==="removal_requested"?(existing.removalRequestedAt||Fire.serverTimestamp()):existing.removalRequestedAt||null, updatedAt:Fire.serverTimestamp() });
  }
  await writeAudit("ORGANIZATION_MEMBER_UPDATED","organization_member",id,`Updated employer permissions for ${user.displayName||user.cognitusId}.`,{organizationId:org.id,userUid:uid});
}
async function requestMemberRemoval(uid) {
  const org = await resolveMemberOrganization();
  const id = memberId(org.id,uid);
  const member = await readDoc("organizationMembers",id);
  if (!member) throw new Error("Create the membership record before requesting removal.");
  await Fire.updateDoc(Fire.doc(db,"organizationMembers",id), { memberStatus:"removal_requested", removalRequestedByUid:authUser.uid, removalRequestedAt:Fire.serverTimestamp(), updatedAt:Fire.serverTimestamp() });
  await writeAudit("ORGANIZATION_MEMBER_REMOVAL_REQUESTED","organization_member",id,"Requested organization member removal.",{organizationId:org.id,userUid:uid});
}
async function finalizeMemberRemoval(uid) {
  if (!isAdmin()) throw new Error("Admin or Owner access is required to finalize removal.");
  const org = await resolveMemberOrganization();
  const [member,user] = await Promise.all([readDoc("organizationMembers",memberId(org.id,uid)),readDoc("users",uid)]);
  if (!member || member.memberStatus!=="removal_requested") throw new Error("Member removal has not been requested.");
  if (!user) throw new Error("User no longer exists.");
  if (user.role==="owner") throw new Error("The Owner role cannot be demoted through organization membership removal.");
  const nextRole = ["verified_employer_member","org_admin"].includes(user.role)?"user":user.role;
  const batch = Fire.writeBatch(db);
  batch.update(Fire.doc(db,"users",uid), { role:nextRole, organizationId:null, updatedAt:Fire.serverTimestamp() });
  batch.update(Fire.doc(db,"organizationMembers",member.id), { memberStatus:"removed", removedByUid:authUser.uid, removedAt:Fire.serverTimestamp(), updatedAt:Fire.serverTimestamp() });
  await batch.commit();
  await writeAudit("ORGANIZATION_MEMBER_REMOVED","organization_member",member.id,"Finalized organization member removal.",{organizationId:org.id,userUid:uid});
}

async function queryAudit(data) {
  const field = clean(data.field);
  const value = clean(data.value);
  let constraints = [];
  if (field === "date") {
    const from = data.from ? new Date(`${data.from}T00:00:00`) : new Date(Date.now()-7*86400000);
    const to = data.to ? new Date(`${data.to}T23:59:59`) : new Date();
    constraints = [Fire.where("createdAt",">=",Fire.Timestamp.fromDate(from)),Fire.where("createdAt","<=",Fire.Timestamp.fromDate(to)),Fire.limit(500)];
  } else if (field === "profileCognitusId") {
    const profile = await resolveProfileReference(value);
    if (!profile) return [];
    constraints = [Fire.where("targetId","==",profile.id),Fire.limit(500)];
  } else {
    const allowed = new Set(["actorCognitusId","action","targetId","targetType"]);
    if (!allowed.has(field) || !value) return [];
    constraints = [Fire.where(field,"==",value),Fire.limit(500)];
  }
  const snap = await Fire.getDocs(Fire.query(Fire.collection(db,"auditLogs"),...constraints));
  return snap.docs.map((doc)=>({...doc.data(),id:doc.id})).sort((a,b)=>timestampMs(b.createdAt)-timestampMs(a.createdAt));
}
async function renderAuditCenter() {
  if (!isAdmin()) {
    root.innerHTML = `<main class="f19-shell">${hero("Audit Center","Admin access required.","Cognitus audit search contains sensitive operational activity and is restricted to Admin and Owner accounts.")}</main>`;
    return;
  }
  const target = params().get("target") || "";
  root.innerHTML = `<main class="f19-shell">${hero("Audit Center","Reconstruct sensitive activity.","Search one indexed dimension at a time, then sort and inspect results in the browser—no composite Firestore indexes required.",`<span>Audit model</span><strong>Client-authenticated</strong><small>Traceable, but not a server-tamper-proof ledger.</small>`)}
    <section class="f19-grid two"><article class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Search</p><h2>Find audit events</h2></div></div><form class="f19-form" data-f19-audit-form><label>Search dimension<select name="field"><option value="date">Date range</option><option value="actorCognitusId">Actor Cognitus ID</option><option value="action">Action code</option><option value="targetId" ${target?"selected":""}>Target document ID</option><option value="profileCognitusId">Person Cognitus ID</option><option value="targetType">Target type</option></select></label><label>Exact value<input name="value" value="${escapeHtml(target)}" placeholder="Required except for date range"></label><div class="f19-form-grid"><label>From<input type="date" name="from"></label><label>Through<input type="date" name="to"></label></div><button class="button button-dark" type="submit">Search Audit</button></form></article><article class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Examples</p><h2>Useful searches</h2></div></div><div class="f19-list"><div class="f19-notice">Use <strong>Person Cognitus ID</strong> to resolve a person profile and find events targeted directly at that profile.</div><div class="f19-notice">Use <strong>Action code</strong> for events such as PROFILE_MERGED, EMPLOYMENT_RECORD_CREATED, OWNER_REPORT_ACCESS_GRANTED, or EMPLOYER_STATUS_APPROVED.</div><div class="f19-notice">Report and employment record investigations work best with their Firestore document ID under Target document ID.</div></div></article></section><section class="f19-section" data-f19-audit-results>${emptyState("Run an audit search.","Results are intentionally not loaded globally on page open, which keeps the Audit Center fast as the log grows.")}</section></main>`;
  if (target) {
    const form = root.querySelector("[data-f19-audit-form]");
    form?.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
  }
}
function renderAuditResults(rows) {
  const target = root.querySelector("[data-f19-audit-results]");
  if (!target) return;
  target.innerHTML = `<div class="f19-section-head"><div><p class="eyebrow">Results</p><h2>${rows.length} audit event${rows.length===1?"":"s"}</h2></div></div>${rows.length ? `<div class="f19-list">${rows.map((row)=>`<article class="f19-row"><div><strong>${escapeHtml(row.action||"ACTION")}</strong><span>${escapeHtml(row.summary||"")}</span><small>${escapeHtml(row.actorCognitusId||row.actorUid||"Unknown")} · ${escapeHtml(formatTimestamp(row.createdAt))}</small><small class="f19-code">${escapeHtml(row.targetType||"target")}: ${escapeHtml(row.targetId||"—")}</small></div>${badge(row.actorRole||"user")}</article>`).join("")}</div>` : emptyState("No matching audit events.","Try another exact identifier, action, target type, or date range.")}`;
}

function jsonSafe(value) {
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    if (typeof value.toDate === "function") return value.toDate().toISOString();
    return Object.fromEntries(Object.entries(value).map(([key,val])=>[key,jsonSafe(val)]));
  }
  return value;
}
async function collectPrivacySnapshot() {
  const profiles = await getOwnProfiles();
  const ids = profiles.map((row)=>row.id);
  const [employment,reports,disputes,claims,appeals,accessRequests,privacyRequests,ownerGrants] = await Promise.all([
    readForProfileIds("employmentRecords","profileId",ids),
    readForProfileIds("reports","subjectProfileId",ids).catch(()=>[]),
    readWhere("employmentRecordDisputes","applicantUid","==",authUser.uid).catch(()=>[]),
    readWhere("claims","submittedByUid","==",authUser.uid).catch(()=>[]),
    readWhere("appeals","submittedByUid","==",authUser.uid).catch(()=>[]),
    readWhere("reportAccessRequests","requesterUid","==",authUser.uid).catch(()=>[]),
    readWhere("privacyRequests","requesterUid","==",authUser.uid).catch(()=>[]),
    readWhere("ownerReportAccessGrants","granteeUid","==",authUser.uid).catch(()=>[])
  ]);
  const inboundGroups = await Promise.all(ids.map((id)=>readWhere("reportAccessRequests","subjectProfileId","==",id).catch(()=>[])));
  return { generatedAt:new Date().toISOString(),user:userDoc,profiles,employmentRecords:employment,reports,employmentDisputes:disputes,claims,appeals,outboundReportAccessRequests:accessRequests,inboundReportAccessRequests:inboundGroups.flat(),privacyRequests,ownerReportAccessGrants:ownerGrants };
}
async function renderPrivacyCenter() {
  const [snapshot, portal, queue] = await Promise.all([
    collectPrivacySnapshot(),
    readDoc("settings","portal").catch(()=>null),
    isAdmin()?readWhere("privacyRequests","status","==","pending").catch(()=>[]):Promise.resolve([])
  ]);
  privacySnapshotState = snapshot;
  const policy = { ...DEFAULT_RETENTION, ...(portal?.retentionPolicy || {}) };
  root.innerHTML = `<main class="f19-shell">${hero("Data & Privacy","Your Cognitus data should be understandable.","See what Cognitus stores, distinguish private employer notes from shared records, export your own data snapshot, and request correction, review, or deletion.",`<span>Your linked person records</span><strong>${snapshot.profiles.length}</strong><small>${snapshot.employmentRecords.length} employment records · ${snapshot.reports.length} reports readable by you</small>`)}
    <section class="f19-grid"><article class="f19-card f19-stat"><span>Employment Records</span><strong>${snapshot.employmentRecords.length}</strong><small>attributable shared records</small></article><article class="f19-card f19-stat"><span>Reports</span><strong>${snapshot.reports.length}</strong><small>records you can currently read</small></article><article class="f19-card f19-stat"><span>Privacy Requests</span><strong>${snapshot.privacyRequests.length}</strong><small>submitted by this account</small></article></section>
    <section class="f19-grid two"><article class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Your Data</p><h2>Portable account snapshot</h2></div></div><p>Cognitus can assemble your account, linked profiles, employment records, readable reports, disputes, claims, appeals, and report-access records into a local JSON snapshot.</p><button class="button button-dark" type="button" data-f19-download-data>Prepare My Data Snapshot</button></article><article class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Visibility</p><h2>Shared vs. private</h2></div></div><div class="f19-list"><div class="f19-notice"><strong>Shared:</strong> canonical identity data, attributable employment records, Cognitus assessments, reviewed screening summaries, and authorized report content.</div><div class="f19-notice warn"><strong>Organization-private:</strong> Talent List pipeline status and private candidate notes are not included in your public/shared Master Record or Full Report.</div></div></article></section>
    <section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Requests</p><h2>Correction, review, or deletion</h2><p>Deletion requests are reviewed before action because Cognitus may need to retain attributable records, safety records, or audit history where appropriate.</p></div></div><form class="f19-form" data-f19-privacy-form><label>Request type<select name="requestType"><option value="correction">Correction Review</option><option value="data_review">Data / Privacy Review</option><option value="deletion">Account Deletion Request</option></select></label><label>Statement<textarea name="statement" minlength="10" maxlength="3000" rows="5" required placeholder="Explain what should be reviewed or changed."></textarea></label><button class="button button-dark" type="submit">Submit Privacy Request</button></form><div style="margin-top:1rem">${snapshot.privacyRequests.length ? `<div class="f19-list">${snapshot.privacyRequests.sort((a,b)=>timestampMs(b.createdAt)-timestampMs(a.createdAt)).map((row)=>`<article class="f19-row"><div><strong>${escapeHtml(humanize(row.requestType))}</strong><span>${escapeHtml(row.statement)}</span><small>${escapeHtml(row.cognitusId||row.id)} · ${escapeHtml(formatTimestamp(row.createdAt))}</small></div>${badge(row.status)}</article>`).join("")}</div>` : emptyState("No privacy requests.","Your submitted privacy requests and their review status will appear here.")}</div></section>
    <section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Retention</p><h2>Current retention policy</h2></div></div><div class="f19-detail-grid"><div class="f19-detail"><span>Closed workflows</span><strong>${Number(policy.closedWorkflowDays)} days</strong></div><div class="f19-detail"><span>Audit activity</span><strong>${Number(policy.auditDays)} days</strong></div><div class="f19-detail"><span>Inactive accounts</span><strong>${Number(policy.inactiveAccountDays)} days before review</strong></div><div class="f19-detail"><span>Automation</span><strong>Manual review</strong></div></div><p>Cognitus currently runs without Cloud Functions, so retention periods are policy targets and Owner/Admin review points rather than invisible automatic deletion jobs.</p>${isOwner()?`<details><summary class="button button-light">Edit Retention Policy</summary><form class="f19-form" data-f19-retention-form style="margin-top:1rem"><div class="f19-form-grid"><label>Closed workflow days<input type="number" min="30" max="3650" name="closedWorkflowDays" value="${Number(policy.closedWorkflowDays)}"></label><label>Audit days<input type="number" min="90" max="3650" name="auditDays" value="${Number(policy.auditDays)}"></label></div><label>Inactive account review days<input type="number" min="30" max="3650" name="inactiveAccountDays" value="${Number(policy.inactiveAccountDays)}"></label><button class="button button-dark" type="submit">Save Retention Policy</button></form></details>`:""}</section>
    ${isAdmin()?`<section class="f19-section"><div class="f19-section-head"><div><p class="eyebrow">Staff Review</p><h2>Pending privacy requests</h2></div><span>${queue.length} pending</span></div>${queue.length?`<div class="f19-list">${queue.map((row)=>`<article class="f19-card"><div class="f19-member-head"><div><strong>${escapeHtml(row.requesterCognitusId)}</strong><span>${escapeHtml(humanize(row.requestType))}</span></div>${badge(row.status)}</div><p>${escapeHtml(row.statement)}</p><label>Reviewer notes<textarea data-f19-privacy-notes="${escapeHtml(row.id)}" rows="3" maxlength="1500"></textarea></label><div class="f19-actions"><button class="button button-dark" type="button" data-f19-privacy-decision="accepted" data-id="${escapeHtml(row.id)}">Accept for Action</button><button class="button button-light" type="button" data-f19-privacy-decision="denied" data-id="${escapeHtml(row.id)}">Deny</button></div></article>`).join("")}</div>`:emptyState("Queue clear.","No privacy requests currently need staff review.")}</section>`:""}</main>`;
}
async function createPrivacyRequest(data) {
  const ref = Fire.doc(Fire.collection(db,"privacyRequests"));
  await Fire.setDoc(ref,{id:ref.id,cognitusId:createCognitusId("PVR"),requesterUid:authUser.uid,requesterCognitusId:userDoc.cognitusId,requestType:data.requestType,statement:clean(data.statement).slice(0,3000),status:"pending",reviewedByUid:null,reviewerNotes:"",decidedAt:null,createdAt:Fire.serverTimestamp(),updatedAt:Fire.serverTimestamp()});
  await writeAudit("PRIVACY_REQUEST_CREATED","privacy_request",ref.id,`Submitted ${data.requestType} privacy request.`);
}
async function decidePrivacyRequest(id,status,notes) {
  if (!isAdmin()) throw new Error("Admin access is required.");
  await Fire.updateDoc(Fire.doc(db,"privacyRequests",id),{status,reviewedByUid:authUser.uid,reviewerNotes:clean(notes).slice(0,1500),decidedAt:Fire.serverTimestamp(),updatedAt:Fire.serverTimestamp()});
  await writeAudit("PRIVACY_REQUEST_DECIDED","privacy_request",id,`${humanize(status)} privacy request.`);
}
async function saveRetentionPolicy(data) {
  if (!isOwner()) throw new Error("Owner access is required.");
  const policy = {
    closedWorkflowDays:Math.max(30,Math.min(3650,Number(data.closedWorkflowDays)||DEFAULT_RETENTION.closedWorkflowDays)),
    auditDays:Math.max(90,Math.min(3650,Number(data.auditDays)||DEFAULT_RETENTION.auditDays)),
    inactiveAccountDays:Math.max(30,Math.min(3650,Number(data.inactiveAccountDays)||DEFAULT_RETENTION.inactiveAccountDays))
  };
  await Fire.setDoc(Fire.doc(db,"settings","portal"),{retentionPolicy:policy,retentionPolicyUpdatedAt:Fire.serverTimestamp(),retentionPolicyUpdatedByUid:authUser.uid},{merge:true});
  await writeAudit("RETENTION_POLICY_UPDATED","settings","portal","Updated Cognitus retention policy targets.",policy);
}
function downloadPrivacySnapshot() {
  if (!privacySnapshotState) return;
  const blob = new Blob([JSON.stringify(jsonSafe(privacySnapshotState),null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cognitus-data-${userDoc.cognitusId||authUser.uid}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function renderFoundationRoute() {
  const current = route();
  if (!FOUNDATION_ROUTES.has(current)) return;
  const token = ++renderSequence;
  if (!authUser || !userDoc) {
    root.innerHTML = `<main class="f19-shell">${hero("Login Required","Sign in to continue.","Foundation tools operate on authenticated Cognitus records.",button("#/login","Login",true))}</main>`;
    return;
  }
  if (!isActive()) {
    root.innerHTML = `<main class="f19-shell">${hero("Account Restricted","This account is not active.",`Current account status: ${humanize(userDoc.status)}.`)}</main>`;
    return;
  }
  try {
    if (current === "/actions") await renderActionCenter();
    else if (current === "/people/master") await renderMasterRecord();
    else if (current === "/people-integrity") await renderPeopleIntegrity();
    else if (current === "/employer/members") await renderOrganizationMembers();
    else if (current === "/system-health") await renderSystemHealth();
    else if (current === "/audit") await renderAuditCenter();
    else if (current === "/privacy-center") await renderPrivacyCenter();
  } catch (error) {
    if (token !== renderSequence || route() !== current) return;
    root.innerHTML = `<main class="f19-shell">${hero("Foundation Error","This workspace could not load.",error?.message||"Unknown Foundation V19 error.")}<div class="f19-notice bad">${escapeHtml(error?.message||"Unknown error")}</div></main>`;
  }
  if (token === renderSequence && route() === current) {
    document.title = `${current === "/actions" ? "Action Center" : current === "/privacy-center" ? "Data & Privacy" : current === "/audit" ? "Audit Center" : current === "/system-health" ? "System Health" : current === "/people-integrity" ? "People Integrity" : current === "/employer/members" ? "Organization Members" : "Master Record"} · Cognitus Solutions`;
    root?.focus();
  }
}

async function handleRootSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.matches("[data-f19-merge-preview-form]")) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const target = root.querySelector("[data-f19-merge-preview]");
    try { const state = await previewMerge(data.source,data.target,data.reason); target.innerHTML=renderMergePreview(state); }
    catch(error){ target.innerHTML=`<div class="f19-notice bad" style="margin-top:1rem">${escapeHtml(error?.message||"Merge preview failed.")}</div>`; }
  } else if (form.matches("[data-f19-member-form]")) {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    if(submit) submit.disabled=true;
    try{await saveMemberFromForm(form);await renderOrganizationMembers();await refreshActionCount();}
    catch(error){window.alert(error?.message||"Membership could not be saved.");if(submit)submit.disabled=false;}
  } else if (form.matches("[data-f19-audit-form]")) {
    event.preventDefault();
    const target = root.querySelector("[data-f19-audit-results]");
    target.innerHTML=`<div class="f19-empty">Searching audit events…</div>`;
    try{renderAuditResults(await queryAudit(Object.fromEntries(new FormData(form).entries())));}
    catch(error){target.innerHTML=`<div class="f19-notice bad">${escapeHtml(error?.message||"Audit search failed.")}</div>`;}
  } else if (form.matches("[data-f19-privacy-form]")) {
    event.preventDefault();
    const data=Object.fromEntries(new FormData(form).entries());
    try{await createPrivacyRequest(data);await renderPrivacyCenter();await refreshActionCount();}
    catch(error){window.alert(error?.message||"Privacy request failed.");}
  } else if (form.matches("[data-f19-retention-form]")) {
    event.preventDefault();
    try{await saveRetentionPolicy(Object.fromEntries(new FormData(form).entries()));await renderPrivacyCenter();}
    catch(error){window.alert(error?.message||"Retention policy could not be saved.");}
  }
}
async function handleRootClick(event) {
  const repair = event.target.closest?.("[data-f19-repair]");
  if (repair) {
    repair.disabled=true;
    try{const issue=healthState?.issues.find((row)=>row.id===repair.dataset.f19Repair);await repairHealthIssue(issue);await renderSystemHealth();}
    catch(error){window.alert(error?.message||"Repair failed.");repair.disabled=false;}
    return;
  }
  if (event.target.closest?.("[data-f19-health-rescan]")) { healthState=null; await renderSystemHealth(); return; }
  if (event.target.closest?.("[data-f19-health-repair-all]")) {
    const btn=event.target.closest("[data-f19-health-repair-all]");btn.disabled=true;
    try{const safe=(healthState?.issues||[]).filter((row)=>!["duplicate-profile","broken-user-org"].includes(row.type)).slice(0,100);for(const issue of safe)await repairHealthIssue(issue);await writeAudit("SYSTEM_HEALTH_REPAIR_BATCH","system","health",`Repaired ${safe.length} safe Foundation V19 integrity issues.`);await renderSystemHealth();}
    catch(error){window.alert(error?.message||"Safe repair batch stopped.");btn.disabled=false;}
    return;
  }
  if (event.target.closest?.("[data-f19-merge-execute]")) {
    const btn=event.target.closest("[data-f19-merge-execute]");
    if(!window.confirm("Merge the source profile into the canonical target? This moves active references and preserves the source only as merged provenance."))return;
    btn.disabled=true;
    try{const targetId=mergePreviewState?.target?.id;await executeMerge();location.hash=`#/people/master?profile=${encodeURIComponent(targetId)}`;}
    catch(error){window.alert(error?.message||"Merge failed.");btn.disabled=false;}
    return;
  }
  const removal = event.target.closest?.("[data-f19-request-removal]");
  if(removal){removal.disabled=true;try{await requestMemberRemoval(removal.dataset.f19RequestRemoval);await renderOrganizationMembers();await refreshActionCount();}catch(error){window.alert(error?.message||"Removal request failed.");removal.disabled=false;}return;}
  const finalize = event.target.closest?.("[data-f19-finalize-removal]");
  if(finalize){if(!window.confirm("Finalize this member's removal from the organization?"))return;finalize.disabled=true;try{await finalizeMemberRemoval(finalize.dataset.f19FinalizeRemoval);await renderOrganizationMembers();await refreshActionCount();}catch(error){window.alert(error?.message||"Removal could not be finalized.");finalize.disabled=false;}return;}
  if(event.target.closest?.("[data-f19-download-data]")){downloadPrivacySnapshot();return;}
  const privacyDecision=event.target.closest?.("[data-f19-privacy-decision]");
  if(privacyDecision){privacyDecision.disabled=true;const notes=root.querySelector(`[data-f19-privacy-notes="${CSS.escape(privacyDecision.dataset.id)}"]`)?.value||"";try{await decidePrivacyRequest(privacyDecision.dataset.id,privacyDecision.dataset.f19PrivacyDecision,notes);await renderPrivacyCenter();await refreshActionCount();}catch(error){window.alert(error?.message||"Privacy decision failed.");privacyDecision.disabled=false;}return;}
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
    userDoc = user ? await readDoc("users",user.uid).catch(()=>null) : null;
    ownMemberDoc = null;
    if (userDoc) await ensureOwnMembership();
    ensureFoundationNav();
    await refreshActionCount();
    await renderFoundationRoute();
  });
  window.addEventListener("hashchange", async () => {
    closeOperationsMenu();
    ensureFoundationNav();
    await renderFoundationRoute();
  });
  window.addEventListener("pageshow", () => { ensureFoundationNav(); renderFoundationRoute(); });
  nav?.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-f19-ops-button]");
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      const ops = button.closest("[data-f19-ops]");
      const open = !ops.classList.contains("is-open");
      ops.classList.toggle("is-open",open);
      button.setAttribute("aria-expanded",String(open));
    } else if (event.target.closest?.("a")) closeOperationsMenu();
  });
  document.addEventListener("click", (event) => {
    const ops = nav?.querySelector("[data-f19-ops]");
    if (ops && !ops.contains(event.target)) closeOperationsMenu();
  });
  root?.addEventListener("submit",handleRootSubmit);
  root?.addEventListener("click",handleRootClick);
  root?.addEventListener("change",(event)=>{if(event.target.matches?.("[data-f19-org-switch]"))location.hash=`#/employer/members?org=${encodeURIComponent(event.target.value)}`;});
  ensureFoundationNav();
  await renderFoundationRoute();
}

initialize().catch((error)=>console.warn("Cognitus Foundation V19 failed to initialize",error));
