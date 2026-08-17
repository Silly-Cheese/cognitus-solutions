import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
const nav = document.querySelector(".topnav");
const EMPLOYER_ROLES = new Set(["verified_employer_member", "org_admin", "reviewer", "admin", "owner"]);

let chromeTimers = [];
let searchWatch = null;
let firestorePromise = null;
const claimCache = new Map();

const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const clean = (value) => String(value ?? "").trim();
const humanize = (value) => clean(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function toneFor(value) {
  const normalized = clean(value).toLowerCase().replaceAll("_", " ");
  if (["good", "good standing", "low", "verified", "active", "approved", "claimed", "account linked"].includes(normalized)) return "good";
  if (["watch", "moderate", "pending", "concern", "disputed"].includes(normalized)) return "watch";
  if (["high", "restricted"].includes(normalized)) return "high";
  if (["critical", "banned", "denied"].includes(normalized)) return "critical";
  return "neutral";
}

function severityRank(tone) {
  return { neutral: 0, good: 1, watch: 2, high: 3, critical: 4 }[tone] ?? 0;
}

function mountStyles() {
  let link = document.querySelector("#cognitus-interface-v13");
  if (!link) {
    link = document.createElement("link");
    link.id = "cognitus-interface-v13";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = "./src/interfacePolishV13.css?v=20260816-v14";
}

function currentRole() {
  const text = clean(nav?.querySelector(".nav-user")?.textContent);
  if (!text) return "";
  return clean(text.split("·").at(-1)).toLowerCase();
}

function hideLegacyEmployerLinks() {
  nav?.querySelectorAll("[data-emp11-nav]").forEach((link) => {
    link.hidden = true;
    link.setAttribute("aria-hidden", "true");
    link.setAttribute("tabindex", "-1");
  });
}

function ensureEmployerHubNav() {
  if (!nav) return;
  hideLegacyEmployerLinks();
  const dashboard = nav.querySelector('a[href="#/dashboard"]');
  const eligible = Boolean(dashboard) && EMPLOYER_ROLES.has(currentRole());
  let link = nav.querySelector("[data-ui14-employer-hub]");

  if (!eligible) {
    link?.remove();
    return;
  }

  if (!link) {
    link = document.createElement("a");
    link.href = "#/employer";
    link.dataset.ui14EmployerHub = "true";
    link.textContent = "Employer Hub";
    link.title = "Open the Cognitus Employer Hub";
    link.setAttribute("aria-label", "Open the Cognitus Employer Hub");
  }

  const search = nav.querySelector('a[href="#/search"]');
  const profile = nav.querySelector('[data-profile-tab]');
  if (search && link.nextElementSibling !== search) nav.insertBefore(link, search);
  else if (!search && profile && link.previousElementSibling !== profile) profile.insertAdjacentElement("afterend", link);
  else if (!link.isConnected) nav.appendChild(link);

  const active = route().startsWith("/employer") && route() !== "/employer-status";
  link.classList.toggle("v4-active", active);
  if (active) link.setAttribute("aria-current", "page");
  else link.removeAttribute("aria-current");
}

async function firestoreServices() {
  if (!firestorePromise) {
    firestorePromise = (async () => {
      const services = await initializeFirebaseServices();
      if (!services.ready) return null;
      const Fire = await import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`);
      return { db: services.db, Fire };
    })();
  }
  return firestorePromise;
}

async function profileClaimState(profileId) {
  if (!profileId) return null;
  if (!claimCache.has(profileId)) {
    claimCache.set(profileId, (async () => {
      const services = await firestoreServices();
      if (!services) return null;
      const snap = await services.Fire.getDoc(services.Fire.doc(services.db, "profiles", profileId));
      if (!snap.exists()) return null;
      const profile = snap.data();
      return Boolean(profile.linkedUserId || profile.claimedByUid || clean(profile.identityStatus).toLowerCase() === "claimed");
    })().catch(() => null));
  }
  return claimCache.get(profileId);
}

function profileIdFromClaimLink(link) {
  const href = link?.getAttribute("href") || "";
  const query = href.includes("?") ? href.split("?").slice(1).join("?") : "";
  return new URLSearchParams(query).get("profileId") || "";
}

async function syncClaimState(card, badge) {
  const claimLink = card.querySelector('a[href^="#/claims?profileId="]');
  if (!claimLink) {
    if (badge) {
      badge.textContent = "Claimed profile";
      badge.className = "ui14-claim-state is-good";
    }
    return;
  }

  const profileId = profileIdFromClaimLink(claimLink);
  if (!profileId) return;
  claimLink.hidden = true;
  claimLink.setAttribute("aria-hidden", "true");
  if (badge) {
    badge.textContent = "Checking claim…";
    badge.className = "ui14-claim-state is-neutral";
  }

  const claimed = await profileClaimState(profileId);
  if (claimed === true) {
    claimLink.remove();
    if (badge) {
      badge.textContent = "Claimed profile";
      badge.className = "ui14-claim-state is-good";
    }
    return;
  }

  claimLink.hidden = false;
  claimLink.removeAttribute("aria-hidden");
  claimLink.textContent = "Claim this profile";
  if (badge) {
    badge.textContent = claimed === false ? "Unclaimed profile" : "Claim status unavailable";
    badge.className = "ui14-claim-state is-neutral";
  }
}

function metric(label, value, tone = "neutral") {
  const item = document.createElement("div");
  item.className = `ui14-metric is-${tone}`;
  const name = document.createElement("span");
  name.textContent = label;
  const result = document.createElement("strong");
  result.textContent = humanize(value);
  item.append(name, result);
  return item;
}

function resultHeader(card, claimBadge = null) {
  const eyebrow = card.querySelector(":scope > .eyebrow");
  const title = card.querySelector(":scope > h3");
  if (!eyebrow || !title) return null;
  const header = document.createElement("div");
  header.className = "ui14-result-header";
  const titleBlock = document.createElement("div");
  titleBlock.className = "ui14-result-title";
  titleBlock.append(eyebrow, title);
  header.append(titleBlock);
  if (claimBadge) header.append(claimBadge);
  card.prepend(header);
  return header;
}

function decoratePersonResult(card) {
  if (!card) return;
  if (card.dataset.ui14Decorated === "true") {
    syncClaimState(card, card.querySelector(".ui14-claim-state"));
    return;
  }

  const metaBox = card.querySelector(".record-meta");
  const meta = [...(metaBox?.querySelectorAll("span") || [])];
  const riskNode = meta.find((node) => clean(node.textContent).toLowerCase().startsWith("risk:"));
  if (!riskNode) return decorateOrganizationResult(card);

  const standingNode = [...card.children].find((node) => node.tagName === "P" && !node.classList.contains("eyebrow"));
  const standing = clean(standingNode?.textContent || "unreviewed");
  const risk = clean(riskNode.textContent.replace(/^risk:\s*/i, "")) || "unreviewed";
  const identityNode = meta.find((node) => node !== riskNode && node !== meta[0]);
  const identity = clean(identityNode?.textContent || "self_declared");
  const standingTone = toneFor(standing);
  const riskTone = toneFor(risk);
  const identityTone = toneFor(identity);
  const overallTone = standingTone === "neutral" || riskTone === "neutral"
    ? "neutral"
    : (severityRank(riskTone) >= severityRank(standingTone) ? riskTone : standingTone);

  card.classList.add("ui14-result-card", "ui14-person-result");
  card.dataset.assessmentTone = overallTone;
  const claimBadge = document.createElement("span");
  claimBadge.className = "ui14-claim-state is-neutral";
  claimBadge.textContent = "Checking claim…";
  resultHeader(card, claimBadge);

  const assessment = document.createElement("div");
  assessment.className = "ui14-assessment-grid";
  assessment.append(
    metric("Professional standing", standing, standingTone),
    metric("Risk level", risk, riskTone),
    metric("Identity", identity, identityTone)
  );
  card.querySelector(".ui14-result-header")?.insertAdjacentElement("afterend", assessment);

  standingNode?.remove();
  riskNode.remove();
  identityNode?.remove();
  if (meta[0]) {
    const rawId = clean(meta[0].textContent).replace(/^Cognitus ID\s*[·:]?\s*/i, "");
    meta[0].textContent = `Cognitus ID · ${rawId}`;
    meta[0].classList.add("ui14-id-chip");
  }
  metaBox?.classList.add("ui14-result-meta");
  card.querySelector(".alias-list")?.classList.add("ui14-identity-list");
  card.querySelector(".hero-actions")?.classList.add("ui14-result-actions");
  card.dataset.ui14Decorated = "true";
  syncClaimState(card, claimBadge);
}

function decorateOrganizationResult(card) {
  if (!card || card.dataset.ui14Decorated === "true") return;
  const metaBox = card.querySelector(".record-meta");
  const meta = [...(metaBox?.querySelectorAll("span") || [])];
  const verification = clean(meta[1]?.textContent || "pending_verification");
  const trust = clean(meta[2]?.textContent || "unreviewed");
  const overallTone = toneFor(trust) === "neutral" ? toneFor(verification) : toneFor(trust);

  card.classList.add("ui14-result-card", "ui14-org-result");
  card.dataset.assessmentTone = overallTone;
  resultHeader(card);

  const assessment = document.createElement("div");
  assessment.className = "ui14-assessment-grid ui14-assessment-grid-org";
  assessment.append(metric("Verification", verification, toneFor(verification)), metric("Trust", trust, toneFor(trust)));
  card.querySelector(".ui14-result-header")?.insertAdjacentElement("afterend", assessment);

  if (meta[0]) {
    const rawId = clean(meta[0].textContent).replace(/^Cognitus ID\s*[·:]?\s*/i, "");
    meta[0].textContent = `Cognitus ID · ${rawId}`;
    meta[0].classList.add("ui14-id-chip");
  }
  meta.slice(1).forEach((node) => node.remove());
  metaBox?.classList.add("ui14-result-meta");
  card.querySelector(".hero-actions")?.classList.add("ui14-result-actions");
  card.dataset.ui14Decorated = "true";
}

function addResultSummary(resultsRoot, count) {
  if (!resultsRoot || resultsRoot.querySelector(":scope > .ui14-results-summary")) return;
  const checkReference = clean(root?.querySelector("#check-reference")?.textContent);
  const summary = document.createElement("section");
  summary.className = "ui14-results-summary";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.textContent = "Logged screening result";
  const title = document.createElement("strong");
  title.textContent = count === 1 ? "1 Cognitus record matched" : `${count} Cognitus records matched`;
  const note = document.createElement("small");
  note.textContent = count === 1 ? "Review the matched identity, assessment, and available actions below." : "Multiple records matched. Compare identities carefully before continuing.";
  copy.append(eyebrow, title, note);
  const reference = document.createElement("div");
  reference.className = "ui14-summary-reference";
  reference.textContent = checkReference || "Logged check";
  summary.append(copy, reference);
  resultsRoot.prepend(summary);
}

function finalizeSearchResults() {
  if (route() !== "/search" || !root) return false;
  const resultsRoot = root.querySelector("#search-results");
  if (!resultsRoot) return false;
  const cards = [...resultsRoot.querySelectorAll(".result-card")];
  const error = resultsRoot.querySelector(".notice-error");
  const noMatch = resultsRoot.querySelector(".empty-state h3");
  const checkReference = clean(root.querySelector("#check-reference")?.textContent);
  const finished = cards.length > 0 || Boolean(error) || (Boolean(checkReference) && Boolean(noMatch));
  if (!finished) return false;

  resultsRoot.closest(".panel")?.classList.remove("is-running");
  resultsRoot.classList.add("ui14-results-complete");
  if (cards.length) {
    addResultSummary(resultsRoot, cards.length);
    cards.forEach(decoratePersonResult);
    const reportActions = [...resultsRoot.children].find((node) => node.classList?.contains("hero-actions"));
    if (reportActions) {
      reportActions.classList.add("ui14-report-actions");
      if (!reportActions.querySelector(".ui14-report-actions-copy")) {
        const copy = document.createElement("div");
        copy.className = "ui14-report-actions-copy";
        const strong = document.createElement("strong");
        strong.textContent = "Continue the screening review";
        const small = document.createElement("small");
        small.textContent = "Generate a Quick or Full report from this logged check.";
        copy.append(strong, small);
        reportActions.prepend(copy);
      }
    }
  } else if (noMatch) {
    resultsRoot.querySelector(".empty-state")?.classList.add("ui14-no-match");
  }
  return true;
}

function decorateSearchChrome() {
  const onSearch = route() === "/search";
  document.body.classList.toggle("cognitus-search-v14", onSearch);
  document.body.classList.remove("cognitus-search-v13");
  if (!onSearch || !root) return;

  root.querySelector(".hero.hero-wide")?.classList.add("ui14-search-hero");
  root.querySelector(".search-layout")?.classList.add("ui14-search-layout");
  root.querySelector("#search-form")?.classList.add("ui14-search-form");
  root.querySelector(".search-layout > aside")?.classList.add("ui14-search-standards");
  root.querySelector("#check-reference")?.classList.add("ui14-check-reference");
  const results = root.querySelector("#search-results");
  results?.closest(".panel")?.classList.add("ui14-results-panel");
  results?.classList.add("ui14-results-root");
  finalizeSearchResults();
}

function decorateEmployerHub() {
  const onEmployer = route().startsWith("/employer") && route() !== "/employer-status";
  document.body.classList.toggle("cognitus-employer-v14", onEmployer);
  document.body.classList.remove("cognitus-employer-v13");
}

function startSearchWatch() {
  if (searchWatch) clearInterval(searchWatch);
  const started = Date.now();
  root?.querySelector("#search-results")?.closest(".panel")?.classList.add("is-running");
  searchWatch = window.setInterval(() => {
    if (route() !== "/search" || Date.now() - started > 20000) {
      clearInterval(searchWatch);
      searchWatch = null;
      return;
    }
    decorateSearchChrome();
    if (finalizeSearchResults()) {
      clearInterval(searchWatch);
      searchWatch = null;
    }
  }, 220);
}

function decorate() {
  ensureEmployerHubNav();
  decorateSearchChrome();
  decorateEmployerHub();
}

function scheduleChrome() {
  chromeTimers.forEach(clearTimeout);
  chromeTimers = [0, 140, 480, 1100, 2600].map((delay) => setTimeout(decorate, delay));
}

mountStyles();
document.addEventListener("submit", (event) => {
  if (event.target?.id === "search-form") startSearchWatch();
});
window.addEventListener("hashchange", () => {
  claimCache.clear();
  if (searchWatch) {
    clearInterval(searchWatch);
    searchWatch = null;
  }
  scheduleChrome();
});
window.addEventListener("pageshow", scheduleChrome);
window.addEventListener("DOMContentLoaded", scheduleChrome);
scheduleChrome();
