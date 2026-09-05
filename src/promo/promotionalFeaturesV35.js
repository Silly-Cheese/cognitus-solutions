import * as C from "./promotionalCoreV26.js";
import { renderFeaturePageV33 } from "./promotionalFeaturesV33.js";
import { getFrenzyState, waitForFrenzyState } from "../frenzyV35.js";

const REVIEWER_ROLES = new Set(["reviewer", "admin", "owner"]);
const SEVERITY_WEIGHT = { Informational: 0, Low: 1, Moderate: 2, High: 3, Critical: 4 };

function daysBetween(a, b) {
  const aMs = new Date(a || "").getTime();
  const bMs = new Date(b || "").getTime();
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return Infinity;
  return Math.abs(aMs - bMs) / 86400000;
}

function dateRange(row) {
  const start = new Date(row?.startedOn || "").getTime();
  const end = row?.endedOn ? new Date(row.endedOn).getTime() : Date.now();
  return {
    start: Number.isFinite(start) ? start : null,
    end: Number.isFinite(end) ? end : null
  };
}

function overlapEmployment(rows) {
  const usable = rows.map((row) => ({ row, ...dateRange(row) })).filter((item) => item.start && item.end);
  const overlaps = [];
  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      const a = usable[i];
      const b = usable[j];
      if (a.row.organizationId === b.row.organizationId) continue;
      if (Math.max(a.start, b.start) <= Math.min(a.end, b.end)) overlaps.push([a.row, b.row]);
    }
  }
  return overlaps;
}

function reportCluster(reports) {
  const dates = reports
    .map((row) => C.timestampMs(row.reportCreatedAt || row.createdAt))
    .filter(Boolean)
    .sort((a, b) => a - b);
  let max = 0;
  for (let i = 0; i < dates.length; i += 1) {
    let count = 1;
    for (let j = i + 1; j < dates.length; j += 1) {
      if ((dates[j] - dates[i]) / 86400000 > 90) break;
      count += 1;
    }
    max = Math.max(max, count);
  }
  return max;
}

function dormant(feature, frenzy) {
  C.setTitle(`${feature.name} · Dormant`);
  C.root.innerHTML = `<section class="signal35-dormant" data-promo-v26-page data-signal35-page>
    <div class="signal35-dormant-mark">SZ</div>
    <p class="eyebrow">Frenzy Exclusive</p>
    <h1>Signal Zero is dormant.</h1>
    <p>Your Signal Zero entitlement is recognized, but the feature can operate only during an active Frenzy event when the Executive activation window is open.</p>
    <div class="hero-actions" style="justify-content:center">
      ${C.buttonLink("/promotional-access", "Feature Access")}
      ${C.buttonLink("/dashboard", "Dashboard")}
    </div>
    <div class="pro35-context-strip" style="margin:1.2rem auto 0;max-width:720px;text-align:left">
      <span><strong>Entitlement</strong> verified before feature rendering</span>
      <span><strong>Frenzy</strong> ${frenzy.effectiveActive ? "active" : "inactive"}</span>
      <span><strong>Activation window</strong> ${frenzy.signalZeroEnabled ? "enabled" : "closed"}</span>
    </div>
  </section>`;
}

function signalShell(feature, frenzy) {
  C.setTitle(feature.name);
  C.root.innerHTML = `<div class="signal35-shell" data-promo-v26-page data-signal35-page>
    <section class="signal35-hero">
      <p class="eyebrow">Frenzy Exclusive · Event ${C.safe(frenzy.eventId || "Active")}</p>
      <div class="signal35-state">● Signal Zero Window Open</div>
      <h1>Signal Zero</h1>
      <p>Event-limited cross-record analysis that combines only the Cognitus records this account is already authorized to review. Signal Zero does not expand report visibility or create a determination of guilt, character, or suitability.</p>
    </section>
    <section class="signal35-panel">
      <form class="promo26-searchbar" data-signal35-form>
        <label>Subject profile<input name="subject" autocomplete="off" required placeholder="Profile ID, Cognitus ID, name, Discord username, or Roblox username"></label>
        <button class="button button-dark" type="submit">Run Signal Zero</button>
      </form>
      <div class="pro35-context-strip" style="margin:1rem 0 0;background:#1f2229;border-color:#343944;color:#b8bec8">
        <span><strong style="color:#fff">Frenzy level</strong> ${Math.round(frenzy.level)}%</span>
        <span><strong style="color:#fff">Data scope</strong> authorized records only</span>
        <span><strong style="color:#fff">Mode</strong> temporary event analysis</span>
      </div>
    </section>
    <section class="signal35-result" data-signal35-result>
      <p>No subject loaded. Search a Cognitus profile to assemble the active Signal Zero analysis.</p>
    </section>
  </div>`;
}

async function authorizedReports(profile) {
  const staff = REVIEWER_ROLES.has(C.userRecord?.role);
  if (staff) {
    const rows = await C.safeReadWhere("reports", "subjectProfileId", "==", profile.id, 300);
    return { rows, full: true };
  }
  const rows = await C.safeReadWhere("screeningReportSummaries", "subjectProfileId", "==", profile.id, 300);
  return {
    rows: rows.filter((row) => ["screening", "public"].includes(C.lower(row.visibility))),
    full: false
  };
}

async function buildAnalysis(profile) {
  const [reportData, employment] = await Promise.all([
    authorizedReports(profile),
    C.safeReadWhere("employmentRecords", "profileId", "==", profile.id, 300)
  ]);
  const reports = reportData.rows.filter((row) => ["approved", "published"].includes(C.lower(row.status)));
  const organizations = [...new Set(employment.map((row) => row.organizationId).filter(Boolean))];
  const aliases = [
    ...(profile.knownAliases || []),
    ...(profile.discordUsernames || []),
    ...(profile.robloxUsernames || [])
  ].map(C.clean).filter(Boolean);
  const severe = reports.filter((row) => Number(SEVERITY_WEIGHT[row.severity] || 0) >= 3);
  const overlaps = overlapEmployment(employment);
  const cluster = reportCluster(reports);
  const recent = reports.filter((row) => daysBetween(C.timestampMs(row.reportCreatedAt || row.createdAt), Date.now()) <= 180);

  const anomalies = [];
  if (severe.length) anomalies.push({
    title: "High-severity reviewed records present",
    detail: `${severe.length} authorized approved/published report${severe.length === 1 ? "" : "s"} are classified High or Critical. Review the underlying reports and context before drawing conclusions.`
  });
  if (overlaps.length) anomalies.push({
    title: "Cross-organization date overlap",
    detail: `${overlaps.length} pair${overlaps.length === 1 ? "" : "s"} of employment records overlap across different organizations. Overlap can be legitimate; confirm dates and role context.`
  });
  if (cluster >= 3) anomalies.push({
    title: "Report activity cluster",
    detail: `At least ${cluster} authorized reviewed reports fall within a 90-day window. This is a timing pattern, not a finding of misconduct.`
  });
  if (aliases.length >= 4) anomalies.push({
    title: "Expanded identity footprint",
    detail: `${aliases.length} alias or username markers are available on the profile. Confirm which identifiers are current before relying on identity-linked records.`
  });
  if (organizations.length >= 4) anomalies.push({
    title: "Broad organization footprint",
    detail: `${organizations.length} organizations appear in employment records available to this account. Review role and date continuity for context.`
  });
  if (!anomalies.length) anomalies.push({
    title: "No convergence condition detected",
    detail: "Signal Zero did not identify one of its defined cross-record conditions in the records currently available to this account. This does not certify that the profile is risk-free or complete."
  });

  const convergence = Math.min(100, Math.max(0, (anomalies[0]?.title === "No convergence condition detected" ? 0 : anomalies.length * 20)));
  return { reports, employment, organizations, aliases, severe, overlaps, cluster, recent, anomalies, convergence, fullReports: reportData.full };
}

function analysisMarkup(profile, data, frenzy) {
  return `<div>
    <div class="promo26-section-heading" style="margin-bottom:.8rem"><div><p class="eyebrow" style="color:#f59e0b!important">Signal Subject</p><h2 style="color:#fff">${C.safe(profile.displayName || "Cognitus Subject")}</h2></div><span class="signal35-state">${C.safe(profile.cognitusId || profile.id)}</span></div>
    <div class="signal35-grid">
      <article class="signal35-metric"><span>Authorized reports</span><strong>${data.reports.length}</strong></article>
      <article class="signal35-metric"><span>Organizations</span><strong>${data.organizations.length}</strong></article>
      <article class="signal35-metric"><span>Identity markers</span><strong>${data.aliases.length}</strong></article>
      <article class="signal35-metric"><span>Signal convergence</span><strong>${data.convergence}%</strong></article>
    </div>
    <div class="promo26-two-col" style="margin-top:1rem">
      <section class="signal35-panel">
        <p class="eyebrow" style="color:#f59e0b!important">Cross-record conditions</p>
        <h2 style="color:#fff">Items requiring context</h2>
        <div class="signal35-anomaly-list">${data.anomalies.map((item) => `<article class="signal35-anomaly"><strong>${C.safe(item.title)}</strong><p>${C.safe(item.detail)}</p></article>`).join("")}</div>
      </section>
      <section class="signal35-panel">
        <p class="eyebrow" style="color:#f59e0b!important">Event context</p>
        <h2 style="color:#fff">Frenzy analysis state</h2>
        <div class="record-list">
          <div class="record-row" style="background:#1f2229!important;border-color:#343944!important;color:#fff"><div><strong>Frenzy level</strong><span style="color:#b8bec8">${Math.round(frenzy.level)}%</span></div></div>
          <div class="record-row" style="background:#1f2229!important;border-color:#343944!important;color:#fff"><div><strong>Report scope</strong><span style="color:#b8bec8">${data.fullReports ? "Reviewer-level authorized report collection" : "Screening-visible report summaries"}</span></div></div>
          <div class="record-row" style="background:#1f2229!important;border-color:#343944!important;color:#fff"><div><strong>Recent reviewed reports</strong><span style="color:#b8bec8">${data.recent.length} within approximately 180 days</span></div></div>
          <div class="record-row" style="background:#1f2229!important;border-color:#343944!important;color:#fff"><div><strong>Employment records</strong><span style="color:#b8bec8">${data.employment.length} available to this account</span></div></div>
        </div>
      </section>
    </div>
    <section class="signal35-panel" style="margin-top:1rem">
      <p class="eyebrow" style="color:#f59e0b!important">Continue review</p>
      <h2 style="color:#fff">Open the underlying Cognitus workspaces</h2>
      <p>Signal Zero is a temporary synthesis layer. Use the normal record workspaces to inspect the source material before making a decision.</p>
      <div class="hero-actions">
        ${C.buttonLink(`/intelligence?subject=${encodeURIComponent(profile.id)}`, "Intelligence Center")}
        ${C.buttonLink(`/deep-history?subject=${encodeURIComponent(profile.id)}`, "Historical Record Analysis")}
        ${C.buttonLink(`/relationships?subject=${encodeURIComponent(profile.id)}`, "Relationship Analysis")}
        ${C.buttonLink(`/risk-matrix?subject=${encodeURIComponent(profile.id)}`, "Record Signal Analysis")}
      </div>
    </section>
    <p style="margin:1rem 0 0;color:#8f98a6;font-size:.78rem;line-height:1.55">Signal convergence is a count-based event visualization of defined record conditions, not a risk score, credibility score, misconduct finding, or employment recommendation.</p>
  </div>`;
}

async function signalZero(feature) {
  const frenzy = await waitForFrenzyState().catch(() => getFrenzyState());
  const current = getFrenzyState();
  if (!current.effectiveActive || !current.signalZeroEnabled) {
    dormant(feature, current);
    return;
  }
  signalShell(feature, current);
  const form = C.root.querySelector("[data-signal35-form]");
  const result = C.root.querySelector("[data-signal35-result]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const latest = getFrenzyState();
    if (!latest.effectiveActive || !latest.signalZeroEnabled) {
      C.scheduleSync(false);
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    const subject = C.clean(new FormData(form).get("subject"));
    C.setBusy(button, true, "Running…", "Run Signal Zero");
    result.innerHTML = `<p>Assembling authorized cross-record signals…</p>`;
    try {
      const profile = await C.findProfile(subject);
      if (!profile) {
        result.innerHTML = C.notice("No matching Cognitus profile was found.", "error");
        return;
      }
      const data = await buildAnalysis(profile);
      result.innerHTML = analysisMarkup(profile, data, latest);
      try {
        await C.createUserData("search_event", {
          title: "signal_zero",
          subjectId: profile.id,
          payload: { featureId: "signal_zero", frenzyEventId: latest.eventId, reportCount: data.reports.length, convergence: data.convergence }
        });
      } catch {}
    } catch (error) {
      result.innerHTML = C.notice(error?.message || "Signal Zero could not complete the analysis.", "error");
    } finally {
      C.setBusy(button, false, "Running…", "Run Signal Zero");
    }
  });
}

let stateListenerInstalled = false;
function installStateListener() {
  if (stateListenerInstalled) return;
  stateListenerInstalled = true;
  document.addEventListener("cognitus:frenzy-state", () => {
    if (C.currentRoute() === "/signal-zero") C.scheduleSync(false);
  });
}

installStateListener();

export async function renderFeaturePageV35(feature) {
  if (feature.id === "signal_zero") return signalZero(feature);
  return renderFeaturePageV33(feature);
}
