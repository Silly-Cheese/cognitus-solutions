import { getAccountStore } from "../state/accountStore.js";
import { getFormData, normalizeInput } from "../utils/validation.js";
import { submitReport, REPORT_CATEGORIES } from "../services/reportService.js";
import { SEVERITY_LEVELS } from "../data/constants.js";

export function renderReportSubmitPage(root) {
  const account = getAccountStore();

  if (!account.record) {
    root.innerHTML = loginRequired("submit reports");
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Submit Report</p>
      <h1>Create a reviewable record.</h1>
      <p>Reports do not publish automatically. They are submitted to a review queue before becoming part of a Cognitus profile or organization record.</p>
    </section>

    <section class="form-card wide-form">
      <div id="report-message" class="notice" hidden></div>
      <form id="report-form" class="form-stack">
        <div class="form-row">
          <label>
            Subject Type
            <select name="subjectType" required>
              <option value="profile">Person Profile</option>
              <option value="organization">Organization</option>
            </select>
          </label>
          <label>
            Subject Document ID
            <input name="subjectId" type="text" placeholder="Firestore document ID from a search result" required />
          </label>
        </div>

        <div class="form-row">
          <label>
            Category
            <select name="category" required>
              ${REPORT_CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("")}
            </select>
          </label>
          <label>
            Severity
            <select name="severity" required>
              ${SEVERITY_LEVELS.map((level) => `<option value="${level}">${level}</option>`).join("")}
            </select>
          </label>
        </div>

        <label>
          Summary
          <input name="summary" type="text" placeholder="Brief professional summary" required />
        </label>

        <label>
          Details
          <textarea name="details" rows="6" placeholder="Explain the situation, context, and why it matters for review." required></textarea>
        </label>

        <button class="button button-dark" type="submit">Submit for Review</button>
      </form>
    </section>
  `;

  const form = root.querySelector("#report-form");
  const message = root.querySelector("#report-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = getFormData(form);

    if (!normalizeInput(data.summary) || !normalizeInput(data.details)) {
      showMessage(message, "Summary and details are required.");
      return;
    }

    try {
      setBusy(form, true, "Submitting...");
      const reportId = await submitReport({
        actor: account.record,
        subjectProfileId: data.subjectType === "profile" ? data.subjectId : null,
        subjectOrganizationId: data.subjectType === "organization" ? data.subjectId : null,
        category: data.category,
        severity: data.severity,
        summary: data.summary,
        details: data.details
      });
      form.reset();
      showMessage(message, `Report submitted for review. Reference: ${reportId}`);
    } catch (error) {
      showMessage(message, error?.message || "Report submission failed.");
    } finally {
      setBusy(form, false, "Submit for Review");
    }
  });
}

function loginRequired(action) {
  return `<section class="hero"><p class="eyebrow">Login Required</p><h1>You need an account to ${action}.</h1><div class="hero-actions"><a class="button button-dark" href="#/login">Login</a></div></section>`;
}

function showMessage(element, text) {
  element.textContent = text;
  element.hidden = false;
}

function setBusy(form, busy, text) {
  const button = form.querySelector("button[type='submit']");
  button.disabled = busy;
  button.textContent = text;
}
