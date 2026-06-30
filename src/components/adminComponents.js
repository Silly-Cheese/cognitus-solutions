import { formatDateTime } from "../utils/dom.js";

export function adminTable(title, items, columns, emptyMessage) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Admin</p>
          <h2>${title}</h2>
        </div>
        <span class="muted">${items.length} shown</span>
      </div>
      ${items.length ? renderTable(items, columns) : `<div class="empty-state"><h3>No records</h3><p>${emptyMessage}</p></div>`}
    </section>
  `;
}

export function renderTable(items, columns) {
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>${columns.map((column) => `<th>${column.label}</th>`).join("")}</tr></thead>
        <tbody>
          ${items.map((item) => `<tr>${columns.map((column) => `<td>${column.render(item)}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function smallDate(value) {
  return `<small>${formatDateTime(value?.toDate?.() || value)}</small>`;
}

export function pill(value) {
  return `<span class="admin-pill">${value || "—"}</span>`;
}
