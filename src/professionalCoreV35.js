import * as C from "./promo/promotionalCoreV26.js";

const STYLE_ID = "cognitus-professional-core-v35";
const FEATURE_PRESENTATION = Object.freeze({
  intelligence_center: {
    name: "Intelligence Center",
    short: "Intelligence",
    description: "Review authorized identity, report, employment, and organization records in one structured subject workspace."
  },
  relationship_mapping: {
    name: "Relationship Analysis",
    short: "Relationships",
    description: "Review authorized relationships between profiles, organizations, usernames, and known employment records."
  },
  deep_history: {
    name: "Historical Record Analysis",
    short: "History Analysis",
    description: "Assemble authorized Cognitus records into a chronological subject history for contextual review."
  },
  advanced_search: {
    name: "Advanced Record Search",
    short: "Advanced Search",
    description: "Search profiles using identity fields, standing, aliases, usernames, and other authorized record attributes."
  },
  account_comparison: {
    name: "Profile Comparison",
    short: "Comparison",
    description: "Compare two Cognitus profiles side by side and identify material differences in authorized records."
  },
  network_explorer: {
    name: "Network Analysis",
    short: "Network Analysis",
    description: "Review organizations and authorized employment relationships from a structured network workspace."
  },
  watchlist: {
    name: "Watchlist",
    short: "Watchlist",
    description: "Maintain a private list of profiles that require follow-up and record why continued review is appropriate."
  },
  saved_investigations: {
    name: "Investigations",
    short: "Investigations",
    description: "Maintain private investigation workspaces with subjects, notes, organizations, and authorized report history."
  },
  intelligence_reports: {
    name: "Intelligence Reports",
    short: "Intel Reports",
    description: "Generate structured, printable summaries from records your account is authorized to review."
  },
  change_comparison: {
    name: "Change Analysis",
    short: "Change Analysis",
    description: "Compare authorized profile snapshots to understand how a Cognitus record changes over time."
  },
  cognitus_labs: {
    name: "Cognitus Labs",
    short: "Labs",
    description: "Preview experimental analysis capabilities before they enter general availability."
  },
  enhanced_profile: {
    name: "Profile Presentation",
    short: "Profile Presentation",
    description: "Configure how your Cognitus profile card is presented within eligible feature-access surfaces."
  },
  search_collections: {
    name: "Collections",
    short: "Collections",
    description: "Organize profiles and organizations into reusable private research collections."
  },
  search_analytics: {
    name: "Activity Analytics",
    short: "Analytics",
    description: "Review your Cognitus check activity, search patterns, and recent use of authorized tools."
  },
  early_access: {
    name: "Early Access",
    short: "Early Access",
    description: "Access preview releases and controlled feature programs made available to eligible accounts."
  }
});

function mountStyles() {
  let link = document.querySelector(`#${STYLE_ID}`);
  if (!link) {
    link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
  }
  link.href = "./src/professionalCoreV35.css?v=20260905-v35";
  document.head.appendChild(link);
}

function applyFeaturePresentation() {
  for (const [id, presentation] of Object.entries(FEATURE_PRESENTATION)) {
    const feature = C.FEATURE_BY_ID.get(id);
    if (!feature) continue;
    feature.name = presentation.name;
    feature.short = presentation.short;
    feature.description = presentation.description;
  }
}

function sourceAuthenticated() {
  return Boolean(document.querySelector('.topnav > a[href="#/dashboard"], .topnav > .nav-user'));
}

function route() {
  return location.hash.replace(/^#/, "").split("?")[0] || "/";
}

function routeLabel(value) {
  const names = {
    "/intelligence": "Intelligence Center",
    "/relationships": "Relationship Analysis",
    "/deep-history": "Historical Record Analysis",
    "/advanced-search": "Advanced Record Search",
    "/compare": "Profile Comparison",
    "/network": "Network Analysis",
    "/watchlist": "Watchlist",
    "/investigations": "Investigations",
    "/intelligence-reports": "Intelligence Reports",
    "/change-comparison": "Change Analysis",
    "/labs": "Cognitus Labs",
    "/enhanced-profile": "Profile Presentation",
    "/collections": "Collections",
    "/analytics": "Activity Analytics",
    "/early-access": "Early Access",
    "/risk-matrix": "Record Signal Analysis",
    "/overlap-scanner": "Cross-Organization Analysis",
    "/signal-zero": "Signal Zero"
  };
  return names[value] || "Cognitus Workspace";
}

function refineFeatureAccessPage() {
  if (route() !== "/promotional-access" || !C.root) return;
  const hero = C.root.querySelector(".promo26-access-hero");
  if (!hero) return;
  const eyebrow = hero.querySelector(".eyebrow");
  const heading = hero.querySelector("h1");
  const lead = hero.querySelector("h1 + p");
  if (eyebrow) eyebrow.textContent = "Cognitus Feature Access";
  if (heading) heading.textContent = "Feature Access";
  if (lead) lead.textContent = "Redeem approved access codes and review the additional Cognitus tools currently assigned to your account.";

  C.root.querySelectorAll(".promo26-section-heading h2").forEach((node) => {
    if (C.clean(node.textContent) === "Promotional features") node.textContent = "Analysis and research tools";
  });
}

function ensureContextStrip() {
  if (!C.root) return;
  const current = route();
  const feature = C.FEATURE_BY_ROUTE.get(current);
  if (!feature || current === "/signal-zero") return;
  const hero = C.root.querySelector(".promo26-feature-hero");
  if (!hero || C.root.querySelector("[data-pro35-context]")) return;
  hero.insertAdjacentHTML("afterend", `
    <div class="pro35-context-strip" data-pro35-context>
      <span><i aria-hidden="true"></i><strong>${C.safe(routeLabel(current))}</strong></span>
      <span>Data scope: records authorized for this account</span>
      <span>Feature access does not expand underlying record permissions</span>
    </div>`);
}

function sync() {
  mountStyles();
  applyFeaturePresentation();
  document.body.classList.add("cognitus-professional");
  document.body.classList.toggle("cognitus-operational", sourceAuthenticated());
  document.body.dataset.cognitusRoute = route().replace(/^\//, "") || "home";
  refineFeatureAccessPage();
  ensureContextStrip();
}

export function startProfessionalCoreV35() {
  mountStyles();
  applyFeaturePresentation();
  sync();
  document.addEventListener(C.PROMO_RENDER_EVENT, () => requestAnimationFrame(sync));
  window.addEventListener("hashchange", () => requestAnimationFrame(sync));
  window.addEventListener("pageshow", () => requestAnimationFrame(sync));
  window.addEventListener("focus", () => requestAnimationFrame(sync));
  document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(sync));
}
