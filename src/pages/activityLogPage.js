import { getAccountStore } from "../state/accountStore.js";
import { isAdminOrOwner } from "../security/permissions.js";
import { listRecentAuditLogs } from "../services/adminStatsService.js";
import { adminTable, pill, smallDate } from "../components/adminComponents.js";

export async function renderActivityLogPage(root) {
  const account = getAccountStore();

  if (!account.record || !isAdminOrOwner(account.record)) {
    root.innerHTML = `<section class="hero"><p class="eyebrow">Access Denied</p><h1>Admin or Owner access required.</h1><div class="hero-actions"><a class="button button-dark" href="#/dashboard">Dashboard</a></div></section>`;
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Activity Logs</p>
      <h1>Platform activity trail.</h1>
      <p>Review major account and record actions.</p>
    </section>
    <section id="activity-panel" style="margin-top: 1rem;" class="loading-block">Loading activity logs...</section>
  `;

  try {
    const logs = await listRecentAuditLogs(100);
    root.querySelector("#activity-panel").outerHTML = adminTable("Recent Activity Logs", logs, [
      { label: "Action", render: (item) => pill(item.action || "action") },
      { label: "Actor", render: (item) => item.actorCognitusId || item.actorUid || "System" },
      { label: "Target", render: (item) => item.targetType || "target" },
      { label: "Summary", render: (item) => item.summary || "No summary" },
      { label: "Time", render: (item) => smallDate(item.createdAt) }
    ], "No activity logs found.");
  } catch (error) {
    root.querySelector("#activity-panel").innerHTML = `<div class="notice">${error?.message || "Could not load activity logs."}</div>`;
  }
}
