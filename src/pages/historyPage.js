import { getAccountStore } from "../state/accountStore.js";
import { listChecksByUser } from "../services/checkService.js";
import { recordList, checkLogItem } from "../components/dashboardCards.js";

export async function renderHistoryPage(root) {
  const account = getAccountStore();

  if (!account.record) {
    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Login Required</p>
        <h1>You need an account to view check history.</h1>
        <div class="hero-actions"><a class="button button-dark" href="#/login">Login</a></div>
      </section>
    `;
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Check History</p>
      <h1>Your logged checks.</h1>
      <p>Every check you run is listed here with its search query, reason, and timestamp.</p>
    </section>
    <section class="panel" style="margin-top: 1rem;">
      <div id="history-list" class="loading-block">Loading check history...</div>
    </section>
  `;

  try {
    const checks = await listChecksByUser(account.record.uid, 75);
    root.querySelector("#history-list").innerHTML = recordList(
      checks,
      checkLogItem,
      "No checks yet",
      "Run your first person or organization check to create a history record."
    );
  } catch (error) {
    root.querySelector("#history-list").innerHTML = `<div class="notice">${error?.message || "Could not load check history."}</div>`;
  }
}
