import * as C from "./promotionalCoreV26.js";

const STYLE_ID = "cognitus-promotional-workspaces-v30";
let timers = [];

const WORKSPACES = {
  intelligence_center: {
    mode: "INTELLIGENCE DESK",
    stage: "Subject Intelligence",
    title: "Assemble a complete authorized view",
    hint: "Search one Cognitus subject and bring identity, employment, screening, and check activity into one analysis surface.",
    form: "[data-intel-search]",
    result: "[data-intel-result]"
  },
  relationship_mapping: {
    mode: "RELATIONSHIP GRAPH",
    stage: "Graph Builder",
    title: "Turn known records into a visual network",
    hint: "Map account identifiers, organizations, aliases, and authorized employment relationships around one subject.",
    form: "[data-map-search]",
    result: "[data-map-result]"
  },
  deep_history: {
    mode: "HISTORICAL VIEW",
    stage: "Timeline Builder",
    title: "Read the record as a sequence, not a snapshot",
    hint: "Build a chronological view from profile creation, authorized employment records, and accessible reports.",
    form: "[data-history-search]",
    result: "[data-history-result]"
  },
  advanced_search: {
    mode: "DISCOVERY CONSOLE",
    stage: "Advanced Discovery",
    title: "Filter the Cognitus profile universe",
    hint: "Combine identity, standing, risk, aliases, usernames, and names without needing an exact match.",
    form: "[data-advanced-search]",
    result: "[data-advanced-results]"
  },
  account_comparison: {
    mode: "COMPARISON DESK",
    stage: "Side-by-Side Analysis",
    title: "Compare two records without losing context",
    hint: "Differences in identity, standing, risk, Discord, Roblox, and account metadata are surfaced together.",
    form: "[data-compare-form]",
    result: "[data-compare-result]"
  },
  network_explorer: {
    mode: "ORGANIZATION GRAPH",
    stage: "Network Explorer",
    title: "Move from an organization to its known people",
    hint: "Explore authorized employment links and move directly into subject intelligence when a profile needs deeper review.",
    form: "[data-network-form]",
    result: "[data-network-result]"
  },
  watchlist: {
    mode: "WATCH DESK",
    stage: "Private Monitoring List",
    title: "Keep important subjects within reach",
    hint: "Save a profile with a private reason or note and reopen its intelligence view without starting from scratch.",
    form: "[data-watch-form]"
  },
  saved_investigations: {
    mode: "CASE WORKSPACE",
    stage: "Investigation Builder",
    title: "Give research a durable workspace",
    hint: "Group a subject, organization, and private notes into a saved investigation you can return to later.",
    form: "[data-investigation-form]"
  },
  intelligence_reports: {
    mode: "REPORT STUDIO",
    stage: "Report Generator",
    title: "Turn authorized records into a clean deliverable",
    hint: "Generate, print, save, and revisit intelligence summaries while preserving the same Cognitus access boundaries.",
    form: "[data-report-form]",
    result: "[data-report-output]"
  },
  change_comparison: {
    mode: "SNAPSHOT VAULT",
    stage: "Snapshot Capture",
    title: "Preserve what a record looked like at a moment in time",
    hint: "Capture current profile state so later changes in standing, risk, identity, and usernames are easier to understand.",
    form: "[data-snapshot-form]"
  },
  cognitus_labs: {
    mode: "EXPERIMENTAL CHANNEL",
    stage: "Cognitus Labs",
    title: "Preview tools before they become ordinary",
    hint: "Labs is the experimental surface for promotional capabilities, early interfaces, and developing Cognitus workflows."
  },
  enhanced_profile: {
    mode: "PROFILE STUDIO",
    stage: "Card Designer",
    title: "Give your Cognitus presence a deliberate identity",
    hint: "Tune the private promotional profile card that represents your account inside the Cognitus experience.",
    form: "[data-profile-style]"
  },
  search_collections: {
    mode: "RESEARCH LIBRARY",
    stage: "Collection Builder",
    title: "Organize profiles and organizations into reusable sets",
    hint: "Create private collections for recurring searches, teams, applicant pools, research targets, or review groups.",
    form: "[data-collection-form]"
  },
  search_analytics: {
    mode: "USAGE COCKPIT",
    stage: "Search Analytics",
    title: "Understand how you are using Cognitus",
    hint: "See logged checks, promotional searches, feature usage, reasons, and recent activity in one analysis surface."
  },
  early_access: {
    mode: "RELEASE CHANNEL",
    stage: "Early Access Board",
    title: "See what is available, previewing, and protected",
    hint: "Track the promotional release channel and the boundary between product access and administrative authority."
  }
};

function mountStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = "./src/promotionalWorkspacesV30.css?v=20260904-v30";
  document.head.appendChild(link);
}

function currentFeature() {
  return C.FEATURE_BY_ROUTE.get(C.currentRoute()) || null;
}

function workspaceMeta() {
  const feature = currentFeature();
  return feature ? WORKSPACES[feature.id] || null : null;
}

function commandStrip(feature, meta) {
  return `<section class="promo30-command-strip" data-promo30-command>
    <div class="promo30-command-brand"><span>COGNITUS / ${C.safe(meta.mode)}</span><strong>${C.safe(feature.short)}</strong></div>
    <div class="promo30-command-signals">
      <span><i></i> Promotional entitlement active</span>
      <span>Authorized records only</span>
    </div>
    <div class="promo30-command-actions">
      <a href="#/promotional-access">All Promo Tools</a>
      <a href="#/labs">Labs</a>
    </div>
  </section>`;
}

function stageHeader(meta) {
  return `<div class="promo30-stage-head" data-promo30-stage-head>
    <div><span>${C.safe(meta.stage)}</span><h2>${C.safe(meta.title)}</h2><p>${C.safe(meta.hint)}</p></div>
    <span class="promo30-stage-status"><i></i> Ready</span>
  </div>`;
}

function emptyVisual(label = "Workspace ready") {
  return `<div class="promo30-empty-visual" aria-hidden="true"><span></span><span></span><span></span></div><strong class="promo30-empty-title">${C.safe(label)}</strong>`;
}

function decorateRoot(feature, meta) {
  if (!C.root) return;
  C.root.classList.add("promo30-workspace");
  C.root.dataset.promo30Feature = feature.id;
  const hero = C.root.querySelector(".promo26-feature-hero");
  if (hero && !C.root.querySelector("[data-promo30-command]")) hero.insertAdjacentHTML("afterend", commandStrip(feature, meta));
}

function decorateToolStage(meta) {
  if (!meta.form) return;
  const form = C.root?.querySelector(meta.form);
  if (!form) return;
  const section = form.closest(".promo26-feature-section") || form.parentElement;
  if (!section) return;
  section.classList.add("promo30-tool-stage");
  if (!section.querySelector("[data-promo30-stage-head]")) section.insertAdjacentHTML("afterbegin", stageHeader(meta));
  form.classList.add("promo30-primary-control");
}

function decorateEmpty(result, label) {
  if (!result || !result.classList.contains("empty-state") || result.dataset.promo30Empty) return;
  result.dataset.promo30Empty = "true";
  result.classList.add("promo30-empty-state");
  result.insertAdjacentHTML("afterbegin", emptyVisual(label));
}

function decorateResults(feature, meta) {
  if (meta.result) {
    const result = C.root?.querySelector(meta.result);
    if (result) {
      result.classList.add("promo30-result-stage");
      decorateEmpty(result, feature.id === "relationship_mapping" ? "Graph waiting for a subject" : feature.id === "account_comparison" ? "Comparison waiting for two profiles" : "Workspace waiting for input");
    }
  }

  if (feature.id === "intelligence_center") {
    C.root?.querySelectorAll("[data-intel-result] > .promo26-feature-section").forEach((section, index) => section.classList.add(index === 0 ? "promo30-subject-dossier" : "promo30-intel-section"));
    C.root?.querySelector("[data-intel-result] > .promo26-metric-grid")?.classList.add("promo30-intel-metrics");
    C.root?.querySelector("[data-intel-result] > .promo26-two-col")?.classList.add("promo30-evidence-grid");
  }

  if (feature.id === "relationship_mapping") {
    const map = C.root?.querySelector(".promo26-network-map");
    if (map && !map.querySelector("[data-promo30-map-legend]")) {
      map.classList.add("promo30-graph-canvas");
      map.insertAdjacentHTML("afterbegin", `<div class="promo30-map-legend" data-promo30-map-legend><span><i class="is-subject"></i> Subject</span><span><i class="is-link"></i> Known connection</span><span><i class="is-boundary"></i> Authorized data only</span></div>`);
    }
  }

  if (feature.id === "deep_history") C.root?.querySelector(".promo26-timeline")?.classList.add("promo30-history-stream");

  if (feature.id === "advanced_search") {
    const form = C.root?.querySelector("[data-advanced-search]");
    form?.classList.add("promo30-filter-console");
    const results = C.root?.querySelector("[data-advanced-results]");
    if (results) {
      results.classList.add("promo30-discovery-results");
      const count = results.querySelectorAll(".promo26-record-card").length;
      let summary = results.previousElementSibling;
      if (!summary?.matches("[data-promo30-results-summary]")) {
        results.insertAdjacentHTML("beforebegin", `<div class="promo30-results-summary" data-promo30-results-summary><span>Discovery results</span><strong>${count} profile${count === 1 ? "" : "s"}</strong></div>`);
      } else summary.querySelector("strong").textContent = `${count} profile${count === 1 ? "" : "s"}`;
    }
  }

  if (feature.id === "account_comparison") {
    const table = C.root?.querySelector(".promo26-compare-table");
    if (table) {
      table.classList.add("promo30-comparison-board");
      if (!table.previousElementSibling?.matches("[data-promo30-compare-note]")) table.insertAdjacentHTML("beforebegin", `<div class="promo30-compare-note" data-promo30-compare-note><span>Comparison result</span><strong>Differences are emphasized automatically</strong></div>`);
    }
  }

  if (feature.id === "network_explorer") C.root?.querySelector("[data-network-result] .promo26-feature-section")?.classList.add("promo30-network-result");

  if (feature.id === "intelligence_reports") {
    C.root?.querySelector("[data-report-output]")?.classList.add("promo30-report-output");
    C.root?.querySelector(".promo26-intel-report")?.classList.add("promo30-report-document");
    C.root?.querySelector(".promo26-report-toolbar")?.classList.add("promo30-report-toolbar");
  }
}

function decorateSavedWorkspaces(feature, meta) {
  if (!["watchlist", "saved_investigations", "change_comparison", "search_collections"].includes(feature.id)) return;
  const twoCol = C.root?.querySelector(".promo26-two-col");
  if (!twoCol) return;
  twoCol.classList.add("promo30-saved-workspace");
  const form = meta.form ? C.root.querySelector(meta.form) : null;
  form?.classList.add("promo30-workspace-composer");
  const saved = Array.from(twoCol.children).find((node) => node !== form && node.classList?.contains("promo26-feature-section"));
  saved?.classList.add("promo30-workspace-vault");
  saved?.querySelector(".promo26-workspace-list")?.classList.add("promo30-vault-list");
}

function decorateSpecial(feature, meta) {
  if (feature.id === "cognitus_labs") {
    const section = C.root?.querySelector(".promo26-feature-section");
    section?.classList.add("promo30-labs-deck");
    section?.querySelector(".promo26-record-grid")?.classList.add("promo30-labs-grid");
    if (section && !section.querySelector("[data-promo30-stage-head]")) section.insertAdjacentHTML("afterbegin", stageHeader(meta));
  }

  if (feature.id === "enhanced_profile") {
    C.root?.querySelector(".promo26-two-col")?.classList.add("promo30-profile-studio");
    C.root?.querySelector("[data-profile-style]")?.classList.add("promo30-profile-controls");
    C.root?.querySelector(".promo26-profile-preview")?.classList.add("promo30-profile-card-preview");
  }

  if (feature.id === "search_analytics") {
    C.root?.classList.add("promo30-analytics-cockpit");
    C.root?.querySelector(".promo26-metric-grid")?.classList.add("promo30-analytics-metrics");
    C.root?.querySelector(".promo26-two-col")?.classList.add("promo30-analytics-detail");
    C.root?.querySelector(".promo26-bars")?.classList.add("promo30-analytics-bars");
  }

  if (feature.id === "early_access") {
    const section = C.root?.querySelector(".promo26-feature-section");
    section?.classList.add("promo30-release-board");
    section?.querySelector(".promo26-release-list")?.classList.add("promo30-release-track");
    if (section && !section.querySelector("[data-promo30-stage-head]")) section.insertAdjacentHTML("afterbegin", stageHeader(meta));
  }
}

function decorateCards(feature) {
  C.root?.querySelectorAll(".promo26-record-card").forEach((card, index) => {
    card.classList.add("promo30-record-card");
    card.style.setProperty("--promo30-order", String(index));
  });
  C.root?.querySelectorAll(".promo26-workspace-list > article").forEach((card, index) => {
    card.classList.add("promo30-vault-card");
    card.style.setProperty("--promo30-order", String(index));
  });
  if (feature.id === "cognitus_labs") C.root?.querySelectorAll(".promo26-record-card").forEach((card) => card.classList.add("promo30-lab-card"));
}

function sync() {
  mountStyles();
  const feature = currentFeature();
  const meta = workspaceMeta();
  if (!C.root) return;
  if (!feature || !meta) {
    C.root.classList.remove("promo30-workspace", "promo30-analytics-cockpit");
    delete C.root.dataset.promo30Feature;
    return;
  }
  decorateRoot(feature, meta);
  decorateToolStage(meta);
  decorateResults(feature, meta);
  decorateSavedWorkspaces(feature, meta);
  decorateSpecial(feature, meta);
  decorateCards(feature);
}

function scheduleSync() {
  timers.forEach(clearTimeout);
  timers = [0, 80, 180, 360, 700, 1200, 1900].map((delay) => setTimeout(sync, delay));
}

export function startPromotionalWorkspacesV30() {
  mountStyles();
  scheduleSync();
  window.addEventListener("hashchange", scheduleSync);
  window.addEventListener("pageshow", scheduleSync);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleSync(); });
  document.addEventListener("submit", (event) => {
    if (event.target.closest?.(".promo30-workspace, [data-promo-v26-page]")) setTimeout(scheduleSync, 40);
  }, true);
  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".promo30-workspace button, .promo30-workspace a")) setTimeout(scheduleSync, 80);
  }, true);
}
