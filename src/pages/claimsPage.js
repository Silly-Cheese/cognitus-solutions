import { getAccountStore } from "../state/accountStore.js";
import { getFormData, normalizeInput } from "../utils/validation.js";
import { submitProfileClaim, listClaimsByUser } from "../services/claimService.js";
import { recordList } from "../components/dashboardCards.js";
import { formatDateTime } from "../utils/dom.js";

export async function renderClaimsPage(root) {
  const account = getAccountStore();

  if (!account.record) {
    root.innerHTML = loginRequired("claim profiles");
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Profile Claims</p>
      <h1>Claim your Cognitus profile.</h1>
      <p>Claims use your logged-in Discord ID as the identity anchor. A reviewer must approve the claim before the profile is marked claimed.</p>
    </section>

    <section class="workflow-layout">
      <form id="claim-form" class="panel form-stack">
        <div id="claim-message" class="notice" hidden></div>
        <label>
          Profile Document ID
          <input name="profileId" type="text" placeholder="Profile document ID from search result" required />
        </label>
        <label>
          Statement
          <textarea name="statement" rows="4" placeholder="Briefly explain why this profile is yours."></textarea>
        </label>
        <button class="button button-dark" type="submit">Submit Claim</button>
      </form>

      <section class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Your Claims</p>
            <h2>Claim History</h2>
          </div>
        </div>
        <div id="claim-list" class="loading-block">Loading claims...</div>
      </section>
    </section>
  `;

  const form = root.querySelector("#claim-form");
  const message = root.querySelector("#claim-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = getFormData(form);

    if (!normalizeInput(data.profileId)) {
      showMessage(message, "Profile ID is required.");
      return;
    }

    try {
      setBusy(form, true, "Submitting...");
      const claimId = await submitProfileClaim({ actor: account.record, profileId: data.profileId, statement: data.statement });
      form.reset();
      showMessage(message, `Claim submitted for review. Reference: ${claimId}`);
      await hydrateClaims(root, account.record.uid);
    } catch (error) {
      showMessage(message, error?.message || "Claim submission failed.");
    } finally {
      setBusy(form, false, "Submit Claim");
    }
  });

  await hydrateClaims(root, account.record.uid);
}

async function hydrateClaims(root, uid) {
  try {
    const claims = await listClaimsByUser(uid, 25);
    root.querySelector("#claim-list").innerHTML = recordList(
      claims,
      (claim) => `<article class="record-row"><div><strong>${claim.cognitusId || claim.id}</strong><span>Profile: ${claim.profileId} · ${claim.status}</span></div><small>${formatDateTime(claim.createdAt?.toDate?.() || claim.createdAt)}</small></article>`,
      "No claims yet",
      "Profile claims you submit will appear here."
    );
  } catch (error) {
    root.querySelector("#claim-list").innerHTML = `<div class="notice">${error?.message || "Could not load claims."}</div>`;
  }
}

function loginRequired(action) {
  return `<section class="hero"><p class="eyebrow">Login Required</p><h1>You need an account to ${action}.</h1><div class="hero-actions"><a class="button button-dark" href="#/login">Login</a></div></section>`;
}

function showMessage(element, text) {
  element.textContent = text;
  element.hidden = false;
}

function setBusy(form, busy, text) {
  const button = form.querySelector("button[type='submit']");
  button.disabled = busy;
  button.textContent = text;
}
