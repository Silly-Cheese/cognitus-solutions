import * as C from "./promo/promotionalCoreV26.js";

const STYLE_ID = "cognitus-professional-contrast-v40";
let queued = false;

function mountStyles() {
  let link = document.querySelector(`#${STYLE_ID}`);
  if (!link) {
    link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
  }
  link.href = "./src/professionalContrastV40.css?v=20260905-v40";
  // Re-appending an existing link keeps the V40 contrast contract last in the cascade.
  document.head.appendChild(link);
}

function sync() {
  mountStyles();
  document.body.classList.add("cognitus-professional");
  document.documentElement.classList.add("cognitus-contrast-v40");
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    sync();
  });
}

export function startProfessionalContrastV40() {
  sync();
  document.addEventListener(C.PROMO_RENDER_EVENT, schedule);
  document.addEventListener("cognitus:frenzy-state", schedule);
  document.addEventListener("cognitus:promotional-v38-ready", schedule);
  window.addEventListener("hashchange", schedule);
  window.addEventListener("pageshow", schedule);
  window.addEventListener("focus", schedule);
  document.addEventListener("DOMContentLoaded", schedule);
}
