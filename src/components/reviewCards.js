import { formatDateTime } from "../utils/dom.js";

export function workflowCard(item, type) {
  const title = getTitle(item, type);
  const status = item.status || "pending_review";
  const cognitusId = item.cognitusId || item.id || "No reference";

  return `
    <article class="workflow-card" data-id="${item.id}" data-type="${type}">
      <div>
        <p class="eyebrow">${type}</p>
        <h3>${title}</h3>
        <p>${getSubtitle(item, type)}</p>
      </div>
      <div class="record-meta">
        <span>${cognitusId}</span>
        <span>${status}</span>
        <span>${formatDateTime(item.createdAt?.toDate?.() || item.createdAt)}</span>
      </div>
    </article>
  `;
}

export function reviewQueueSection(title, items, type, emptyMessage) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Review Queue</p>
          <h2>${title}</h2>
        </div>
        <span class="muted">${items.length} pending</span>
      </div>
      ${items.length ? `<div class="workflow-list">${items.map((item) => workflowCard(item, type)).join("")}</div>` : `<div class="empty-state"><h3>Nothing pending</h3><p>${emptyMessage}</p></div>`}
    </section>
  `;
}

function getTitle(item, type) {
  if (type === "Report") return item.summary || item.category || "Submitted report";
  if (type === "Claim") return `Profile Claim ${item.profileId || ""}`.trim();
  if (type === "Appeal") return item.reason || "Submitted appeal";
  return item.cognitusId || "Workflow item";
}

function getSubtitle(item, type) {
  if (type === "Report") return `${item.category || "Report"} · ${item.severity || "Informational"}`;
  if (type === "Claim") return `Submitted Discord ID: ${item.submittedDiscordId || "Not listed"}`;
  if (type === "Appeal") return item.statement || "No statement provided.";
  return "Pending review.";
}
