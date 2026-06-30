import { getAccountStore } from "../state/accountStore.js";
import { isOwner } from "../security/permissions.js";
import { getFormData } from "../utils/validation.js";
import { getPortalSettings, savePortalSettings } from "../services/portalSettingsService.js";

export async function renderOwnerSettingsPage(root) {
  const account = getAccountStore();

  if (!account.record || !isOwner(account.record)) {
    root.innerHTML = `<section class="hero"><p class="eyebrow">Access Denied</p><h1>Owner access required.</h1><div class="hero-actions"><a class="button button-dark" href="#/dashboard">Dashboard</a></div></section>`;
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Portal Settings</p>
      <h1>Control platform behavior.</h1>
      <p>Manage maintenance mode, public registration, search availability, review availability, and platform banner text.</p>
    </section>
    <section class="form-card wide-form" style="margin-top: 1rem;">
      <div id="settings-message" class="notice" hidden></div>
      <form id="settings-form" class="form-stack">
        <label class="checkbox-line"><input name="maintenanceMode" type="checkbox" /> Maintenance Mode</label>
        <label class="checkbox-line"><input name="publicRegistration" type="checkbox" checked /> Public Registration Enabled</label>
        <label class="checkbox-line"><input name="searchesEnabled" type="checkbox" checked /> Searches Enabled</label>
        <label class="checkbox-line"><input name="reportsEnabled" type="checkbox" checked /> Reports Enabled</label>
        <label class="checkbox-line"><input name="claimsEnabled" type="checkbox" checked /> Claims Enabled</label>
        <label class="checkbox-line"><input name="appealsEnabled" type="checkbox" checked /> Appeals Enabled</label>
        <label>
          Platform Banner
          <input name="globalBanner" type="text" placeholder="Optional announcement banner" />
        </label>
        <label>
          Maintenance Message
          <textarea name="maintenanceMessage" rows="4" placeholder="Message shown during maintenance mode"></textarea>
        </label>
        <label>
          Maximum Searches Per Session
          <input name="maxSearchesPerSession" type="number" min="1" value="25" />
        </label>
        <button class="button button-dark" type="submit">Save Settings</button>
      </form>
    </section>
  `;

  await hydrateSettings(root);

  root.querySelector("#settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = getFormData(form);
    const settings = {
      maintenanceMode: data.maintenanceMode === "on",
      publicRegistration: data.publicRegistration === "on",
      searchesEnabled: data.searchesEnabled === "on",
      reportsEnabled: data.reportsEnabled === "on",
      claimsEnabled: data.claimsEnabled === "on",
      appealsEnabled: data.appealsEnabled === "on",
      globalBanner: data.globalBanner || "",
      maintenanceMessage: data.maintenanceMessage || "",
      maxSearchesPerSession: Number(data.maxSearchesPerSession || 25)
    };

    try {
      await savePortalSettings(settings, account.record);
      showMessage(root, "Portal settings saved.");
    } catch (error) {
      showMessage(root, error?.message || "Could not save settings.");
    }
  });
}

async function hydrateSettings(root) {
  try {
    const settings = await getPortalSettings();
    if (!settings) return;

    const form = root.querySelector("#settings-form");
    form.maintenanceMode.checked = Boolean(settings.maintenanceMode);
    form.publicRegistration.checked = settings.publicRegistration !== false;
    form.searchesEnabled.checked = settings.searchesEnabled !== false;
    form.reportsEnabled.checked = settings.reportsEnabled !== false;
    form.claimsEnabled.checked = settings.claimsEnabled !== false;
    form.appealsEnabled.checked = settings.appealsEnabled !== false;
    form.globalBanner.value = settings.globalBanner || "";
    form.maintenanceMessage.value = settings.maintenanceMessage || "";
    form.maxSearchesPerSession.value = settings.maxSearchesPerSession || 25;
  } catch (error) {
    showMessage(root, error?.message || "Could not load settings.");
  }
}

function showMessage(root, text) {
  const message = root.querySelector("#settings-message");
  message.textContent = text;
  message.hidden = false;
}
