import { getAccountStore } from "../state/accountStore.js";
import { attemptOwnerBootstrap, getBootstrapStatus } from "../services/bootstrapService.js";
import { isOwnerBootstrapConfigured, OWNER_BOOTSTRAP } from "../config/bootstrapConfig.js";

export async function renderOwnerBootstrapPage(root) {
  const account = getAccountStore();

  if (account.loading) {
    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Loading</p>
        <h1>Checking account state...</h1>
        <p>Please wait while Cognitus loads your account.</p>
      </section>
    `;
    return;
  }

  if (!account.record) {
    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Owner Bootstrap</p>
        <h1>Login required.</h1>
        <p>You must log in with the configured owner Discord ID before bootstrap can run.</p>
        <div class="hero-actions"><a class="button button-dark" href="#/login">Login</a></div>
      </section>
    `;
    return;
  }

  const status = await getBootstrapStatus();
  const configured = isOwnerBootstrapConfigured();
  const isConfiguredOwner = configured && account.record.discordId === OWNER_BOOTSTRAP.ownerDiscordId;

  root.innerHTML = `
    <section class="hero">
      <p class="eyebrow">Owner Bootstrap</p>
      <h1>Secure first-owner setup.</h1>
      <p>
        Bootstrap promotes only the configured owner Discord ID to the Owner role and then locks the setup record.
      </p>
      <div id="bootstrap-message" class="notice">
        ${getStatusMessage(status, configured, isConfiguredOwner)}
      </div>
      <div class="hero-actions">
        <button id="bootstrap-button" class="button button-dark" type="button" ${status.canAttempt && isConfiguredOwner ? "" : "disabled"}>Run Owner Bootstrap</button>
        <a class="button button-light" href="#/dashboard">Back to Dashboard</a>
      </div>
    </section>
  `;

  root.querySelector("#bootstrap-button")?.addEventListener("click", async () => {
    const message = root.querySelector("#bootstrap-message");
    const button = root.querySelector("#bootstrap-button");

    try {
      button.disabled = true;
      button.textContent = "Running...";
      await attemptOwnerBootstrap(account.record);
      message.textContent = "Owner bootstrap completed. Please refresh or revisit the dashboard to see owner navigation.";
    } catch (error) {
      message.textContent = error?.message || "Owner bootstrap failed.";
      button.disabled = false;
      button.textContent = "Run Owner Bootstrap";
    }
  });
}

function getStatusMessage(status, configured, isConfiguredOwner) {
  if (!status.firebaseReady) return "Firebase is not configured yet.";
  if (!configured) return "Owner bootstrap is not configured. Replace PASTE_OWNER_DISCORD_ID_HERE in bootstrapConfig.js.";
  if (status.complete) return "Owner bootstrap is already complete.";
  if (!isConfiguredOwner) return "This logged-in account does not match the configured owner Discord ID.";
  return "This account is authorized to complete owner bootstrap.";
}
