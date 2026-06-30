import { getAccountStore } from "../state/accountStore.js";
import { getFormData, normalizeInput } from "../utils/validation.js";
import { submitAppeal, listAppealsByUser } from "../services/appealService.js";
import { recordList } from "../components/dashboardCards.js";
import { formatDateTime } from "../utils/dom.js";

export async function renderAppealsPage(root) {
  const account = getAccountStore();

  if (!account.record) {
    root.innerHTML = loginRequired("submit appeals");
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Appeals & Corrections</p>
      <h1>Dispute or correct a record.</h1>
      <p>Appeals preserve history. Reviewers can correct, remove, reduce, mark disputed, or uphold a record after review.</p>
    </section>

    <section class="workflow-layout">
      <form id="appeal-form" class="panel form-stack">
        <div id="appeal-message" class="notice" hidden></div>
        <label>
          Profile Document ID
          <input name="profileId" type="text" placeholder="Profile document ID" required />
        </label>
        <label>
          Report Document ID
          <input name="reportId" type="text" placeholder="Report document ID" required />
        </label>
        <label>
          Reason
          <input name="reason" type="text" placeholder="False, outdated, incomplete, wrong identity, etc." required />
        </label>
        <label>
          Statement
          <textarea name="statement" rows="5" placeholder="Explain what should be corrected and why." required></textarea>
        </label>
        <button class="button button-dark" type="submit">Submit Appeal</button>
      </form>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Your Appeals</p>
            <h2>Appeal History</h2>
          </div>
        </div>
        <div id="appeal-list" class="loading-block">Loading appeals...</div>
      </section>
    </section>
  `;

  const form = root.querySelector("#appeal-form");
  const message = root.querySelector("#appeal-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = getFormData(form);

    if (!normalizeInput(data.profileId) || !normalizeInput(data.reportId) || !normalizeInput(data.reason) || !normalizeInput(data.statement)) {
      showMessage(message, "All fields are required.");
      return;
    }

    try {
      setBusy(form, true, "Submitting...");
      const appealId = await submitAppeal({
        actor: account.record,
        profileId: data.profileId,
        reportId: data.reportId,
        reason: data.reason,
        statement: data.statement
      });
      form.reset();
      showMessage(message, `Appeal submitted for review. Reference: ${appealId}`);
      await hydrateAppeals(root, account.record.uid);
    } catch (error) {
      showMessage(message, error?.message || "Appeal submission failed.");
    } finally {
      setBusy(form, false, "Submit Appeal");
    }
  });

  await hydrateAppeals(root, account.record.uid);
}

async function hydrateAppeals(root, uid) {
  try {
    const appeals = await listAppealsByUser(uid, 25);
    root.querySelector("#appeal-list").innerHTML = recordList(
      appeals,
      (appeal) => `<article class="record-row"><div><strong>${appeal.cognitusId || appeal.id}</strong><span>${appeal.reason} · ${appeal.status}</span></div><small>${formatDateTime(appeal.createdAt?.toDate?.() || appeal.createdAt)}</small></article>`,
      "No appeals yet",
      "Appeals you submit will appear here."
    );
  } catch (error) {
    root.querySelector("#appeal-list").innerHTML = `<div class="notice">${error?.message || "Could not load appeals."}</div>`;
  }
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
