import { getAccountStore } from "../state/accountStore.js";
import { buildReportFromCheck, getOverallRecommendation, getOverallRisk, logReportPrintDownload } from "../services/reportBuilderService.js";
import { formatDateTime } from "../utils/dom.js";

export async function renderReportPage(root, reportType = "quick") {
  const account = getAccountStore();
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const checkId = params.get("checkId");

  if (!account.record) {
    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Login Required</p>
        <h1>You need an account to generate reports.</h1>
        <div class="hero-actions"><a class="button button-dark" href="#/login">Login</a></div>
      </section>
    `;
    return;
  }

  if (!checkId) {
    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Missing Check</p>
        <h1>No check was selected.</h1>
        <p>Run a check first, then generate a report from the logged check.</p>
        <div class="hero-actions"><a class="button button-dark" href="#/search">Run Check</a></div>
      </section>
    `;
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Generating Report</p>
      <h1>Preparing ${reportType} report...</h1>
      <p>Please wait while Cognitus gathers the check, subject, and reviewed record information.</p>
    </section>
  `;

  try {
    const reportData = await buildReportFromCheck(checkId, account.record, reportType);
    root.innerHTML = renderReportDocument(reportData);
    attachReportActions(root, account.record, checkId, reportType);
  } catch (error) {
    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Report Error</p>
        <h1>Report could not be generated.</h1>
        <p>${error?.message || "Something went wrong."}</p>
        <div class="hero-actions"><a class="button button-dark" href="#/history">Back to History</a></div>
      </section>
    `;
  }
}

function renderReportDocument(reportData) {
  const recommendation = getOverallRecommendation(reportData);
  const risk = getOverallRisk(reportData);
  const subject = reportData.subject;
  const check = reportData.check;

  return `
    <section class="report-toolbar no-print">
      <a class="button button-light" href="#/history">Back to History</a>
      <button id="print-report" class="button button-dark" type="button">Print / Save PDF</button>
    </section>

    <article class="report-document">
      <header class="report-header">
        <div>
          <p class="eyebrow">Cognitus Solutions</p>
          <h1>${reportData.reportType === "full" ? "Comprehensive" : "Quick"} Employment Screening Report</h1>
        </div>
        <div class="report-id-card">
          <span>Report Reference</span>
          <strong>${reportData.reportReference}</strong>
          <small>Generated ${formatDateTime(reportData.generatedAt)}</small>
        </div>
      </header>

      <section class="report-section report-summary-grid">
        <div>
          <h2>Overall Recommendation</h2>
          <p class="report-large">${recommendation}</p>
        </div>
        <div>
          <h2>Overall Risk</h2>
          <p class="report-large">${risk}</p>
        </div>
      </section>

      <section class="report-section">
        <h2>Requested By</h2>
        <dl class="report-dl">
          <dt>User</dt><dd>${reportData.requestedBy.displayName}</dd>
          <dt>Cognitus ID</dt><dd>${reportData.requestedBy.cognitusId}</dd>
          <dt>Discord ID</dt><dd>${reportData.requestedBy.discordId}</dd>
          <dt>Check Reason</dt><dd>${check.reason || "Not listed"}</dd>
          <dt>Check Query</dt><dd>${check.searchQuery || "Not listed"}</dd>
        </dl>
      </section>

      <section class="report-section">
        <h2>Subject</h2>
        ${subject ? renderSubject(reportData.subjectType, subject) : renderNoSubject(check)}
      </section>

      <section class="report-section">
        <h2>Reviewed Records</h2>
        ${renderReviewedRecords(reportData)}
      </section>

      ${reportData.reportType === "full" ? renderFullSections(reportData) : ""}

      <section class="report-section disclaimer">
        <h2>Disclaimer</h2>
        <p>${reportData.disclaimer}</p>
      </section>
    </article>
  `;
}

function renderSubject(subjectType, subject) {
  if (subjectType === "Organization") {
    return `
      <dl class="report-dl">
        <dt>Name</dt><dd>${subject.name || "Unnamed Organization"}</dd>
        <dt>Cognitus ID</dt><dd>${subject.cognitusId || "Not assigned"}</dd>
        <dt>Verification</dt><dd>${subject.verificationStatus || "unverified"}</dd>
        <dt>Trust Level</dt><dd>${subject.trustLevel || "unreviewed"}</dd>
        <dt>Type</dt><dd>${subject.organizationType || "Not listed"}</dd>
      </dl>
    `;
  }

  return `
    <dl class="report-dl">
      <dt>Name</dt><dd>${subject.displayName || "Unnamed Profile"}</dd>
      <dt>Cognitus ID</dt><dd>${subject.cognitusId || "Not assigned"}</dd>
      <dt>Identity Status</dt><dd>${subject.identityStatus || "unverified"}</dd>
      <dt>Professional Standing</dt><dd>${subject.professionalStanding || "unreviewed"}</dd>
      <dt>Risk Level</dt><dd>${subject.riskLevel || "unreviewed"}</dd>
      <dt>Roblox Usernames</dt><dd>${(subject.robloxUsernames || []).join(", ") || "None listed"}</dd>
      <dt>Discord Usernames</dt><dd>${(subject.discordUsernames || []).join(", ") || "None listed"}</dd>
    </dl>
  `;
}

function renderNoSubject(check) {
  return `
    <div class="notice">
      No matching Cognitus record was found for ${check.searchType || "check"} query: <strong>${check.searchQuery || "Unknown"}</strong>.
    </div>
  `;
}

function renderReviewedRecords(reportData) {
  const reports = reportData.subjectReports || [];

  if (!reports.length) {
    return `<div class="notice">No reviewed conduct records were found for this report subject.</div>`;
  }

  return `
    <div class="report-records">
      ${reports.map((report) => `
        <article>
          <strong>${report.category || "Report"}</strong>
          <span>${report.severity || "Informational"} · ${report.status || "pending"}</span>
          <p>${report.summary || "No summary provided."}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderFullSections(reportData) {
  return `
    <section class="report-section">
      <h2>Check Metadata</h2>
      <dl class="report-dl">
        <dt>Check ID</dt><dd>${reportData.check.cognitusId || reportData.check.id}</dd>
        <dt>Search Type</dt><dd>${reportData.check.searchType}</dd>
        <dt>Search Field</dt><dd>${reportData.check.searchField}</dd>
        <dt>Additional Notes</dt><dd>${reportData.check.additionalNotes || "None"}</dd>
        <dt>Result Summary</dt><dd>${reportData.check.resultSummary || "Not listed"}</dd>
      </dl>
    </section>
  `;
}

function attachReportActions(root, actor, checkId, reportType) {
  root.querySelector("#print-report")?.addEventListener("click", async () => {
    await logReportPrintDownload({ actor, checkId, reportType });
    window.print();
  });
}
