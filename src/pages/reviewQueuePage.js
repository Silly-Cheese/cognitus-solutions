import { getAccountStore } from "../state/accountStore.js";
import { isReviewerOrHigher } from "../security/permissions.js";
import { listPendingReports, updateReportStatus } from "../services/reportService.js";
import { listPendingClaims, updateClaimStatus } from "../services/claimService.js";
import { listPendingAppeals, updateAppealStatus } from "../services/appealService.js";
import { reviewQueueSection } from "../components/reviewCards.js";

export async function renderReviewQueuePage(root) {
  const account = getAccountStore();

  if (!account.record) {
    root.innerHTML = accessCard("Login Required", "You must log in before accessing review queues.", "#/login", "Login");
    return;
  }

  if (!isReviewerOrHigher(account.record)) {
    root.innerHTML = accessCard("Access Denied", "This area requires Reviewer, Admin, or Owner permissions.", "#/dashboard", "Back to Dashboard");
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Review Queue</p>
      <h1>Pending Cognitus workflows.</h1>
      <p>Review submitted reports, profile claims, and appeals. These queues prepare the operational side of Cognitus for full admin action controls.</p>
    </section>
    <section id="review-queues" class="dashboard-grid" style="margin-top: 1rem;">
      <div class="loading-block">Loading review queues...</div>
    </section>
  `;

  try {
    const [reports, claims, appeals] = await Promise.all([
      listPendingReports(25),
      listPendingClaims(25),
      listPendingAppeals(25)
    ]);

    root.querySelector("#review-queues").innerHTML = `
      ${reviewQueueSection("Pending Reports", reports, "Report", "No reports are waiting for review.")}
      ${reviewQueueSection("Pending Claims", claims, "Claim", "No profile claims are waiting for review.")}
      ${reviewQueueSection("Pending Appeals", appeals, "Appeal", "No appeals are waiting for review.")}
    `;

    attachQueueActions(root, account.record);
  } catch (error) {
    root.querySelector("#review-queues").innerHTML = `<div class="notice">${error?.message || "Could not load review queues."}</div>`;
  }
}

function attachQueueActions(root, actor) {
  root.querySelectorAll(".workflow-card").forEach((card) => {
    const actions = document.createElement("div");
    actions.className = "mini-actions";
    actions.innerHTML = `
      <button class="button button-light" type="button" data-action="approve">Approve</button>
      <button class="button button-light" type="button" data-action="deny">Deny</button>
    `;
    card.appendChild(actions);

    actions.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        await updateWorkflow(card.dataset.type, card.dataset.id, button.dataset.action, actor);
        card.remove();
      });
    });
  });
}

async function updateWorkflow(type, id, action, actor) {
  const status = action === "approve" ? "approved" : "denied";

  if (type === "Report") {
    return updateReportStatus(id, { status, reviewedBy: actor, decisionNotes: `Reviewer marked report ${status}.` }, actor);
  }

  if (type === "Claim") {
    return updateClaimStatus(id, { status, reviewedByUid: actor.uid, decisionNotes: `Reviewer marked claim ${status}.` }, actor);
  }

  if (type === "Appeal") {
    return updateAppealStatus(id, { status: action === "approve" ? "accepted" : "denied", reviewedByUid: actor.uid, decision: status, decisionNotes: `Reviewer marked appeal ${status}.` }, actor);
  }
}

function accessCard(eyebrow, message, href, cta) {
  return `<section class="hero"><p class="eyebrow">${eyebrow}</p><h1>${message}</h1><div class="hero-actions"><a class="button button-dark" href="${href}">${cta}</a></div></section>`;
}
