import * as C from "./promo/promotionalCoreV26.js";

const STYLE_ID = "cognitus-professional-refine-v41";
const START_KEY = "__COGNITUS_PROFESSIONAL_REFINE_V41_STARTED__";
let queued = false;

function mountStyles() {
  let link = document.querySelector(`#${STYLE_ID}`);
  if (!link) {
    link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
  }
  link.href = "./src/professionalRefineV41.css?v=20260905-v41";
  document.head.appendChild(link);
}

function sync() {
  mountStyles();
  document.body.classList.add("cognitus-professional", "cognitus-refined-v41");
  document.documentElement.classList.add("cognitus-refined-v41");
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  });
}

export function startProfessionalRefineV41() {
  if (window[START_KEY]) {
    schedule();
    return;
  }
  window[START_KEY] = true;
  sync();
  document.addEventListener(C.PROMO_RENDER_EVENT, schedule);
  document.addEventListener("cognitus:frenzy-state", schedule);
  document.addEventListener("cognitus:promotional-v38-ready", schedule);
  document.addEventListener("cognitus:promo-route-requested", schedule);
  window.addEventListener("hashchange", schedule);
  window.addEventListener("pageshow", schedule);
  window.addEventListener("focus", schedule);
  document.addEventListener("DOMContentLoaded", schedule);
}
