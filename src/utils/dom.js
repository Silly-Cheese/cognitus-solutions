import { APP_NAME } from "../data/constants.js";

export function setPageTitle(title) {
  document.title = title ? `${title} | ${APP_NAME}` : APP_NAME;
}

export function normalizeInput(value) {
  return String(value || "").trim();
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDateTime(dateLike) {
  if (!dateLike) return "Not available";

  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
