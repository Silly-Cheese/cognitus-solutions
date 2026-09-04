import * as C from "./promotionalCoreV26.js";

const STYLE_ID = "cognitus-promotional-v28";
const ADMIN_ROUTE = "/admin/promotions";
const ACCESS_ROUTE = "/promotional-access";
let syncTimers = [];
let accountsCache = null;
let accountsCacheAt = 0;

const ICONS = {
  intelligence_center: "M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 3a6 6 0 0 1 5.65 4H14a2 2 0 0 0-4 0H6.35A6 6 0 0 1 12 6Zm0 12a6 6 0 0 1-5.65-4H10a2 2 0 0 0 4 0h3.65A6 6 0 0 1 12 18Z",
  relationship_mapping: "M7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm10 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8.8 9.3l2 4M15.2 9.3l-2 4M10 7h4",
  deep_history: "M12 4a8 8 0 1 1-7.4 5H2l3.4-3.4L8.8 9H6.65A5.5 5.5 0 1 0 12 6.5V4Zm-1 4h2v4.2l3 1.8-1 1.7-4-2.4V8Z",
  advanced_search: "M10.5 4a6.5 6.5 0 1 0 3.9 11.7L19 20.3l1.4-1.4-4.6-4.6A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm-2 2h4v1.8h-4V8Zm0 3h3v1.8h-3V11Z",
  account_comparison: "M5 4h6v6H5V4Zm8 10h6v6h-6v-6ZM7 13h2v4h2v2H7v-6Zm8-8h2v6h-6V9h4V5Z",
  network_explorer: "M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM5 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm14 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-6-6.8 4.2 6.3-1.7 1.1L12 10.4l-3.5 5.2-1.7-1.1L11 8.2V7h2v1.2Z",
  watchlist: "M4 5h16v14H4V5Zm2 2v10h12V7H6Zm2 2h8v2H8V9Zm0 4h5v2H8v-2Z",
  saved_investigations: "M4 4h7l2 2h7v14H4V4Zm2 4v10h12V8H6Zm3 2h6v2H9v-2Zm0 4h4v2H9v-2Z",
  intelligence_reports: "M6 3h9l4 4v14H6V3Zm2 2v14h9V8h-3V5H8Zm2 6h5v2h-5v-2Zm0 4h5v2h-5v-2Z",
  change_comparison: "M7 4h10v3h3l-4 4-4-4h3V6H7V4Zm10 16H7v-3H4l4-4 4 4H9v1h8v2Z",
  cognitus_labs: "M9 3h6v2h-1v4.6l4.6 7.8A2.4 2.4 0 0 1 16.5 21h-9a2.4 2.4 0 0 1-2.1-3.6L10 9.6V5H9V3Zm2.7 7.6-4.6 7.8c-.2.3 0 .6.4.6h9c.4 0 .6-.3.4-.6l-4.6-7.8h-.6Z",
  enhanced_profile: "M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM4 21a8 8 0 0 1 16 0h-2a6 6 0 0 0-12 0H4Z",
  search_collections: "M4 5h6l2 2h8v12H4V5Zm2 4v8h12V9H6Zm2 2h8v2H8v-2Z",
  search_analytics: "M4 19h16v2H4v-2Zm2-2V9h3v8H6Zm5 0V4h3v13h-3Zm5 0v-6h3v6h-3Z",
  early_access: "M12 2 9.5 8H4l4.5 3.5L7 18l5-3 5 3-1.5-6.5L20 8h-5.5L12 2Z"
};

function mountStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = "./src/promotionalAccessV28.css?v=20260904-v28";
  document.head.appendChild(link);
}

function featureIcon(featureId, className = "promo28-icon") {
  const path = ICONS[featureId] || ICONS.early_access;
  const strokeOnly = featureId === "relationship_mapping";
  return `<span class="${className}" aria-hidden="true"><svg viewBox="0 0 24 24" ${strokeOnly ? 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' : 'fill="currentColor"'}><path d="${path}"/></svg></span>`;
}

function decorateCatalog() {
  const cards = C.root?.querySelectorAll(".promo26-feature-card") || [];
  cards.forEach((card, index) => {
    const feature = C.FEATURES[index];
    if (!feature || card.dataset.promo28Decorated) return;
    card.dataset.promo28Decorated = "true";
    card.dataset.promo28Feature = feature.id;
    card.insertAdjacentHTML("afterbegin", featureIcon(feature.id, "promo28-card-icon"));
    const action = card.querySelector(".hero-actions");
    if (action) action.insertAdjacentHTML("afterbegin", `<span class="promo28-card-kicker">${C.safe(feature.short)}</span>`);
  });
}

function decorateFeatureHero() {
  const feature = C.FEATURE_BY_ROUTE.get(C.currentRoute());
  const hero = C.root?.querySelector(".promo26-feature-hero");
  if (!feature || !hero || hero.dataset.promo28Decorated) return;
  hero.dataset.promo28Decorated = "true";
  hero.dataset.promo28Feature = feature.id;
  hero.insertAdjacentHTML("afterbegin", `<div class="promo28-feature-topline"><a href="#/promotional-access" class="promo28-backlink">← Promotional Access</a><span class="promo28-access-state">Access active</span></div><div class="promo28-feature-mark">${featureIcon(feature.id, "promo28-hero-icon")}<span>${C.safe(feature.short)}</span></div>`);
}

function decorateAdmin() {
  const hero = C.root?.querySelector(".promo26-admin-hero");
  if (hero && !hero.dataset.promo28Decorated) {
    hero.dataset.promo28Decorated = "true";
    hero.insertAdjacentHTML("afterbegin", `<div class="promo28-feature-topline"><span class="promo28-console-label">CONTROL CONSOLE / PROMOTIONAL ACCESS</span><span class="promo28-access-state">Admin authority</span></div>`);
  }
}

async function loadAccounts() {
  if (accountsCache && Date.now() - accountsCacheAt < 30000) return accountsCache;
  const rows = await C.readCollection("users", 500);
  accountsCache = rows
    .filter((row) => row.status === "active")
    .sort((a, b) => C.clean(a.displayName || a.cognitusId || a.id).localeCompare(C.clean(b.displayName || b.cognitusId || b.id)));
  accountsCacheAt = Date.now();
  return accountsCache;
}

function accountLabel(account) {
  const name = C.clean(account.displayName) || "Unnamed account";
  const cognitus = C.clean(account.cognitusId) || "No Cognitus ID";
  const role = C.humanize(account.role || "user");
  return `${name} — ${cognitus} — ${role}`;
}

function renderAccountPreview(select, accounts, preview) {
  if (!preview) return;
  const account = accounts.find((row) => row.id === select.value);
  if (!account) {
    preview.innerHTML = `<span>Select an account to preview its identity.</span>`;
    return;
  }
  const usernames = [account.discordUsername, ...(Array.isArray(account.discordUsernames) ? account.discordUsernames : [])].filter(Boolean);
  preview.innerHTML = `<div><strong>${C.safe(account.displayName || "Unnamed account")}</strong><small>${C.safe(account.cognitusId || account.id)}</small></div><div class="promo28-account-meta"><span>${C.safe(C.humanize(account.role || "user"))}</span>${usernames[0] ? `<span>Discord: ${C.safe(usernames[0])}</span>` : ""}<span>Active</span></div>`;
}

async function enhanceDirectGrant() {
  const form = C.root?.querySelector("[data-grant-form]");
  const uidInput = form?.querySelector('input[name="uid"]');
  if (!form || !uidInput || form.dataset.promo28Picker) return;
  form.dataset.promo28Picker = "loading";
  try {
    const accounts = await loadAccounts();
    const label = uidInput.closest("label");
    if (!label) return;
    const select = document.createElement("select");
    select.name = "uid";
    select.required = true;
    select.className = "promo28-account-select";
    select.innerHTML = `<option value="">Select an active Cognitus account…</option>${accounts.map((account) => `<option value="${C.safe(account.id)}">${C.safe(accountLabel(account))}</option>`).join("")}`;
    uidInput.replaceWith(select);
    label.childNodes[0].textContent = "Account";
    label.insertAdjacentHTML("beforeend", `<small class="promo28-field-help">Choose the account that should receive the entitlement. No Firebase UID copying required.</small>`);
    const preview = document.createElement("div");
    preview.className = "promo28-account-preview";
    preview.innerHTML = `<span>Select an account to preview its identity.</span>`;
    label.insertAdjacentElement("afterend", preview);
    select.addEventListener("change", () => renderAccountPreview(select, accounts, preview));
    form.dataset.promo28Picker = "ready";
  } catch (error) {
    form.dataset.promo28Picker = "failed";
    console.info("Promotional Access V28 account picker unavailable", error?.code || error?.message);
  }
}

async function findOwnRedemption(code) {
  const rows = await C.readWhere("promoRedemptions", "uid", "==", C.authUser.uid, 200);
  return rows.find((row) => row.promoId === code || row.code === code) || null;
}

function validatePromoForCurrentAccount(promo, now) {
  if (promo.status !== "active") throw new Error("That promotional code is not currently active.");
  if (C.timestampMs(promo.startsAt) && now < C.timestampMs(promo.startsAt)) throw new Error("That promotional code is not active yet.");
  if (C.timestampMs(promo.redeemUntil) && now > C.timestampMs(promo.redeemUntil)) throw new Error("That promotional code has expired.");
  if (Number(promo.maxTotalRedemptions || 0) > 0 && Number(promo.redeemedCount || 0) >= Number(promo.maxTotalRedemptions)) throw new Error("That promotional code has reached its redemption limit.");
  if (Array.isArray(promo.eligibleRoles) && !promo.eligibleRoles.includes(C.userRecord.role)) throw new Error("Your Cognitus account is not eligible for this promotional code.");
  if (C.clean(promo.eligibleOrganizationId) && C.clean(C.userRecord.organizationId) !== C.clean(promo.eligibleOrganizationId)) throw new Error("This code is restricted to another organization.");
}

async function redeemWithoutMissingDocumentRead(rawCode, canRetry = true) {
  await C.refreshSession(true);
  if (!C.isActiveAccount()) throw new Error("An active Cognitus account is required.");
  const code = C.normalizePromoCode(rawCode);
  if (code.length < 4) throw new Error("Enter a valid promotional code.");

  let previous = await findOwnRedemption(code);
  const run = async () => {
    const promoRef = C.Fire.doc(C.db, "promotionalCodes", code);
    const redemptionRef = C.Fire.doc(C.db, "promoRedemptions", `${code}__${C.authUser.uid}`);
    const result = await C.Fire.runTransaction(C.db, async (transaction) => {
      const promoSnap = await transaction.get(promoRef);
      if (!promoSnap.exists()) throw new Error("That promotional code is not valid.");
      const promo = promoSnap.data();
      const now = Date.now();
      validatePromoForCurrentAccount(promo, now);

      const redemptionCount = Number(previous?.redemptionCount || 0) + 1;
      if (redemptionCount > Number(promo.maxPerAccount || 1)) throw new Error("You have reached this code's per-account redemption limit.");

      let expiresAt = null;
      if (promo.accessMode === "duration") expiresAt = C.Fire.Timestamp.fromMillis(now + Math.max(3600, Number(promo.accessDurationSeconds || 604800)) * 1000);
      if (promo.accessMode === "fixed_end") {
        expiresAt = promo.accessEndsAt || null;
        if (!expiresAt || C.timestampMs(expiresAt) <= now) throw new Error("The access period for this code has ended.");
      }

      const redemption = {
        id: redemptionRef.id,
        promoId: code,
        code,
        uid: C.authUser.uid,
        userCognitusId: C.userRecord.cognitusId || "",
        redemptionCount,
        featureIds: Array.isArray(promo.featureIds) ? promo.featureIds : [],
        status: "active",
        source: "promotional_code",
        grantedAt: previous?.grantedAt || C.Fire.serverTimestamp(),
        expiresAt,
        campaignEndsAt: promo.redeemUntil || null,
        campaignExpiryBehavior: promo.campaignExpiryBehavior || "preserve_access",
        lastRedeemedAt: C.Fire.serverTimestamp(),
        createdAt: previous?.createdAt || C.Fire.serverTimestamp(),
        updatedAt: C.Fire.serverTimestamp()
      };

      transaction.update(promoRef, {
        redeemedCount: Number(promo.redeemedCount || 0) + 1,
        updatedAt: C.Fire.serverTimestamp()
      });
      if (previous) transaction.update(redemptionRef, redemption);
      else transaction.set(redemptionRef, redemption);
      return { promo, redemption };
    });
    return result;
  };

  try {
    const result = await run();
    C.invalidateAccess();
    await C.writePromoAudit("PROMO_REDEEMED", code, `Redeemed promotional code ${code}.`, { featureCount: result.redemption.featureIds.length });
    return result;
  } catch (error) {
    if (canRetry && ["permission-denied", "aborted", "failed-precondition"].includes(error?.code)) {
      const refreshed = await findOwnRedemption(code).catch(() => previous);
      if (Boolean(refreshed) !== Boolean(previous) || Number(refreshed?.redemptionCount || 0) !== Number(previous?.redemptionCount || 0)) {
        previous = refreshed;
        return redeemWithoutMissingDocumentRead(rawCode, false);
      }
    }
    throw error;
  }
}

function bindSafeRedemption() {
  const forms = C.root?.querySelectorAll("[data-access-redeem], [data-promo-redeem-form]") || [];
  forms.forEach((form) => {
    if (form.dataset.promo28SafeRedeem) return;
    form.dataset.promo28SafeRedeem = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const button = form.querySelector('button[type="submit"]');
      const message = form.querySelector("[data-promo-message]") || C.root.querySelector("[data-access-message]") || C.root.querySelector("[data-promo-message]");
      try {
        C.setBusy(button, true, "Unlocking…", "Redeem Code");
        const result = await redeemWithoutMissingDocumentRead(new FormData(form).get("code"));
        C.setMessage(message, `Access granted. ${result.redemption.featureIds.length} promotional feature${result.redemption.featureIds.length === 1 ? "" : "s"} unlocked.`, "success");
        setTimeout(() => C.scheduleSync(true), 260);
      } catch (error) {
        const text = error?.code === "permission-denied"
          ? "Cognitus could not complete this redemption. Refresh once and try again; if it continues, the promotional access rules need to be republished."
          : (error?.message || "The code could not be redeemed.");
        C.setMessage(message, text, "error");
      } finally {
        C.setBusy(button, false, "Unlocking…", "Redeem Code");
      }
    }, true);
  });
}

function decorateRoute() {
  const route = C.currentRoute();
  if (!C.root) return;
  if (!C.PROMO_ROUTES.has(route)) {
    C.root.classList.remove("promo28-active");
    delete C.root.dataset.promo28Route;
    delete C.root.dataset.promo28Feature;
    return;
  }

  C.root.classList.add("promo28-active");
  C.root.dataset.promo28Route = route.replace(/^\//, "") || "access";
  const feature = C.FEATURE_BY_ROUTE.get(route);
  if (feature) C.root.dataset.promo28Feature = feature.id;
  else delete C.root.dataset.promo28Feature;

  decorateCatalog();
  decorateFeatureHero();
  decorateAdmin();
  bindSafeRedemption();
  if (route === ADMIN_ROUTE) enhanceDirectGrant();
}

function scheduleEnhancement() {
  syncTimers.forEach(clearTimeout);
  syncTimers = [0, 80, 220, 520, 950, 1600, 2400].map((delay) => setTimeout(decorateRoute, delay));
}

export function startPromotionalEnhancementsV28() {
  mountStyles();
  window.addEventListener("hashchange", scheduleEnhancement);
  window.addEventListener("pageshow", scheduleEnhancement);
  window.addEventListener("focus", scheduleEnhancement);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleEnhancement(); });
  scheduleEnhancement();
}
