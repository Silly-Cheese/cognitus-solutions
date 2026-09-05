import * as C from './promotionalCoreV26.js';

export const V33_FEATURES = Object.freeze([
  {
    id: 'risk_signal_matrix',
    route: '/risk-matrix',
    name: 'Record Signal Analysis',
    short: 'Signal Analysis',
    badge: 'BETA',
    description: 'Summarize authorized report categories, severities, and employment context without turning Cognitus into an automated decision-maker.'
  },
  {
    id: 'organization_overlap',
    route: '/overlap-scanner',
    name: 'Cross-Organization Analysis',
    short: 'Organization Analysis',
    badge: 'BETA',
    description: 'Compare two organizations and identify profiles connected to both through employment records your account is authorized to review.'
  }
]);

function register() {
  for (const feature of V33_FEATURES) {
    C.FEATURE_BY_ID.set(feature.id, feature);
    C.FEATURE_BY_ROUTE.set(feature.route, feature);
    C.PROMO_ROUTES.add(feature.route);
  }
}

function card(feature, unlocked) {
  return `<article class="promo26-feature-card is-${unlocked ? 'unlocked' : 'locked'}" data-promo33-feature-card="${C.safe(feature.id)}"><div class="promo26-feature-top"><span class="promo26-mini-badge">${C.safe(feature.badge)}</span><span class="promo26-status is-${unlocked ? 'unlocked' : 'locked'}">${unlocked ? 'Unlocked' : 'Locked'}</span></div><h3>${C.safe(feature.name)}</h3><p>${C.safe(feature.description)}</p><div class="hero-actions">${C.buttonLink(feature.route, unlocked ? 'Open' : 'View Access Requirement', unlocked)}</div></article>`;
}

async function enhanceAccessHub() {
  if (C.currentRoute() !== '/promotional-access') return;
  const grid = C.root?.querySelector('.promo26-feature-grid');
  if (!grid) return;
  const access = await C.loadAccess();
  for (const feature of V33_FEATURES) {
    if (!grid.querySelector(`[data-promo33-feature-card="${feature.id}"]`)) {
      grid.insertAdjacentHTML('beforeend', card(feature, access.features.has(feature.id)));
    }
  }
  C.root.querySelectorAll('.promo26-section-heading span').forEach((span) => {
    if (/\/\s*15\s+unlocked/i.test(span.textContent || '')) span.textContent = `${access.features.size} / 17 unlocked`;
  });
}

async function injectAdminFeatures() {
  if (C.currentRoute() !== '/admin/promotions') return;
  const forms = C.root?.querySelectorAll('[data-promo-form],[data-grant-form]') || [];
  for (const form of forms) {
    const grid = form.querySelector('input[name="featureIds"]')?.closest('.promo26-check-grid');
    if (!grid) continue;
    let selected = [];
    const editId = C.clean(form.querySelector('[name="editId"]')?.value);
    if (editId) {
      const promo = await C.readDoc('promotionalCodes', editId).catch(() => null);
      selected = promo?.featureIds || [];
    }
    for (const feature of V33_FEATURES) {
      if (grid.querySelector(`input[value="${feature.id}"]`)) continue;
      grid.insertAdjacentHTML('beforeend', `<label class="promo26-check-card"><input type="checkbox" name="featureIds" value="${C.safe(feature.id)}" ${selected.includes(feature.id) ? 'checked' : ''}><span><strong>${C.safe(feature.name)}</strong><small>${C.safe(feature.description)}</small></span></label>`);
    }
  }
}

function enhanceLabs() {
  if (C.currentRoute() !== '/labs') return;
  const grid = C.root?.querySelector('.promo26-record-grid');
  if (!grid) return;
  for (const feature of V33_FEATURES) {
    if (grid.querySelector(`[data-promo33-lab="${feature.id}"]`)) continue;
    grid.insertAdjacentHTML('beforeend', `<article class="promo26-record-card" data-promo33-lab="${C.safe(feature.id)}"><div class="promo26-record-head"><h3>${C.safe(feature.short)}</h3><span class="promo26-mini-badge">${C.safe(feature.badge)}</span></div><p>${C.safe(feature.description)}</p><div class="hero-actions">${C.buttonLink(feature.route, 'Open')}</div></article>`);
  }
}

let frame = 0;
async function decorate() {
  await enhanceAccessHub().catch(() => null);
  await injectAdminFeatures().catch(() => null);
  enhanceLabs();
}

function scheduleDecorate() {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    decorate();
  });
}

export function startPromotionalRegistryV33() {
  register();
  document.addEventListener(C.PROMO_RENDER_EVENT, scheduleDecorate);
  window.addEventListener('hashchange', scheduleDecorate);
  window.addEventListener('pageshow', scheduleDecorate);
  scheduleDecorate();
}
