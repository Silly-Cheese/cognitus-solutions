const root = document.querySelector("#page-root");
const nav = document.querySelector(".topnav");
let timers = [];
let searchTimers = [];

const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const clean = (value) => String(value ?? "").trim();

function toneFor(value) {
  const normalized = clean(value).toLowerCase().replaceAll("_", " ");
  if (["good", "good standing", "low", "verified", "active", "approved"].includes(normalized)) return "good";
  if (["watch", "moderate", "pending", "concern"].includes(normalized)) return "watch";
  if (["high", "restricted"].includes(normalized)) return "high";
  if (["critical", "banned", "denied"].includes(normalized)) return "critical";
  return "neutral";
}

function severityRank(tone) {
  return { neutral: 0, good: 1, watch: 2, high: 3, critical: 4 }[tone] ?? 0;
}

function mountStyles() {
  if (document.querySelector("#cognitus-interface-v13")) return;
  const link = document.createElement("link");
  link.id = "cognitus-interface-v13";
  link.rel = "stylesheet";
  link.href = "./src/interfacePolishV13.css?v=20260816-1";
  document.head.appendChild(link);
}

function ensureEmployerHubNav() {
  if (!nav) return;
  const dashboard = nav.querySelector('a[href="#/dashboard"]');
  if (!dashboard) {
    nav.querySelectorAll('[data-ui13-employer-hub]').forEach((node) => node.remove());
    return;
  }

  const duplicates = [...nav.querySelectorAll('a[href="#/employer"]')];
  let link = duplicates[0] || null;
  duplicates.slice(1).forEach((node) => node.remove());

  if (!link) {
    link = document.createElement("a");
    link.href = "#/employer";
  }
  link.dataset.emp11Nav = "true";
  link.dataset.ui13EmployerHub = "true";
  link.textContent = "Employer Hub";
  link.title = "Open the Cognitus Employer Hub";
  link.setAttribute("aria-label", "Open the Cognitus Employer Hub");

  const search = nav.querySelector('a[href="#/search"]');
  const profile = nav.querySelector('[data-profile-tab]');
  if (search && link.nextElementSibling !== search) nav.insertBefore(link, search);
  else if (!search && profile) profile.insertAdjacentElement("afterend", link);
  else if (!link.isConnected) nav.appendChild(link);

  const active = route().startsWith("/employer") && route() !== "/employer-status";
  link.classList.toggle("v4-active", active);
  if (active) link.setAttribute("aria-current", "page");
  else link.removeAttribute("aria-current");
}

function decoratePersonResult(card) {
  if (!card || card.dataset.ui13Decorated === "true") return;
  const meta = [...card.querySelectorAll(".record-meta span")];
  const riskNode = meta.find((node) => clean(node.textContent).toLowerCase().startsWith("risk:"));
  if (!riskNode) {
    card.classList.add("ui13-org-result");
    card.dataset.ui13Decorated = "true";
    return;
  }

  const standingNode = [...card.children].find((node) => node.tagName === "P" && !node.classList.contains("eyebrow"));
  const standing = clean(standingNode?.textContent || "unreviewed");
  const risk = clean(riskNode.textContent.replace(/^risk:\s*/i, "")) || "unreviewed";
  const standingTone = toneFor(standing);
  const riskTone = toneFor(risk);
  const overallTone = severityRank(riskTone) >= severityRank(standingTone) ? riskTone : standingTone;

  card.classList.add("ui13-person-result");
  card.dataset.assessmentTone = overallTone;

  if (standingNode) {
    standingNode.className = "ui13-standing-line";
    standingNode.textContent = "";
    const label = document.createElement("span");
    label.textContent = "Professional standing";
    const value = document.createElement("strong");
    value.className = `ui13-assessment-chip is-${standingTone}`;
    value.textContent = standing.replaceAll("_", " ");
    standingNode.append(label, value);
  }

  riskNode.classList.add("ui13-risk-chip", `is-${riskTone}`);
  riskNode.textContent = `Risk · ${risk.replaceAll("_", " ")}`;
  card.dataset.ui13Decorated = "true";
}

function decorateSearchPage() {
  const onSearch = route() === "/search";
  document.body.classList.toggle("cognitus-search-v13", onSearch);
  if (!onSearch || !root) return;

  root.querySelector(".hero.hero-wide")?.classList.add("ui13-search-hero");
  root.querySelector(".search-layout")?.classList.add("ui13-search-layout");
  root.querySelector("#search-form")?.classList.add("ui13-search-form");
  root.querySelector(".search-layout > aside")?.classList.add("ui13-search-standards");
  root.querySelector("#check-reference")?.classList.add("ui13-check-reference");
  const results = root.querySelector("#search-results");
  results?.closest(".panel")?.classList.add("ui13-results-panel");
  results?.classList.add("ui13-results-root");
  root.querySelectorAll("#search-results .result-card").forEach(decoratePersonResult);
}

function decorateEmployerHub() {
  const onEmployer = route().startsWith("/employer") && route() !== "/employer-status";
  document.body.classList.toggle("cognitus-employer-v13", onEmployer);
  if (!onEmployer || !root) return;
  root.querySelector(".emp11-shell")?.classList.add("ui13-employer-shell");
  root.querySelector(".emp11-workspace-hero")?.classList.add("ui13-employer-hero");
  root.querySelector(".emp11-candidate-hero")?.classList.add("ui13-candidate-hero");
  root.querySelector(".emp11-tabs")?.classList.add("ui13-employer-tabs");
  root.querySelectorAll(".emp11-stat").forEach((node) => node.classList.add("ui13-employer-stat"));
  root.querySelectorAll(".emp11-person-card,.emp11-pipeline-card,.emp11-employment-card,.emp11-report-card").forEach((node) => node.classList.add("ui13-workspace-card"));
}

function decorate() {
  ensureEmployerHubNav();
  decorateSearchPage();
  decorateEmployerHub();
}

function scheduleSearchRefresh() {
  searchTimers.forEach(clearTimeout);
  searchTimers = [80, 220, 520, 1000, 1800, 3000].map((delay) => setTimeout(decorateSearchPage, delay));
}

function schedule() {
  timers.forEach(clearTimeout);
  timers = [0, 100, 320, 750, 1350, 2200].map((delay) => setTimeout(decorate, delay));
}

mountStyles();
document.addEventListener("submit", (event) => {
  if (event.target?.id === "search-form") scheduleSearchRefresh();
});
window.addEventListener("hashchange", schedule);
window.addEventListener("pageshow", schedule);
window.addEventListener("DOMContentLoaded", schedule);
schedule();
