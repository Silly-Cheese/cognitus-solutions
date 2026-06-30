import { submitPasswordResetRequest } from "../services/passwordResetService.js";
import { getFormData, normalizeDiscordId, getFirebaseAuthErrorMessage } from "../utils/validation.js";

export function renderPasswordResetPage(root) {
  root.innerHTML = `
    <section class="form-card">
      <p class="eyebrow">Password Reset</p>
      <h1>Request account help</h1>
      <p class="muted">
        Cognitus does not collect real emails, so password resets are handled through an admin-reviewed request.
      </p>
      <div id="reset-message" class="notice" hidden></div>
      <form id="password-reset-form" class="form-stack">
        <label>
          Discord ID
          <input name="discordId" type="text" inputmode="numeric" placeholder="123456789012345678" required />
        </label>
        <label>
          Discord Username
          <input name="discordUsername" type="text" placeholder="Executive_Eagle" />
        </label>
        <label>
          Reason / Account Details
          <textarea name="reason" rows="4" placeholder="Explain why you need a reset or what happened."></textarea>
        </label>
        <button class="button button-dark" type="submit">Submit Reset Request</button>
        <a class="muted" href="#/login">Back to Login</a>
      </form>
    </section>
  `;

  const form = root.querySelector("#password-reset-form");
  const message = root.querySelector("#reset-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;

    const data = getFormData(form);
    const discordId = normalizeDiscordId(data.discordId);

    if (!discordId) {
      showMessage(message, "Enter a valid Discord ID.");
      return;
    }

    try {
      setBusy(form, true);
      const requestId = await submitPasswordResetRequest({
        discordId,
        discordUsername: data.discordUsername,
        reason: data.reason
      });
      form.reset();
      showMessage(message, `Password reset request submitted. Reference ID: ${requestId}`);
    } catch (error) {
      showMessage(message, getFirebaseAuthErrorMessage(error));
    } finally {
      setBusy(form, false);
    }
  });
}

function showMessage(element, text) {
  element.textContent = text;
  element.hidden = false;
}

function setBusy(form, busy) {
  const button = form.querySelector("button[type='submit']");
  button.disabled = busy;
  button.textContent = busy ? "Submitting..." : "Submit Reset Request";
}
