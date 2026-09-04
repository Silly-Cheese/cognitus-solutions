import * as C from "./promotionalCoreV26.js";

const STYLE_ID = "cognitus-promotional-investigations-v32";
const INVESTIGATIONS_ROUTE = "/investigations";
const REVIEWER_ROLES = new Set(["reviewer", "admin", "owner"]);
let rescueQueued = false;
let archiveEnhanceQueued = false;
let rootObserver = null;

function mountStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = "./src/promotionalInvestigationV32.css?v=20260904-v32";
  document.head.appendChild(link);
}

function isBaseRouter404() {
  if (!C.root || !C.PROMO_ROUTES.has(C.currentRoute())) return false;
  const heading = C.clean(C.root.querySelector("h1")?.textContent).toLowerCase();
  const body = C.clean(C.root.textContent).toLowerCase();
  return heading === "page not found." || body.includes("the requested cognitus page does not exist");
}

function promoSurfacePresent() {
  if (!C.root) return false;
  return Boolean(C.root.querySelector(
    ".promo26-access-hero, .promo26-admin-hero, .promo26-feature-hero, .promo26-locked-page, [data-promo-v26-page]"
  ));
}

function rescuePromoRouteIfNeeded() {
  if (!C.PROMO_ROUTES.has(C.currentRoute()) || !isBaseRouter404() || rescueQueued) return;
  rescueQueued = true;
  requestAnimationFrame(() => {
    C.scheduleSync(false);
    setTimeout(() => { rescueQueued = false; }, 250);
  });
}

function human(value, fallback = "Unknown") {
  const text = C.clean(value);
  return text ? C.humanize(text) : fallback;
}

function statusClass(value) {
  const status = C.lower(value);
  if (["approved", "published", "active", "verified"].includes(status)) return "is-good";
  if (["denied", "revoked", "critical", "restricted"].includes(status)) return "is-bad";
  if (["pending", "pending_review", "under_review", "moderate"].includes(status)) return "is-warn";
  return "is-neutral";
}

function reportCard(report, fullArchive) {
  const category = report.category || "Cognitus Report";
  const severity = report.severity || "Unknown";
  const status = report.status || "Unknown";
  const summary = report.summary || "No summary is available for this report.";
  const reportId = report.reportId || report.id;
  const cognitusId = report.reportCognitusId || report.cognitusId || reportId;
  const createdAt = report.reportCreatedAt || report.createdAt;
  const visibility = report.visibility || report.screeningVisibility || "restricted";
  const narrative = fullArchive ? C.clean(report.details || report.description || report.narrative || "") : "";
  const canOpenFull = fullArchive && reportId;
  return `<article class="promo32-report-card">
    <div class="promo32-report-topline">
      <div><span class="promo32-report-id">${C.safe(cognitusId)}</span><h3>${C.safe(category)}</h3></div>
      <div class="promo32-report-badges"><span class="${statusClass(status)}">${C.safe(human(status))}</span><span>${C.safe(human(severity))}</span></div>
    </div>
    <p class="promo32-report-summary">${C.safe(summary)}</p>
    ${narrative ? `<details class="promo32-report-details"><summary>View report narrative</summary><p>${C.safe(narrative)}</p></details>` : ""}
    <div class="promo32-report-meta"><span>Created ${C.safe(C.formatTimestamp(createdAt))}</span><span>Visibility: ${C.safe(human(visibility))}</span></div>
    ${canOpenFull ? `<div class="promo32-report-actions"><a class="button button-light" href="#/reports/view?report=${encodeURIComponent(reportId)}">Open Full Report</a></div>` : ""}
  </article>`;
}

async function loadAuthorizedReports(profile) {
  const fullArchive = REVIEWER_ROLES.has(C.userRecord?.role);
  if (fullArchive) {
    const reports = await C.readWhere("reports", "subjectProfileId", "==", profile.id, 500);
    return { fullArchive: true, reports };
  }
  const summaries = await C.readWhere("screeningReportSummaries", "subjectProfileId", "==", profile.id, 500);
  return { fullArchive: false, reports: summaries };
}

function archiveMarkup() {
  return `<section class="promo32-archive" data-promo32-archive>
    <div class="promo32-archive-head">
      <div><span>INVESTIGATION REPORT ARCHIVE</span><h2>See the complete report history you are authorized to review.</h2><p>Promotional Investigations brings every report your account is permitted to read into one subject workspace. Promotional Access does not override sealed-report or private-report permissions.</p></div>
      <span class="promo32-security-pill">Access-controlled</span>
    </div>
    <form class="promo32-archive-search" data-promo32-report-search>
      <label>Subject profile, Cognitus ID, name, or username<input name="subject" autocomplete="off" placeholder="Search a Cognitus subject" required></label>
      <button class="button button-dark" type="submit">Load Report Archive</button>
    </form>
    <div class="promo32-archive-result" data-promo32-report-result><div class="promo32-empty"><strong>No subject loaded.</strong><span>Search a person to assemble their authorized report history.</span></div></div>
  </section>`;
}

function bindArchiveSearch(section) {
  const form = section.querySelector("[data-promo32-report-search]");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const result = section.querySelector("[data-promo32-report-result]");
    const subject = C.clean(new FormData(form).get("subject"));
    if (!subject) return;
    C.setBusy(button, true, "Loading Archive…", "Load Report Archive");
    result.innerHTML = `<div class="promo32-empty is-loading"><strong>Building report archive…</strong><span>Checking subject identity and authorized report records.</span></div>`;
    try {
      const profile = await C.findProfile(subject);
      if (!profile) {
        result.innerHTML = C.notice("No matching Cognitus profile was found.", "error");
        return;
      }
      let archive;
      try {
        archive = await loadAuthorizedReports(profile);
      } catch (error) {
        if (error?.code === "permission-denied") {
          result.innerHTML = `<div class="promo32-permission-note"><strong>Report archive restricted.</strong><p>Your promotional entitlement is active, but your Cognitus role does not have permission to list additional report records for this subject. Promo access never bypasses report privacy controls.</p></div>`;
          return;
        }
        throw error;
      }
      const reports = [...archive.reports].sort((a,b)=>C.timestampMs(b.reportCreatedAt || b.createdAt)-C.timestampMs(a.reportCreatedAt || a.createdAt));
      result.innerHTML = `<div class="promo32-subject-banner"><div><span>${C.safe(profile.cognitusId || profile.id)}</span><h3>${C.safe(profile.displayName || "Cognitus Subject")}</h3></div><div><strong>${reports.length}</strong><span>${archive.fullArchive ? "authorized full reports" : "screening-visible reports"}</span></div></div>
      <div class="promo32-archive-mode"><span>${archive.fullArchive ? "STAFF REPORT ARCHIVE" : "PROMOTIONAL SCREENING ARCHIVE"}</span><p>${archive.fullArchive ? "Your current Cognitus role permits the full report collection for this subject." : "This archive includes every screening-visible report your account may review. Restricted narratives remain protected."}</p></div>
      <div class="promo32-report-list">${reports.length ? reports.map((report)=>reportCard(report, archive.fullArchive)).join("") : `<div class="promo32-empty"><strong>No authorized reports found.</strong><span>There are no report records available to your account for this subject.</span></div>`}</div>`;
      try { await C.createUserData("search_event", { title: "investigation_report_archive", subjectId: profile.id, payload: { featureId: "saved_investigations", query: subject.slice(0,120), resultCount: reports.length } }); } catch {}
    } catch (error) {
      result.innerHTML = C.notice(error?.message || "The report archive could not be loaded.", "error");
    } finally {
      C.setBusy(button, false, "Loading Archive…", "Load Report Archive");
    }
  });
}

function enhanceInvestigations() {
  if (C.currentRoute() !== INVESTIGATIONS_ROUTE || !C.root) return;
  const form = C.root.querySelector("[data-investigation-form]");
  const hero = C.root.querySelector(".promo26-feature-hero");
  if (!form || !hero || C.root.querySelector("[data-promo32-archive]")) return;
  const workspace = form.closest(".promo26-two-col") || form.closest(".promo26-feature-section");
  if (!workspace) return;
  workspace.insertAdjacentHTML("afterend", archiveMarkup());
  bindArchiveSearch(C.root.querySelector("[data-promo32-archive]"));
}

function queueArchiveEnhancement() {
  if (archiveEnhanceQueued) return;
  archiveEnhanceQueued = true;
  requestAnimationFrame(() => {
    archiveEnhanceQueued = false;
    enhanceInvestigations();
  });
}

function inspectRoot() {
  rescuePromoRouteIfNeeded();
  if (C.currentRoute() === INVESTIGATIONS_ROUTE && promoSurfacePresent()) queueArchiveEnhancement();
}

export function startPromotionalInvestigationsV32() {
  mountStyles();
  if (!C.root) return;
  rootObserver?.disconnect();
  rootObserver = new MutationObserver(inspectRoot);
  rootObserver.observe(C.root, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => {
    rescueQueued = false;
    requestAnimationFrame(inspectRoot);
  });
  window.addEventListener("pageshow", () => requestAnimationFrame(inspectRoot));
  window.addEventListener(C.PROMO_RENDER_EVENT, () => requestAnimationFrame(inspectRoot));
  requestAnimationFrame(inspectRoot);
}
