import { formatDateTime } from "../utils/dom.js";

export function statCard(label, value, help = "") {
  return `
    <article class="stat-card">
      <span>${label}</span>
      <strong>${value}</strong>
      ${help ? `<small>${help}</small>` : ""}
    </article>
  `;
}

export function emptyState(title, message, actionHref = "", actionLabel = "") {
  return `
    <div class="empty-state">
      <h3>${title}</h3>
      <p>${message}</p>
      ${actionHref && actionLabel ? `<a class="button button-light" href="${actionHref}">${actionLabel}</a>` : ""}
    </div>
  `;
}

export function recordList(items, renderItem, emptyTitle, emptyMessage) {
  if (!items?.length) {
    return emptyState(emptyTitle, emptyMessage);
  }

  return `<div class="record-list">${items.map(renderItem).join("")}</div>`;
}

export function checkLogItem(check) {
  return `
    <article class="record-row record-row-actions">
      <div>
        <strong>${check.searchQuery || "Unknown Search"}</strong>
        <span>${check.searchType || "Check"} · ${check.reason || "No reason listed"}</span>
        <small>${formatDateTime(check.createdAt?.toDate?.() || check.createdAt)}</small>
      </div>
      <div class="mini-actions">
        <a href="#/reports/quick?checkId=${check.id}">Quick</a>
        <a href="#/reports/full?checkId=${check.id}">Full</a>
      </div>
    </article>
  `;
}

export function savedCandidateItem(candidate) {
  return `
    <article class="record-row">
      <div>
        <strong>${candidate.label || "Saved Candidate"}</strong>
        <span>Status: ${candidate.status || "Saved"}</span>
      </div>
      <small>${formatDateTime(candidate.createdAt?.toDate?.() || candidate.createdAt)}</small>
    </article>
  `;
}

export function savedOrganizationItem(savedOrg) {
  return `
    <article class="record-row">
      <div>
        <strong>${savedOrg.label || "Saved Organization"}</strong>
        <span>Organization record saved for review.</span>
      </div>
      <small>${formatDateTime(savedOrg.createdAt?.toDate?.() || savedOrg.createdAt)}</small>
    </article>
  `;
}

export function notificationItem(notification) {
  return `
    <article class="record-row ${notification.read ? "" : "record-row-strong"}">
      <div>
        <strong>${notification.title || "Notification"}</strong>
        <span>${notification.message || "No additional details."}</span>
      </div>
      <small>${formatDateTime(notification.createdAt?.toDate?.() || notification.createdAt)}</small>
    </article>
  `;
}
