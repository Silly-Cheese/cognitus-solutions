import * as C from "./promo/promotionalCoreV26.js";
import { getFrenzyState, waitForFrenzyState } from "./frenzyV35.js";

const ROUTE = "/signal-zero";
const SESSION_KIND = "signal_zero_session";
const INIT_KEY_PREFIX = "cognitus.sz44.init.";
const REVIEWER_ROLES = new Set(["reviewer", "admin", "owner"]);
const SEVERITY_WEIGHT = { Informational: 0, Low: 1, Moderate: 2, High: 3, Critical: 4 };
const CAPABILITIES = Object.freeze({
  core: 25,
  correlation: 50,
  board: 75,
  brief: 90,
  zeroState: 100
});

let activeSessionRecord = null;
let activeProfile = null;
let activeAnalysis = null;
let activeTab = "command";
let renderToken = 0;

const clean = (value) => C.clean(value);
const lower = (value) => C.lower(value);
const safe = (value) => C.safe(value);

function mountStyles() {
  let link = document.querySelector("#cognitus-signal-zero-v44");
  if (!link) {
    link = document.createElement("link");
    link.id = "cognitus-signal-zero-v44";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = "./src/signalZeroV44.css?v=20260906-v44";
}

function createId(prefix = "SZ") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(7);
  crypto.getRandomValues(bytes);
  return `${prefix}-${String(new Date().getFullYear()).slice(-2)}-${Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("")}`;
}

function frenzyCapabilities(frenzy) {
  const level = Math.max(0, Math.min(100, Number(frenzy?.level || 0)));
  return {
    level,
    core: level >= CAPABILITIES.core,
    correlation: level >= CAPABILITIES.correlation,
    board: level >= CAPABILITIES.board,
    brief: level >= CAPABILITIES.brief,
    zeroState: level >= CAPABILITIES.zeroState
  };
}

function timestampMs(value) {
  return C.timestampMs(value);
}

function formatDateTime(value, fallback = "—") {
  const ms = timestampMs(value);
  return ms ? new Date(ms).toLocaleString() : fallback;
}

function isoDate(value) {
  const ms = timestampMs(value);
  return ms ? new Date(ms).toISOString() : null;
}

function daysBetween(a, b) {
  const aMs = typeof a === "number" ? a : timestampMs(a);
  const bMs = typeof b === "number" ? b : timestampMs(b);
  if (!aMs || !bMs) return Infinity;
  return Math.abs(aMs - bMs) / 86400000;
}

function capabilityLabel(capabilities) {
  if (capabilities.zeroState) return "ZERO STATE";
  if (capabilities.brief) return "BRIEF AUTHORIZED";
  if (capabilities.board) return "BOARD AUTHORIZED";
  if (capabilities.correlation) return "ADVANCED CORRELATION";
  if (capabilities.core) return "CORE ONLINE";
  return "STANDBY";
}

function countdownText(frenzy) {
  const end = timestampMs(frenzy?.endsAt);
  if (!end) return "Event window active";
  const ms = Math.max(0, end - Date.now());
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function confidenceRank(value) {
  return { Confirmed: 4, Corroborated: 3, Indicated: 2, Unresolved: 1 }[value] || 0;
}

function confidenceBadge(value) {
  const cls = lower(value).replace(/[^a-z]+/g, "-");
  return `<span class="sz44-confidence is-${safe(cls)}">${safe(value)}</span>`;
}

function sourceConfidence(source) {
  if (source.kind === "profile") return "Confirmed";
  if (source.status && ["approved", "published", "resolved", "verified", "active"].includes(lower(source.status))) return "Confirmed";
  if (source.kind === "screening_summary") return "Corroborated";
  if (source.kind === "derived") return "Indicated";
  return "Unresolved";
}

function sourceCoverage(sources) {
  if (!sources.length) return 0;
  const points = sources.reduce((total, source) => {
    let score = 0;
    if (source.id) score += 1;
    if (source.status) score += 1;
    if (source.date) score += 1;
    if (source.visibility || source.kind === "profile") score += 1;
    return total + score;
  }, 0);
  return Math.round((points / (sources.length * 4)) * 100);
}

function reportDate(row) {
  return row.reportCreatedAt || row.createdAt || row.reviewedAt || row.updatedAt || null;
}

function employmentRange(row) {
  const start = timestampMs(row.startedOn || row.startDate || row.createdAt);
  const end = timestampMs(row.endedOn || row.endDate) || Date.now();
  return { start, end };
}

function employmentOverlaps(rows) {
  const normalized = rows
    .map((row) => ({ row, ...employmentRange(row) }))
    .filter((entry) => entry.start && entry.end);
  const overlaps = [];
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const a = normalized[i];
      const b = normalized[j];
      if (!a.row.organizationId || a.row.organizationId === b.row.organizationId) continue;
      if (Math.max(a.start, b.start) <= Math.min(a.end, b.end)) {
        overlaps.push({ a: a.row, b: b.row, start: Math.max(a.start, b.start), end: Math.min(a.end, b.end) });
      }
    }
  }
  return overlaps;
}

function reportCluster(reports) {
  const dates = reports.map((row) => timestampMs(reportDate(row))).filter(Boolean).sort((a, b) => a - b);
  let max = 0;
  let range = null;
  for (let i = 0; i < dates.length; i += 1) {
    let count = 1;
    let end = dates[i];
    for (let j = i + 1; j < dates.length; j += 1) {
      if ((dates[j] - dates[i]) / 86400000 > 90) break;
      count += 1;
      end = dates[j];
    }
    if (count > max) {
      max = count;
      range = { start: dates[i], end };
    }
  }
  return { count: max, range };
}

async function authorizedReports(profile) {
  const full = REVIEWER_ROLES.has(C.userRecord?.role);
  if (full) {
    const rows = await C.safeReadWhere("reports", "subjectProfileId", "==", profile.id, 300);
    return { rows, full: true, collection: "reports" };
  }
  const rows = await C.safeReadWhere("screeningReportSummaries", "subjectProfileId", "==", profile.id, 300);
  return {
    rows: rows.filter((row) => ["screening", "public"].includes(lower(row.visibility))),
    full: false,
    collection: "screeningReportSummaries"
  };
}

async function loadOrganizations(ids) {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 40);
  const rows = await Promise.all(unique.map(async (id) => C.readDoc("organizations", id).catch(() => null)));
  return rows.filter(Boolean);
}

async function loadRelatedProfiles(organizationIds, subjectId) {
  if (!organizationIds.length) return [];
  const relatedEmployment = [];
  for (const organizationId of organizationIds.slice(0, 8)) {
    const rows = await C.safeReadWhere("employmentRecords", "organizationId", "==", organizationId, 120);
    rows.forEach((row) => relatedEmployment.push(row));
  }
  const profileIds = [...new Set(relatedEmployment.map((row) => row.profileId).filter((id) => id && id !== subjectId))].slice(0, 20);
  const profiles = await Promise.all(profileIds.map((id) => C.readDoc("profiles", id).catch(() => null)));
  return profiles.filter(Boolean);
}

function buildTimeline(profile, reports, employment, claims, appeals, investigations) {
  const events = [];
  employment.forEach((row) => {
    const start = row.startedOn || row.startDate || row.createdAt;
    const end = row.endedOn || row.endDate;
    if (timestampMs(start)) events.push({
      id: `employment-start-${row.id}`,
      type: "employment",
      date: start,
      title: "Employment record began",
      detail: `${clean(row.roleTitle || row.role || row.employmentType || "Role")} · ${clean(row.organizationName || row.organizationId || "Organization")}`,
      sourceId: row.id
    });
    if (timestampMs(end)) events.push({
      id: `employment-end-${row.id}`,
      type: "employment",
      date: end,
      title: "Employment record ended",
      detail: `${clean(row.roleTitle || row.role || row.employmentType || "Role")} · ${clean(row.organizationName || row.organizationId || "Organization")}`,
      sourceId: row.id
    });
  });
  reports.forEach((row) => {
    const date = reportDate(row);
    if (!timestampMs(date)) return;
    events.push({
      id: `report-${row.id}`,
      type: "report",
      date,
      title: "Reviewed report record",
      detail: `${clean(row.category || row.reportCategory || "Report")} · ${clean(row.severity || "Unspecified severity")}`,
      sourceId: row.id
    });
  });
  claims.forEach((row) => {
    const date = row.createdAt || row.updatedAt;
    if (!timestampMs(date)) return;
    events.push({ id: `claim-${row.id}`, type: "claim", date, title: "Claim activity", detail: clean(row.status || "Claim record"), sourceId: row.id });
  });
  appeals.forEach((row) => {
    const date = row.createdAt || row.updatedAt;
    if (!timestampMs(date)) return;
    events.push({ id: `appeal-${row.id}`, type: "appeal", date, title: "Appeal activity", detail: clean(row.status || "Appeal record"), sourceId: row.id });
  });
  investigations.forEach((row) => {
    const date = row.updatedAt || row.createdAt;
    if (!timestampMs(date)) return;
    events.push({ id: `investigation-${row.id}`, type: "investigation", date, title: "Saved investigation reference", detail: clean(row.title || "Investigation"), sourceId: row.id });
  });
  const profileDate = profile.updatedAt || profile.createdAt;
  if (timestampMs(profileDate)) events.push({
    id: `profile-${profile.id}`,
    type: "identity",
    date: profileDate,
    title: "Profile record updated",
    detail: `Identity status: ${clean(profile.identityStatus || "unreviewed")}`,
    sourceId: profile.id
  });
  return events.sort((a, b) => timestampMs(a.date) - timestampMs(b.date)).slice(-80);
}

function buildSources(profile, reportData, employment, claims, appeals, organizations) {
  const sources = [{
    id: profile.id,
    kind: "profile",
    label: `Profile ${profile.cognitusId || profile.id}`,
    status: profile.identityStatus || "profile",
    visibility: "Account-authorized profile",
    date: profile.updatedAt || profile.createdAt,
    route: `/intelligence?subject=${encodeURIComponent(profile.id)}`
  }];
  reportData.rows.forEach((row) => sources.push({
    id: row.id,
    kind: reportData.full ? "report" : "screening_summary",
    label: `${reportData.full ? "Report" : "Screening summary"} ${row.cognitusId || row.id}`,
    status: row.status || "available",
    visibility: row.visibility || (reportData.full ? "Authorized reviewer record" : "Screening-visible"),
    date: reportDate(row),
    route: `/intelligence-reports?subject=${encodeURIComponent(profile.id)}`
  }));
  employment.forEach((row) => sources.push({
    id: row.id,
    kind: "employment",
    label: `Employment ${row.cognitusId || row.id}`,
    status: row.status || row.rehireEligible || "recorded",
    visibility: "Authorized employment record",
    date: row.updatedAt || row.startedOn || row.createdAt,
    route: `/deep-history?subject=${encodeURIComponent(profile.id)}`
  }));
  claims.forEach((row) => sources.push({
    id: row.id,
    kind: "claim",
    label: `Claim ${row.cognitusId || row.id}`,
    status: row.status || "recorded",
    visibility: "Authorized claim record",
    date: row.updatedAt || row.createdAt,
    route: `/claims?profileId=${encodeURIComponent(profile.id)}`
  }));
  appeals.forEach((row) => sources.push({
    id: row.id,
    kind: "appeal",
    label: `Appeal ${row.cognitusId || row.id}`,
    status: row.status || "recorded",
    visibility: "Authorized appeal record",
    date: row.updatedAt || row.createdAt,
    route: `/appeals?profileId=${encodeURIComponent(profile.id)}`
  }));
  organizations.forEach((row) => sources.push({
    id: row.id,
    kind: "organization",
    label: row.name || row.cognitusId || row.id,
    status: row.verificationStatus || "organization",
    visibility: "Authorized organization record",
    date: row.updatedAt || row.createdAt,
    route: `/network?subject=${encodeURIComponent(profile.id)}`
  }));
  return sources.slice(0, 100).map((source) => ({ ...source, confidence: sourceConfidence(source) }));
}

function buildAnomalies({ profile, reports, employment, organizations, aliases, overlaps, cluster, relatedProfiles, claims, appeals }) {
  const anomalies = [];
  const severe = reports.filter((row) => Number(SEVERITY_WEIGHT[row.severity] || 0) >= 3);
  if (severe.length) anomalies.push({
    id: "reviewed-severity",
    title: "High-severity reviewed records present",
    detail: `${severe.length} authorized approved/published report${severe.length === 1 ? "" : "s"} are marked High or Critical. This identifies records for human review; it is not a finding about the subject.`,
    confidence: severe.length >= 2 ? "Corroborated" : "Confirmed",
    sourceIds: severe.map((row) => row.id).slice(0, 12)
  });
  if (overlaps.length) anomalies.push({
    id: "employment-overlap",
    title: "Cross-organization date overlap",
    detail: `${overlaps.length} employment-record pair${overlaps.length === 1 ? "" : "s"} overlap across different organizations. Concurrent roles may be legitimate; dates and role context should be confirmed.`,
    confidence: "Indicated",
    sourceIds: overlaps.flatMap((item) => [item.a.id, item.b.id]).filter(Boolean).slice(0, 16)
  });
  if (cluster.count >= 3) anomalies.push({
    id: "report-cluster",
    title: "Report activity cluster",
    detail: `${cluster.count} authorized report records occur within a 90-day window. Timing alone does not establish related conduct.`,
    confidence: "Indicated",
    sourceIds: reports.map((row) => row.id).slice(0, 16)
  });
  if (aliases.length >= 4) anomalies.push({
    id: "identity-footprint",
    title: "Expanded identity footprint",
    detail: `${aliases.length} unique alias or username markers are present. Confirm which identifiers are current before relying on identity-linked records.`,
    confidence: "Confirmed",
    sourceIds: [profile.id]
  });
  if (organizations.length >= 4) anomalies.push({
    id: "organization-footprint",
    title: "Broad organization footprint",
    detail: `${organizations.length} organizations appear in authorized employment context. Review role and date continuity before interpreting the pattern.`,
    confidence: "Confirmed",
    sourceIds: organizations.map((row) => row.id).slice(0, 12)
  });
  if (relatedProfiles.length >= 3) anomalies.push({
    id: "shared-org-correlation",
    title: "Shared-organization correlation available",
    detail: `${relatedProfiles.length} other profiles were discoverable through organization-scoped records this account was authorized to read. This is an association, not evidence of shared conduct.`,
    confidence: "Indicated",
    sourceIds: relatedProfiles.map((row) => row.id).slice(0, 12)
  });
  if (claims.length || appeals.length) anomalies.push({
    id: "correction-workflow",
    title: "Correction or dispute workflow exists",
    detail: `${claims.length} claim record${claims.length === 1 ? "" : "s"} and ${appeals.length} appeal record${appeals.length === 1 ? "" : "s"} are available. Review their status before relying on disputed records.`,
    confidence: "Confirmed",
    sourceIds: [...claims, ...appeals].map((row) => row.id).slice(0, 12)
  });
  if (!anomalies.length) anomalies.push({
    id: "no-defined-anomaly",
    title: "No defined anomaly condition detected",
    detail: "Signal Zero did not identify one of its defined cross-record conditions in the records currently available to this account. This is not a certification of completeness, safety, credibility, or suitability.",
    confidence: "Unresolved",
    sourceIds: [profile.id]
  });
  return anomalies;
}

async function buildAnalysis(profile, capabilities) {
  const [reportData, employment, claims, appeals, investigations] = await Promise.all([
    authorizedReports(profile),
    C.safeReadWhere("employmentRecords", "profileId", "==", profile.id, 300),
    C.safeReadWhere("claims", "profileId", "==", profile.id, 120),
    C.safeReadWhere("appeals", "profileId", "==", profile.id, 120),
    C.loadUserData("investigation").catch(() => [])
  ]);
  const reports = reportData.rows.filter((row) => !row.status || ["approved", "published", "resolved", "active"].includes(lower(row.status)));
  const organizationIds = [...new Set(employment.map((row) => row.organizationId).filter(Boolean))];
  const organizations = await loadOrganizations(organizationIds);
  const relatedProfiles = capabilities.correlation ? await loadRelatedProfiles(organizationIds, profile.id) : [];
  const aliases = [...new Set([
    ...(profile.knownAliases || []),
    ...(profile.discordUsernames || []),
    ...(profile.robloxUsernames || []),
    ...(profile.discordIds || [])
  ].map(clean).filter(Boolean))];
  const overlaps = employmentOverlaps(employment);
  const cluster = reportCluster(reports);
  const subjectInvestigations = investigations.filter((row) => row.subjectId === profile.id || row.payload?.subjectId === profile.id);
  const timeline = buildTimeline(profile, reports, employment, claims, appeals, subjectInvestigations);
  const sources = buildSources(profile, reportData, employment, claims, appeals, organizations);
  const anomalies = buildAnomalies({ profile, reports, employment, organizations, aliases, overlaps, cluster, relatedProfiles, claims, appeals });
  const unresolved = anomalies.filter((row) => row.confidence === "Unresolved").length;
  const pulse = {
    profiles: 1 + relatedProfiles.length,
    organizations: organizations.length,
    records: sources.length,
    anomalies: anomalies[0]?.id === "no-defined-anomaly" ? 0 : anomalies.length,
    unresolved,
    coverage: sourceCoverage(sources)
  };
  return {
    reportData,
    reports,
    employment,
    claims,
    appeals,
    organizations,
    aliases,
    relatedProfiles,
    overlaps,
    cluster,
    investigations: subjectInvestigations,
    timeline,
    sources,
    anomalies,
    pulse,
    generatedAt: new Date().toISOString()
  };
}

function compactAnalysis(profile, analysis) {
  return {
    subject: {
      id: profile.id,
      cognitusId: profile.cognitusId || "",
      displayName: profile.displayName || "Cognitus Subject",
      identityStatus: profile.identityStatus || "unreviewed"
    },
    pulse: analysis.pulse,
    anomalies: analysis.anomalies.slice(0, 20).map((row) => ({
      id: row.id,
      title: row.title,
      detail: row.detail,
      confidence: row.confidence,
      sourceIds: row.sourceIds || []
    })),
    timeline: analysis.timeline.slice(-60).map((row) => ({
      id: row.id,
      type: row.type,
      date: isoDate(row.date),
      title: row.title,
      detail: row.detail,
      sourceId: row.sourceId
    })),
    sources: analysis.sources.slice(0, 80).map((row) => ({
      id: row.id,
      kind: row.kind,
      label: row.label,
      status: row.status,
      visibility: row.visibility,
      date: isoDate(row.date),
      confidence: row.confidence,
      route: row.route
    })),
    organizations: analysis.organizations.slice(0, 30).map((row) => ({ id: row.id, name: row.name || row.cognitusId || row.id })),
    aliases: analysis.aliases.slice(0, 30),
    relatedProfiles: analysis.relatedProfiles.slice(0, 20).map((row) => ({ id: row.id, displayName: row.displayName || row.cognitusId || row.id, cognitusId: row.cognitusId || "" })),
    generatedAt: analysis.generatedAt
  };
}

async function loadSignalSessions() {
  const rows = await C.loadUserData("investigation").catch(() => []);
  return rows
    .filter((row) => row.payload?.kind === SESSION_KIND)
    .sort((a, b) => timestampMs(b.updatedAt || b.createdAt) - timestampMs(a.updatedAt || a.createdAt));
}

async function persistNewSession(profile, analysis, frenzy) {
  const sessionId = createId("SZ");
  const capabilities = frenzyCapabilities(frenzy);
  const payload = {
    kind: SESSION_KIND,
    sessionId,
    status: "active",
    frenzyEventId: clean(frenzy.eventId),
    subjectId: profile.id,
    createdLevel: capabilities.level,
    lastLevel: capabilities.level,
    operatorCognitusId: C.userRecord?.cognitusId || "",
    brief: null,
    pinnedFindingIds: [],
    snapshot: compactAnalysis(profile, analysis),
    lastAnalyzedAt: new Date().toISOString()
  };
  const recordId = await C.createUserData("investigation", {
    title: `${sessionId} · ${clean(profile.displayName || profile.cognitusId || "Signal Zero Subject")}`,
    subjectId: profile.id,
    payload
  });
  return { id: recordId, type: "investigation", title: `${sessionId} · ${profile.displayName || "Subject"}`, subjectId: profile.id, payload };
}

async function updateSession(record, changes) {
  if (!record?.id) return;
  const payload = { ...(record.payload || {}), ...changes };
  await C.updateUserData(record.id, { payload });
  record.payload = payload;
}

function initializationMarkup(step = 0) {
  const steps = [
    "AUTHORIZING SIGNAL ZERO",
    "VERIFYING FRENZY STATE",
    "VERIFYING FEATURE ENTITLEMENT",
    "ESTABLISHING SECURE SESSION",
    "SIGNAL ZERO ONLINE"
  ];
  return `<section class="sz44-init" data-sz44-init>
    <div class="sz44-init-mark">SZ</div>
    <p class="eyebrow">Restricted Intelligence Environment</p>
    <h1>Signal Zero</h1>
    <div class="sz44-init-list">${steps.map((label, index) => `<div class="${index < step ? "is-done" : index === step ? "is-current" : ""}"><span>${index < step ? "✓" : index === step ? "●" : "○"}</span>${safe(label)}</div>`).join("")}</div>
  </section>`;
}

async function runInitialization(frenzy) {
  const key = `${INIT_KEY_PREFIX}${clean(frenzy.eventId || "active")}`;
  if (sessionStorage.getItem(key) === "1") return;
  for (let i = 0; i < 5; i += 1) {
    if (C.currentRoute() !== ROUTE) return;
    C.root.innerHTML = initializationMarkup(i);
    await new Promise((resolve) => setTimeout(resolve, 70));
  }
  sessionStorage.setItem(key, "1");
}

function lockedCapability(title, level, body) {
  return `<article class="sz44-capability-lock"><span>${level}%</span><div><strong>${safe(title)}</strong><p>${safe(body)}</p></div></article>`;
}

function shellMarkup(feature, frenzy, sessions) {
  const caps = frenzyCapabilities(frenzy);
  const zero = caps.zeroState;
  C.setTitle(zero ? "Signal Zero · ZERO STATE" : feature.name);
  return `<div class="sz44-shell ${zero ? "is-zero-state" : ""}" data-promo-v26-page data-signal44-page>
    <header class="sz44-hero">
      <div class="sz44-identity">
        <div class="sz44-mark">SZ</div>
        <div><p class="eyebrow">Restricted Intelligence Environment</p><h1>Signal Zero</h1><p>Correlate only the Cognitus information this account is already authorized to review. Signal Zero organizes evidence and open questions; it does not issue guilt, credibility, hiring, or safety determinations.</p></div>
      </div>
      <aside class="sz44-session-status">
        <span class="sz44-live">● FRENZY AUTHORIZED</span>
        <strong>${safe(capabilityLabel(caps))}</strong>
        <small>Event ${safe(frenzy.eventId || "Active")}</small>
        <small>Window ${safe(countdownText(frenzy))}</small>
        <small>Operator ${safe(C.userRecord?.displayName || C.userRecord?.cognitusId || "Authorized account")}</small>
        <small>Clearance Promotional + Frenzy</small>
      </aside>
    </header>

    <section class="sz44-levelbar"><div><span>Frenzy capability level</span><strong>${caps.level}%</strong></div><div class="sz44-leveltrack"><span style="width:${caps.level}%"></span><i style="left:25%"></i><i style="left:50%"></i><i style="left:75%"></i><i style="left:90%"></i></div><div class="sz44-thresholds"><span>25 Core</span><span>50 Correlation</span><span>75 Board</span><span>90 Brief</span><span>100 Zero State</span></div></section>

    ${!caps.core ? `<section class="sz44-standby"><p class="eyebrow">Authorization Pending</p><h2>Signal Zero core comes online at 25% Frenzy.</h2><p>The Executive has opened the Signal Zero window, but the current Frenzy level is ${caps.level}%. No additional data becomes available at higher levels; only Signal Zero analytical modules activate.</p>${lockedCapability("Core Intelligence Fusion", 25, "Subject intelligence, provenance, timeline, anomalies, and persistent sessions.")}</section>` : `
      <nav class="sz44-tabs" aria-label="Signal Zero sections">
        ${[["command","Command Center"],["subject","Subject Intelligence"],["board","Signal Board"],["timeline","Timeline"],["anomalies","Anomalies"],["sources","Sources"],["brief","Zero Brief"]].map(([id,label])=>`<button type="button" data-sz44-tab="${id}" class="${activeTab===id?"is-active":""}">${label}</button>`).join("")}
      </nav>
      <section class="sz44-command" data-sz44-command>
        <form class="sz44-search" data-sz44-search>
          <label><span>Open subject intelligence</span><input name="subject" autocomplete="off" required placeholder="Profile ID, Cognitus ID, name, Discord username, or Roblox username"></label>
          <button class="button button-dark" type="submit">Establish Signal Session</button>
        </form>
        <div class="sz44-capability-grid">
          <article class="is-online"><span>25%</span><strong>Intelligence Fusion</strong><p>Unified authorized subject record, provenance, anomalies, timeline, and session archive.</p></article>
          <article class="${caps.correlation?"is-online":""}"><span>50%</span><strong>Advanced Correlation</strong><p>${caps.correlation?"Organization-scoped related-profile correlation online.":"Unlocks at 50% Frenzy."}</p></article>
          <article class="${caps.board?"is-online":""}"><span>75%</span><strong>Signal Board</strong><p>${caps.board?"Interactive association canvas online.":"Unlocks at 75% Frenzy."}</p></article>
          <article class="${caps.brief?"is-online":""}"><span>90%</span><strong>Zero Brief</strong><p>${caps.brief?"Structured intelligence brief generation online.":"Unlocks at 90% Frenzy."}</p></article>
        </div>
        <div class="sz44-session-list" data-sz44-session-list>
          <div class="sz44-section-head"><div><p class="eyebrow">Persistent Sessions</p><h2>Signal Zero archive</h2></div><span>${sessions.length} saved</span></div>
          ${sessions.length ? sessions.slice(0,12).map(sessionCard).join("") : `<div class="sz44-empty"><strong>No Signal Zero sessions yet.</strong><p>Establish a subject session to create the first persistent intelligence record.</p></div>`}
        </div>
      </section>
      <section class="sz44-workspace" data-sz44-workspace>${activeAnalysis && activeProfile ? analysisMarkup(activeProfile, activeAnalysis, frenzy, activeSessionRecord) : `<div class="sz44-empty sz44-empty-large"><span>SZ</span><h2>No subject loaded.</h2><p>Establish or resume a Signal Zero session from the Command Center.</p></div>`}</section>
    `}
  </div>`;
}

function sessionCard(row) {
  const snapshot = row.payload?.snapshot;
  const pulse = snapshot?.pulse || {};
  return `<article class="sz44-session-card">
    <div><span>${safe(row.payload?.sessionId || "SZ SESSION")}</span><strong>${safe(snapshot?.subject?.displayName || row.title || "Signal Zero Session")}</strong><small>${safe(row.payload?.status || "read_only")} · ${safe(row.payload?.frenzyEventId || "Event archive")}</small></div>
    <div class="sz44-session-pulse"><span>${Number(pulse.records || 0)} records</span><span>${Number(pulse.anomalies || 0)} anomalies</span><span>${Number(pulse.coverage || 0)}% coverage</span></div>
    <button class="button button-light" type="button" data-sz44-resume="${safe(row.id)}">Open Session</button>
  </article>`;
}

function pulseMarkup(pulse) {
  const metrics = [
    ["Profiles correlated", pulse.profiles],
    ["Organizations", pulse.organizations],
    ["Relevant records", pulse.records],
    ["Anomalies", pulse.anomalies],
    ["Unresolved", pulse.unresolved],
    ["Source coverage", `${pulse.coverage}%`]
  ];
  return `<section class="sz44-pulse"><div class="sz44-section-head"><div><p class="eyebrow">Zero Pulse</p><h2>Current session</h2></div><span>Live synthesis</span></div><div class="sz44-pulse-grid">${metrics.map(([label,value])=>`<article><span>${safe(label)}</span><strong>${safe(value ?? 0)}</strong></article>`).join("")}</div></section>`;
}

function subjectMarkup(profile, data) {
  return `<section class="sz44-panel">
    <div class="sz44-section-head"><div><p class="eyebrow">Subject Intelligence</p><h2>${safe(profile.displayName || "Cognitus Subject")}</h2></div><span>${safe(profile.cognitusId || profile.id)}</span></div>
    <div class="sz44-subject-grid">
      <article><span>Identity status</span><strong>${safe(profile.identityStatus || "unreviewed")}</strong></article>
      <article><span>Professional standing</span><strong>${safe(profile.professionalStanding || "unreviewed")}</strong></article>
      <article><span>Authorized reports</span><strong>${data.reports.length}</strong></article>
      <article><span>Employment records</span><strong>${data.employment.length}</strong></article>
    </div>
    <div class="sz44-tag-row">${data.aliases.length ? data.aliases.map((alias)=>`<span>${safe(alias)}</span>`).join("") : `<span>No alias markers available</span>`}</div>
    <p class="sz44-caution">Identity and standing fields are Cognitus record states, not independent proof of identity or real-world character.</p>
  </section>`;
}

function anomalyMarkup(data) {
  return `<section class="sz44-panel">
    <div class="sz44-section-head"><div><p class="eyebrow">Anomaly Detection</p><h2>Items requiring context</h2></div><span>${data.anomalies.length} conditions</span></div>
    <div class="sz44-anomaly-list">${data.anomalies.map((item)=>`<article><div><strong>${safe(item.title)}</strong>${confidenceBadge(item.confidence)}</div><p>${safe(item.detail)}</p><small>${item.sourceIds?.length || 0} supporting source reference${item.sourceIds?.length===1?"":"s"}</small></article>`).join("")}</div>
  </section>`;
}

function confidenceMatrixMarkup(data) {
  const counts = ["Confirmed", "Corroborated", "Indicated", "Unresolved"].map((name) => [name, data.anomalies.filter((row) => row.confidence === name).length]);
  return `<section class="sz44-panel"><div class="sz44-section-head"><div><p class="eyebrow">Confidence Matrix</p><h2>Fact separated from inference</h2></div></div><div class="sz44-confidence-grid">${counts.map(([name,count])=>`<article>${confidenceBadge(name)}<strong>${count}</strong><p>${name === "Confirmed" ? "Directly represented by an authorized Cognitus record." : name === "Corroborated" ? "Supported by multiple available records or an authorized summary." : name === "Indicated" ? "Pattern inferred from available records; context required." : "Incomplete, conflicting, or insufficient information."}</p></article>`).join("")}</div></section>`;
}

function timelineMarkup(data) {
  const types = [...new Set(data.timeline.map((row) => row.type))];
  return `<section class="sz44-panel"><div class="sz44-section-head"><div><p class="eyebrow">Timeline Reconstruction</p><h2>Chronological record</h2></div><span>${data.timeline.length} events</span></div>
    <div class="sz44-timeline-filters"><button type="button" class="is-active" data-sz44-timeline-filter="all">All</button>${types.map((type)=>`<button type="button" data-sz44-timeline-filter="${safe(type)}">${safe(type)}</button>`).join("")}</div>
    <div class="sz44-timeline">${data.timeline.length ? data.timeline.map((row)=>`<article data-sz44-timeline-type="${safe(row.type)}"><time>${safe(formatDateTime(row.date))}</time><div><span>${safe(row.type)}</span><strong>${safe(row.title)}</strong><p>${safe(row.detail)}</p><small>Source ${safe(row.sourceId || "—")}</small></div></article>`).join("") : `<div class="sz44-empty"><strong>No dated records available.</strong><p>Signal Zero cannot reconstruct events without source dates.</p></div>`}</div></section>`;
}

function sourceMarkup(data) {
  return `<section class="sz44-panel"><div class="sz44-section-head"><div><p class="eyebrow">Provenance</p><h2>Source registry</h2></div><span>${data.pulse.coverage}% coverage</span></div><div class="sz44-source-table">${data.sources.map((source)=>`<article><div><span>${safe(source.kind)}</span><strong>${safe(source.label)}</strong><small>Reference ${safe(source.id)}</small></div><div><span>Status</span><strong>${safe(source.status || "unresolved")}</strong></div><div><span>Visibility</span><strong>${safe(source.visibility || "Authorized")}</strong></div><div><span>Last record date</span><strong>${safe(formatDateTime(source.date))}</strong></div><div>${confidenceBadge(source.confidence)}</div><a class="button button-light" href="#${safe(source.route || `/intelligence?subject=${encodeURIComponent(activeProfile?.id || "")}`)}">View Source Record</a></article>`).join("")}</div></section>`;
}

function boardNodes(profile, data) {
  const nodes = [{ id: `subject:${profile.id}`, kind: "subject", label: profile.displayName || profile.cognitusId || "Subject", detail: profile.cognitusId || profile.id }];
  data.organizations.slice(0, 10).forEach((org) => nodes.push({ id: `org:${org.id}`, kind: "organization", label: org.name || org.cognitusId || org.id, detail: org.verificationStatus || "organization" }));
  data.reports.slice(0, 12).forEach((report) => nodes.push({ id: `report:${report.id}`, kind: "report", label: report.category || report.reportCategory || "Report", detail: `${report.severity || "Unspecified"} · ${report.status || "available"}` }));
  data.aliases.slice(0, 10).forEach((alias, index) => nodes.push({ id: `alias:${index}`, kind: "identity", label: alias, detail: "Identity marker" }));
  data.relatedProfiles.slice(0, 10).forEach((person) => nodes.push({ id: `profile:${person.id}`, kind: "profile", label: person.displayName || person.cognitusId || person.id, detail: "Shared organization context" }));
  return nodes;
}

function boardMarkup(profile, data, caps) {
  if (!caps.board) return `<section class="sz44-panel">${lockedCapability("Signal Board", 75, "Interactive association canvas unlocks at 75% Frenzy. Higher Frenzy levels never expand underlying record permissions.")}</section>`;
  const nodes = boardNodes(profile, data);
  const subject = nodes[0];
  const others = nodes.slice(1);
  return `<section class="sz44-panel"><div class="sz44-section-head"><div><p class="eyebrow">Signal Board</p><h2>Authorized association canvas</h2></div><span>${nodes.length} nodes</span></div>
    <div class="sz44-board">
      <button type="button" class="sz44-node is-subject" data-sz44-node="${safe(subject.id)}"><span>SUBJECT</span><strong>${safe(subject.label)}</strong><small>${safe(subject.detail)}</small></button>
      <div class="sz44-board-ring">${others.map((node)=>`<button type="button" class="sz44-node is-${safe(node.kind)}" data-sz44-node="${safe(node.id)}"><span>${safe(node.kind)}</span><strong>${safe(node.label)}</strong><small>${safe(node.detail)}</small></button>`).join("")}</div>
      <aside class="sz44-node-detail" data-sz44-node-detail><span>Select a node</span><strong>Inspect a Signal Board connection.</strong><p>Connections represent authorized Cognitus record associations, not proof of shared conduct or relationship.</p></aside>
    </div>
  </section>`;
}

function generateBrief(profile, data) {
  const confirmed = data.anomalies.filter((row) => row.confidence === "Confirmed");
  const indicated = data.anomalies.filter((row) => row.confidence === "Indicated");
  const unresolved = data.anomalies.filter((row) => row.confidence === "Unresolved");
  return {
    generatedAt: new Date().toISOString(),
    subjectOverview: `${profile.displayName || "The subject"} is represented by ${data.sources.length} source records currently available to this account, including ${data.reports.length} report records and ${data.employment.length} employment records across ${data.organizations.length} organizations.`,
    verifiedRecords: `${confirmed.length} anomaly condition${confirmed.length === 1 ? "" : "s"} are directly represented by authorized records. Source coverage is ${data.pulse.coverage}%.`,
    relevantAssociations: data.relatedProfiles.length ? `${data.relatedProfiles.length} other profile records were discoverable through organization-scoped records this account was permitted to read. Association does not imply shared conduct.` : "No additional profile correlation was available through organization-scoped records in this session.",
    timelineFindings: data.timeline.length ? `${data.timeline.length} dated events were reconstructed from available profile, report, employment, claim, appeal, and investigation records.` : "No dated events were available for timeline reconstruction.",
    detectedAnomalies: data.anomalies.map((row) => `${row.title} [${row.confidence}]`),
    unresolvedQuestions: unresolved.length ? unresolved.map((row) => row.title) : indicated.length ? indicated.map((row) => `Context required: ${row.title}`) : ["No unresolved condition was automatically identified; source completeness should still be reviewed."],
    sourceConfidence: `Coverage ${data.pulse.coverage}%. ${data.sources.filter((row)=>row.confidence==="Confirmed").length} source records are classified Confirmed by Signal Zero's provenance rules.`,
    recommendedReview: ["Inspect the underlying source records before making a consequential decision.", ...(data.anomalies.slice(0,5).map((row)=>`Review supporting sources for: ${row.title}`))]
  };
}

function briefMarkup(profile, data, caps, session) {
  if (!caps.brief) return `<section class="sz44-panel">${lockedCapability("Zero Brief", 90, "Structured intelligence brief generation unlocks at 90% Frenzy. The brief organizes evidence and open questions; it never produces a verdict.")}</section>`;
  const brief = session?.payload?.brief || null;
  if (!brief) return `<section class="sz44-panel"><div class="sz44-section-head"><div><p class="eyebrow">Zero Brief</p><h2>Structured intelligence brief</h2></div><span>90% capability</span></div><p>Generate a session brief from the evidence, provenance, anomaly, and timeline data already assembled in this Signal Zero session.</p><button class="button button-dark" type="button" data-sz44-generate-brief>Generate Zero Brief</button><p class="sz44-caution">Zero Brief does not determine guilt, credibility, suitability, or employment outcome.</p></section>`;
  const sections = [
    ["Subject Overview", brief.subjectOverview],
    ["Verified Records", brief.verifiedRecords],
    ["Relevant Associations", brief.relevantAssociations],
    ["Timeline Findings", brief.timelineFindings],
    ["Detected Anomalies", Array.isArray(brief.detectedAnomalies) ? brief.detectedAnomalies.join(" · ") : brief.detectedAnomalies],
    ["Unresolved Questions", Array.isArray(brief.unresolvedQuestions) ? brief.unresolvedQuestions.join(" · ") : brief.unresolvedQuestions],
    ["Source Confidence", brief.sourceConfidence],
    ["Recommended Records for Human Review", Array.isArray(brief.recommendedReview) ? brief.recommendedReview.join(" · ") : brief.recommendedReview]
  ];
  return `<section class="sz44-panel"><div class="sz44-section-head"><div><p class="eyebrow">Zero Brief</p><h2>${safe(session?.payload?.sessionId || "Signal Zero Session")}</h2></div><span>${safe(formatDateTime(brief.generatedAt))}</span></div><div class="sz44-brief">${sections.map(([title,body])=>`<article><span>${safe(title)}</span><p>${safe(body || "No information available.")}</p></article>`).join("")}</div><p class="sz44-caution">Decision support only. Review underlying Cognitus records and applicable procedures before taking action.</p></section>`;
}

function analysisMarkup(profile, data, frenzy, session) {
  const caps = frenzyCapabilities(frenzy);
  const sessionId = session?.payload?.sessionId || "Unsaved Session";
  return `<div class="sz44-analysis" data-sz44-analysis>
    <header class="sz44-analysis-head"><div><p class="eyebrow">Active Signal Session</p><h2>${safe(sessionId)}</h2><p>${safe(profile.displayName || "Cognitus Subject")} · ${safe(profile.cognitusId || profile.id)}</p></div><div><span>${safe(capabilityLabel(caps))}</span><strong>${caps.level}%</strong></div></header>
    ${pulseMarkup(data.pulse)}
    <div data-sz44-section="command" class="${activeTab === "command" ? "is-visible" : ""}">${subjectMarkup(profile,data)}${anomalyMarkup(data)}${confidenceMatrixMarkup(data)}</div>
    <div data-sz44-section="subject" class="${activeTab === "subject" ? "is-visible" : ""}">${subjectMarkup(profile,data)}${caps.correlation ? `<section class="sz44-panel"><div class="sz44-section-head"><div><p class="eyebrow">Advanced Correlation</p><h2>Organization-scoped relationships</h2></div><span>${data.relatedProfiles.length} related profiles</span></div>${data.relatedProfiles.length ? `<div class="sz44-related-grid">${data.relatedProfiles.map((row)=>`<article><strong>${safe(row.displayName || row.cognitusId || row.id)}</strong><span>${safe(row.cognitusId || row.id)}</span><p>Shared organization context available to this account.</p></article>`).join("")}</div>` : `<div class="sz44-empty"><strong>No additional profiles correlated.</strong><p>Either none were present or the underlying records were not readable by this account.</p></div>`}</section>` : lockedCapability("Advanced Correlation",50,"Organization-scoped related-profile correlation unlocks at 50% Frenzy.")}</div>
    <div data-sz44-section="board" class="${activeTab === "board" ? "is-visible" : ""}">${boardMarkup(profile,data,caps)}</div>
    <div data-sz44-section="timeline" class="${activeTab === "timeline" ? "is-visible" : ""}">${timelineMarkup(data)}</div>
    <div data-sz44-section="anomalies" class="${activeTab === "anomalies" ? "is-visible" : ""}">${anomalyMarkup(data)}${confidenceMatrixMarkup(data)}</div>
    <div data-sz44-section="sources" class="${activeTab === "sources" ? "is-visible" : ""}">${sourceMarkup(data)}</div>
    <div data-sz44-section="brief" class="${activeTab === "brief" ? "is-visible" : ""}">${briefMarkup(profile,data,caps,session)}</div>
  </div>`;
}

function archivedSessionMarkup(record) {
  const snapshot = record.payload?.snapshot;
  if (!snapshot?.subject) return `<div class="sz44-empty"><strong>Session archive unavailable.</strong><p>This older Signal Zero session does not contain a portable session snapshot.</p></div>`;
  const brief = record.payload?.brief;
  return `<div class="sz44-archive-view"><header><p class="eyebrow">Read-only Signal Zero Session</p><h2>${safe(record.payload?.sessionId || record.title || "Signal Zero Session")}</h2><p>${safe(snapshot.subject.displayName)} · ${safe(snapshot.subject.cognitusId || snapshot.subject.id)}</p></header>${pulseMarkup(snapshot.pulse || {})}<section class="sz44-panel"><div class="sz44-section-head"><div><p class="eyebrow">Archived Findings</p><h2>Anomalies</h2></div></div><div class="sz44-anomaly-list">${(snapshot.anomalies||[]).map((row)=>`<article><div><strong>${safe(row.title)}</strong>${confidenceBadge(row.confidence || "Unresolved")}</div><p>${safe(row.detail)}</p></article>`).join("") || `<div class="sz44-empty">No archived anomalies.</div>`}</div></section>${brief ? `<section class="sz44-panel"><div class="sz44-section-head"><div><p class="eyebrow">Archived Zero Brief</p><h2>Session brief</h2></div></div><div class="sz44-brief"><article><span>Subject Overview</span><p>${safe(brief.subjectOverview || "—")}</p></article><article><span>Source Confidence</span><p>${safe(brief.sourceConfidence || "—")}</p></article><article><span>Unresolved Questions</span><p>${safe(Array.isArray(brief.unresolvedQuestions)?brief.unresolvedQuestions.join(" · "):brief.unresolvedQuestions||"—")}</p></article></div></section>` : ""}<p class="sz44-caution">This is a stored session snapshot. Signal Zero analytical tools are available only during an authorized Frenzy window.</p></div>`;
}

async function dormantMarkup(feature, frenzy, sessions) {
  C.setTitle(`${feature.name} · Dormant`);
  C.root.innerHTML = `<div class="sz44-shell" data-promo-v26-page data-signal44-page>
    <section class="sz44-dormant"><div class="sz44-mark">SZ</div><p class="eyebrow">Frenzy Exclusive · Entitlement Verified</p><h1>Signal Zero is dormant.</h1><p>The promotional entitlement is valid, but Signal Zero analytical tools require an active Frenzy event with the Executive activation window open.</p><div class="sz44-dormant-status"><span><strong>Frenzy</strong>${frenzy.effectiveActive ? "Active" : "Inactive"}</span><span><strong>Signal Window</strong>${frenzy.signalZeroEnabled ? "Enabled" : "Closed"}</span><span><strong>Saved Sessions</strong>${sessions.length}</span></div><div class="hero-actions">${C.buttonLink("/promotional-access","Feature Access")}${C.buttonLink("/dashboard","Dashboard")}</div></section>
    <section class="sz44-panel"><div class="sz44-section-head"><div><p class="eyebrow">Read-only Archive</p><h2>Previous Signal Zero sessions</h2></div><span>${sessions.length} saved</span></div><div class="sz44-session-list">${sessions.length ? sessions.slice(0,20).map(sessionCard).join("") : `<div class="sz44-empty"><strong>No saved sessions.</strong><p>Completed Signal Zero sessions will remain available here as read-only intelligence records.</p></div>`}</div><div data-sz44-archive-view></div></section>
  </div>`;
  bindSessionArchive(sessions, false);
}

function bindTabs() {
  C.root?.querySelectorAll("[data-sz44-tab]").forEach((button) => button.addEventListener("click", () => {
    activeTab = button.dataset.sz44Tab || "command";
    C.root.querySelectorAll("[data-sz44-tab]").forEach((node) => node.classList.toggle("is-active", node === button));
    C.root.querySelectorAll("[data-sz44-section]").forEach((node) => node.classList.toggle("is-visible", node.dataset.sz44Section === activeTab));
  }));
}

function bindTimeline() {
  C.root?.querySelectorAll("[data-sz44-timeline-filter]").forEach((button) => button.addEventListener("click", () => {
    const filter = button.dataset.sz44TimelineFilter;
    button.parentElement?.querySelectorAll("button").forEach((node) => node.classList.toggle("is-active", node === button));
    C.root.querySelectorAll("[data-sz44-timeline-type]").forEach((row) => {
      row.hidden = filter !== "all" && row.dataset.sz44TimelineType !== filter;
    });
  }));
}

function bindBoard(profile, data) {
  const nodes = new Map(boardNodes(profile,data).map((node)=>[node.id,node]));
  C.root?.querySelectorAll("[data-sz44-node]").forEach((button)=>button.addEventListener("click",()=>{
    const node = nodes.get(button.dataset.sz44Node);
    const detail = C.root.querySelector("[data-sz44-node-detail]");
    if (!node || !detail) return;
    C.root.querySelectorAll("[data-sz44-node]").forEach((item)=>item.classList.toggle("is-selected",item===button));
    detail.innerHTML = `<span>${safe(node.kind)}</span><strong>${safe(node.label)}</strong><p>${safe(node.detail)}</p><small>Association displayed from records already available to this Cognitus account.</small>`;
  }));
}

function bindBrief(profile, data, frenzy) {
  C.root?.querySelector("[data-sz44-generate-brief]")?.addEventListener("click", async (event) => {
    if (!activeSessionRecord) return;
    const caps = frenzyCapabilities(getFrenzyState());
    if (!caps.brief) return;
    event.currentTarget.disabled = true;
    try {
      const brief = generateBrief(profile, data);
      await updateSession(activeSessionRecord, { brief, lastLevel: caps.level, status: "active" });
      activeTab = "brief";
      const workspace = C.root.querySelector("[data-sz44-workspace]");
      if (workspace) workspace.innerHTML = analysisMarkup(profile,data,getFrenzyState(),activeSessionRecord);
      bindAnalysis(profile,data,getFrenzyState());
      bindTabs();
    } catch (error) {
      console.error("Signal Zero brief persistence failed", error);
      event.currentTarget.disabled = false;
    }
  });
}

function bindAnalysis(profile, data, frenzy) {
  bindTimeline();
  bindBoard(profile,data);
  bindBrief(profile,data,frenzy);
}

function loadArchivedSnapshot(record) {
  const container = C.root?.querySelector("[data-sz44-archive-view]") || C.root?.querySelector("[data-sz44-workspace]");
  if (!container) return;
  container.innerHTML = archivedSessionMarkup(record);
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindSessionArchive(sessions, activeWindow) {
  C.root?.querySelectorAll("[data-sz44-resume]").forEach((button) => button.addEventListener("click", async () => {
    const record = sessions.find((row)=>row.id===button.dataset.sz44Resume);
    if (!record) return;
    if (!activeWindow) {
      loadArchivedSnapshot(record);
      return;
    }
    const latest = getFrenzyState();
    const caps = frenzyCapabilities(latest);
    if (!latest.effectiveActive || !latest.signalZeroEnabled || !caps.core) {
      loadArchivedSnapshot(record);
      return;
    }
    const subjectId = record.subjectId || record.payload?.subjectId || record.payload?.snapshot?.subject?.id;
    const profile = subjectId ? await C.readDoc("profiles", subjectId).catch(()=>null) : null;
    if (!profile) {
      loadArchivedSnapshot(record);
      return;
    }
    const data = await buildAnalysis(profile,caps);
    activeProfile = profile;
    activeAnalysis = data;
    activeSessionRecord = record;
    await updateSession(record, { snapshot: compactAnalysis(profile,data), lastLevel: caps.level, lastAnalyzedAt: new Date().toISOString(), status: "active" }).catch(()=>null);
    activeTab = "command";
    const workspace = C.root.querySelector("[data-sz44-workspace]");
    if (workspace) workspace.innerHTML = analysisMarkup(profile,data,latest,record);
    bindAnalysis(profile,data,latest);
    bindTabs();
    workspace?.scrollIntoView({ behavior:"smooth", block:"start" });
  }));
}

function bindSearch(feature, frenzy, sessions) {
  const form = C.root?.querySelector("[data-sz44-search]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const latest = getFrenzyState();
    const caps = frenzyCapabilities(latest);
    if (!latest.effectiveActive || !latest.signalZeroEnabled || !caps.core) {
      C.scheduleSync(false);
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    const subject = clean(new FormData(form).get("subject"));
    C.setBusy(button,true,"Establishing…","Establish Signal Session");
    try {
      const profile = await C.findProfile(subject);
      if (!profile) throw new Error("No matching Cognitus profile was found.");
      const data = await buildAnalysis(profile,caps);
      const record = await persistNewSession(profile,data,latest);
      activeProfile = profile;
      activeAnalysis = data;
      activeSessionRecord = record;
      activeTab = "command";
      const workspace = C.root.querySelector("[data-sz44-workspace]");
      if (workspace) workspace.innerHTML = analysisMarkup(profile,data,latest,record);
      bindAnalysis(profile,data,latest);
      bindTabs();
      await C.createUserData("search_event", {
        title: "signal_zero_v44",
        subjectId: profile.id,
        payload: { featureId:"signal_zero", sessionId:record.payload.sessionId, frenzyEventId:latest.eventId, sourceCount:data.sources.length, anomalyCount:data.pulse.anomalies, sourceCoverage:data.pulse.coverage }
      }).catch(()=>null);
      workspace?.scrollIntoView({ behavior:"smooth", block:"start" });
      const refreshed = await loadSignalSessions();
      const list = C.root.querySelector("[data-sz44-session-list]");
      if (list) {
        list.innerHTML = `<div class="sz44-section-head"><div><p class="eyebrow">Persistent Sessions</p><h2>Signal Zero archive</h2></div><span>${refreshed.length} saved</span></div>${refreshed.slice(0,12).map(sessionCard).join("")}`;
        bindSessionArchive(refreshed,true);
      }
    } catch (error) {
      const workspace = C.root.querySelector("[data-sz44-workspace]");
      if (workspace) workspace.innerHTML = `<div class="sz44-error"><strong>Signal session could not be established.</strong><p>${safe(error?.message || "Unknown error")}</p></div>`;
    } finally {
      C.setBusy(button,false,"Establishing…","Establish Signal Session");
    }
  });
}

async function sealOpenSessions(sessions) {
  for (const row of sessions.filter((item)=>item.payload?.status === "active").slice(0,20)) {
    await updateSession(row, { status:"read_only" }).catch(()=>null);
  }
}

export async function renderSignalZeroV44(feature) {
  mountStyles();
  const token = ++renderToken;
  await waitForFrenzyState().catch(()=>null);
  const frenzy = getFrenzyState();
  const sessions = await loadSignalSessions();
  if (token !== renderToken || C.currentRoute() !== ROUTE) return;

  if (!frenzy.effectiveActive || !frenzy.signalZeroEnabled) {
    await sealOpenSessions(sessions);
    await dormantMarkup(feature,frenzy,sessions);
    return;
  }

  await runInitialization(frenzy);
  if (token !== renderToken || C.currentRoute() !== ROUTE) return;
  C.root.innerHTML = shellMarkup(feature,frenzy,sessions);
  bindTabs();
  const caps = frenzyCapabilities(frenzy);
  if (caps.core) {
    bindSearch(feature,frenzy,sessions);
    bindSessionArchive(sessions,true);
    if (activeProfile && activeAnalysis) bindAnalysis(activeProfile,activeAnalysis,frenzy);
  }
}
