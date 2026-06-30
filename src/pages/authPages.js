import { loginWithDiscordId, registerWithDiscordAccount } from "../services/authService.js";
import { getFirebaseAuthErrorMessage, getFormData, normalizeDiscordId, validatePassword } from "../utils/validation.js";
import { getAccountStore } from "../state/accountStore.js";

export function renderLoginPage(root) {
  const account = getAccountStore();

  if (account.record) {
    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Already Logged In</p>
        <h1>Welcome back, ${account.record.displayName}.</h1>
        <p>You are already signed in to Cognitus Solutions.</p>
        <div class="hero-actions"><a class="button button-dark" href="#/dashboard">Go to Dashboard</a></div>
      </section>
    `;
    return;
  }

  root.innerHTML = `
    <section class="form-card">
      <p class="eyebrow">Login</p>
      <h1>Account access</h1>
      <p class="muted">Use your Discord ID and Cognitus password. Cognitus does not collect real emails.</p>
      <div id="auth-message" class="notice" hidden></div>
      <form id="login-form" class="form-stack">
        <label>
          Discord ID
          <input name="discordId" type="text" inputmode="numeric" autocomplete="username" placeholder="123456789012345678" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autocomplete="current-password" placeholder="Password" required />
        </label>
        <label class="checkbox-line">
          <input name="rememberMe" type="checkbox" />
          Remember Me on this device
        </label>
        <button class="button button-dark" type="submit">Login</button>
        <a class="muted" href="#/password-reset">Need a password reset?</a>
      </form>
    </section>
  `;

  const form = root.querySelector("#login-form");
  const message = root.querySelector("#auth-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;

    const data = getFormData(form);
    const discordId = normalizeDiscordId(data.discordId);

    if (!discordId) {
      showAuthMessage(message, "Enter a valid Discord ID.");
      return;
    }

    try {
      setFormBusy(form, true, "Logging in...");
      await loginWithDiscordId({
        discordId,
        password: data.password,
        rememberMe: data.rememberMe === "on"
      });
      window.location.hash = "#/dashboard";
    } catch (error) {
      showAuthMessage(message, getFirebaseAuthErrorMessage(error));
    } finally {
      setFormBusy(form, false, "Login");
    }
  });
}

export function renderRegisterPage(root) {
  const account = getAccountStore();

  if (account.record) {
    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Already Registered</p>
        <h1>Your Cognitus account is active.</h1>
        <p>You are signed in as ${account.record.displayName}.</p>
        <div class="hero-actions"><a class="button button-dark" href="#/dashboard">Go to Dashboard</a></div>
      </section>
    `;
    return;
  }

  root.innerHTML = `
    <section class="form-card">
      <p class="eyebrow">Create Account</p>
      <h1>Join Cognitus</h1>
      <p class="muted">Create an account using your Discord identity. No real email address is collected.</p>
      <div id="auth-message" class="notice" hidden></div>
      <form id="register-form" class="form-stack">
        <label>
          Discord Username
          <input name="discordUsername" type="text" autocomplete="nickname" placeholder="Executive_Eagle" required />
        </label>
        <label>
          Discord ID
          <input name="discordId" type="text" inputmode="numeric" autocomplete="username" placeholder="123456789012345678" required />
        </label>
        <label>
          Account Type
          <select name="accountType" required>
            <option value="individual">Individual / General User</option>
            <option value="organization_request">Organization Access Request</option>
          </select>
        </label>
        <label>
          Password
          <input name="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" required />
        </label>
        <label>
          Confirm Password
          <input name="confirmPassword" type="password" autocomplete="new-password" placeholder="Repeat password" required />
        </label>
        <label class="checkbox-line">
          <input name="rememberMe" type="checkbox" checked />
          Remember Me on this device
        </label>
        <label class="checkbox-line">
          <input name="terms" type="checkbox" required />
          I agree to use Cognitus checks only for legitimate hiring, safety, review, or partnership purposes.
        </label>
        <button class="button button-dark" type="submit">Create Account</button>
      </form>
    </section>
  `;

  const form = root.querySelector("#register-form");
  const message = root.querySelector("#auth-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;

    const data = getFormData(form);
    const discordId = normalizeDiscordId(data.discordId);
    const passwordError = validatePassword(data.password);

    if (!discordId) {
      showAuthMessage(message, "Enter a valid Discord ID.");
      return;
    }

    if (passwordError) {
      showAuthMessage(message, passwordError);
      return;
    }

    if (data.password !== data.confirmPassword) {
      showAuthMessage(message, "Passwords do not match.");
      return;
    }

    try {
      setFormBusy(form, true, "Creating account...");
      await registerWithDiscordAccount({
        discordUsername: data.discordUsername,
        discordId,
        password: data.password,
        accountType: data.accountType,
        rememberMe: data.rememberMe === "on"
      });
      window.location.hash = "#/dashboard";
    } catch (error) {
      showAuthMessage(message, getFirebaseAuthErrorMessage(error));
    } finally {
      setFormBusy(form, false, "Create Account");
    }
  });
}

function showAuthMessage(element, text) {
  element.textContent = text;
  element.hidden = false;
}

function setFormBusy(form, busy, buttonText) {
  const button = form.querySelector("button[type='submit']");
  button.disabled = busy;
  button.textContent = buttonText;
}
