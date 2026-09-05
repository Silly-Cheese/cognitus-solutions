import * as C from "./promo/promotionalCoreV26.js";

const STYLE_ID = "cognitus-professional-finish-v35";
let frame = 0;

function mountStyles() {
  let link = document.querySelector(`#${STYLE_ID}`);
  if (!link) {
    link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
  }
  link.href = "./src/professionalFinishV35.css?v=20260905-v35";
  document.head.appendChild(link);
}

function refineFeatureHero() {
  const current = C.currentRoute();
  const feature = C.FEATURE_BY_ROUTE.get(current);
  if (!feature || current === "/signal-zero") return;
  const hero = C.root?.querySelector(".promo26-feature-hero");
  if (!hero) return;
  const eyebrow = hero.querySelector(".eyebrow");
  if (eyebrow) eyebrow.textContent = `Restricted Analysis · ${feature.badge || "Feature Access"}`;
}

function refineAccessHub() {
  if (C.currentRoute() !== "/promotional-access") return;
  C.setTitle("Feature Access");
  C.root?.querySelectorAll(".promo26-section-heading h2").forEach((heading) => {
    if (C.clean(heading.textContent) === "Promotional features") heading.textContent = "Analysis and research tools";
  });
}

function refineAdministration() {
  if (C.currentRoute() !== "/admin/promotions") return;
  C.setTitle("Feature Access Management");
  const hero = C.root?.querySelector(".promo26-admin-hero");
  if (hero) {
    const eyebrow = hero.querySelector(".eyebrow");
    const heading = hero.querySelector("h1");
    const lead = hero.querySelector("h1 + p");
    if (eyebrow) eyebrow.textContent = "Administration · Access Control";
    if (heading) heading.textContent = "Feature Access Management";
    if (lead) lead.textContent = "Create access codes, control redemption windows and limits, assign restricted analysis tools, review active entitlements, and revoke access when necessary.";
  }

  const labels = {
    campaigns: "Access Codes",
    create: "Create Access Code",
    grants: "Direct Assignments"
  };
  C.root?.querySelectorAll("[data-admin-tab]").forEach((button) => {
    const label = labels[button.dataset.adminTab];
    if (label) button.textContent = label;
  });

  C.root?.querySelectorAll('[data-admin-panel="campaigns"] .promo26-section-heading h2').forEach((heading) => {
    heading.textContent = heading.textContent.replace(/promotional code(s)?/gi, "access code$1");
  });
}

function refineLabs() {
  if (C.currentRoute() !== "/labs") return;
  const hero = C.root?.querySelector(".promo26-feature-hero");
  const eyebrow = hero?.querySelector(".eyebrow");
  if (eyebrow) eyebrow.textContent = "Controlled Preview Environment";
}

function sync() {
  mountStyles();
  refineFeatureHero();
  refineAccessHub();
  refineAdministration();
  refineLabs();
}

function schedule() {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    sync();
  });
}

export function startProfessionalFinishV35() {
  mountStyles();
  schedule();
  document.addEventListener(C.PROMO_RENDER_EVENT, schedule);
  window.addEventListener("hashchange", schedule);
  window.addEventListener("pageshow", schedule);
}
