import { CHECK_REASONS, PERSON_SEARCH_FIELDS, ORGANIZATION_SEARCH_FIELDS } from "../data/constants.js";
import { getAccountStore } from "../state/accountStore.js";
import { getFormData, normalizeInput } from "../utils/validation.js";
import { searchProfiles } from "../services/profileService.js";
import { searchOrganizations } from "../services/organizationService.js";
import { createCheckLog } from "../services/checkService.js";
import { saveCandidate, saveOrganization } from "../services/savedService.js";

let lastCheckId = null;

export function renderSearchPage(root) {
  const account = getAccountStore();

  if (!account.record) {
    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Login Required</p>
        <h1>You need an account to run checks.</h1>
        <p>Cognitus checks are monitored and require a logged-in account.</p>
        <div class="hero-actions"><a class="button button-dark" href="#/login">Login</a></div>
      </section>
    `;
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Run Check</p>
      <h1>Search people or organizations.</h1>
      <p>Every check requires a reason and is logged for accountability. Search results are tied to permanent Cognitus records when matches exist.</p>
    </section>

    <section class="search-layout">
      <form id="check-form" class="panel form-stack">
        <div class="form-row">
          <label>
            Search Type
            <select name="searchType" id="search-type" required>
              <option value="Person">Person</option>
              <option value="Organization">Organization</option>
            </select>
          </label>
          <label>
            Search By
            <select name="searchField" id="search-field" required></select>
          </label>
        </div>

        <label>
          Search Query
          <input name="searchQuery" type="text" placeholder="Discord username, Discord ID, Roblox username, or organization name" required />
        </label>

        <label>
          Reason for Check
          <select name="reason" required>
            <option value="">Select a required reason</option>
            ${CHECK_REASONS.map((reason) => `<option value="${reason}">${reason}</option>`).join("")}
          </select>
        </label>

        <label>
          Additional Notes
          <textarea name="additionalNotes" rows="3" placeholder="Optional context for audit records."></textarea>
        </label>

        <button class="button button-dark" type="submit">Run Logged Check</button>
        <div id="search-message" class="notice" hidden></div>
      </form>

      <aside class="panel">
        <p class="eyebrow">Check Standards</p>
        <h2>Use checks professionally.</h2>
        <p class="muted">Checks should only be used for hiring, promotion, partnership, internal investigation, safety, appeal, or correction-related purposes.</p>
        <div class="notice"><strong>Logged:</strong> user, query, type, reason, notes, target, and time.</div>
      </aside>
    </section>

    <section class="panel" style="margin-top: 1rem;">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Results</p>
          <h2>Search Results</h2>
        </div>
        <span id="last-check-id" class="muted"></span>
      </div>
      <div id="search-results" class="empty-state">
        <h3>No check run yet</h3>
        <p>Enter a query, choose a reason, and run a logged check.</p>
      </div>
    </section>
  `;

  const form = root.querySelector("#check-form");
  const typeSelect = root.querySelector("#search-type");
  const fieldSelect = root.querySelector("#search-field");

  updateSearchFields(typeSelect.value, fieldSelect);
  typeSelect.addEventListener("change", () => updateSearchFields(typeSelect.value, fieldSelect));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handleCheckSubmit(root, form, account.record);
  });
}

function updateSearchFields(searchType, fieldSelect) {
  const fields = searchType === "Organization" ? ORGANIZATION_SEARCH_FIELDS : PERSON_SEARCH_FIELDS;
  fieldSelect.innerHTML = fields.map((field) => `<option value="${field}">${field}</option>`).join("");
}

async function handleCheckSubmit(root, form, actor) {
  const data = getFormData(form);
  const message = root.querySelector("#search-message");
  const resultsRoot = root.querySelector("#search-results");
  const checkIdRoot = root.querySelector("#last-check-id");
  const button = form.querySelector("button[type='submit']");

  message.hidden = true;

  if (!normalizeInput(data.reason)) {
    showMessage(message, "A check reason is required before running a search.");
    return;
  }

  if (!normalizeInput(data.searchQuery)) {
    showMessage(message, "Enter a search query.");
    return;
  }

  try {
    button.disabled = true;
    button.textContent = "Running check...";
    resultsRoot.innerHTML = `<div class="loading-block">Searching and creating check log...</div>`;

    const results = data.searchType === "Organization"
      ? await searchOrganizations(data.searchQuery)
      : await searchProfiles({ field: data.searchField, value: data.searchQuery });

    const targetProfileId = data.searchType === "Person" && results[0]?.id ? results[0].id : null;
    const targetOrganizationId = data.searchType === "Organization" && results[0]?.id ? results[0].id : null;

    lastCheckId = await createCheckLog({
      actor,
      searchType: data.searchType,
      searchField: data.searchField,
      searchQuery: data.searchQuery,
      reason: data.reason,
      additionalNotes: data.additionalNotes,
      targetProfileId,
      targetOrganizationId,
      resultSummary: results.length ? `${results.length} result(s) returned.` : "No matching records returned."
    });

    checkIdRoot.innerHTML = `Check ID: ${lastCheckId} · <a href="#/reports/quick?checkId=${lastCheckId}">Quick Report</a> · <a href="#/reports/full?checkId=${lastCheckId}">Full Report</a>`;
    renderResults(resultsRoot, results, data.searchType, actor);
  } catch (error) {
    resultsRoot.innerHTML = `<div class="notice">${error?.message || "Search failed."}</div>`;
  } finally {
    button.disabled = false;
    button.textContent = "Run Logged Check";
  }
}

function renderResults(root, results, searchType, actor) {
  if (!results.length) {
    root.innerHTML = `
      <div class="empty-state">
        <h3>No matching records</h3>
        <p>The check was still logged. You can still generate a report showing that no matching Cognitus record was found.</p>
        <div class="hero-actions">
          <a class="button button-light" href="#/reports/quick?checkId=${lastCheckId}">Quick Report</a>
          <a class="button button-light" href="#/reports/full?checkId=${lastCheckId}">Full Report</a>
        </div>
      </div>
    `;
    return;
  }

  root.innerHTML = `<div class="result-grid">${results.map((item) => renderResultCard(item, searchType)).join("")}</div>`;

  root.querySelectorAll("[data-save-profile]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      await saveCandidate({ actor, profileId: button.dataset.saveProfile, label: "Saved from search", status: "Saved" });
      button.textContent = "Saved";
    });
  });

  root.querySelectorAll("[data-save-org]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      await saveOrganization({ actor, organizationId: button.dataset.saveOrg, label: "Saved from search" });
      button.textContent = "Saved";
    });
  });
}

function renderResultCard(item, searchType) {
  if (searchType === "Organization") {
    return `
      <article class="result-card">
        <p class="eyebrow">Organization</p>
        <h3>${item.name || "Unnamed Organization"}</h3>
        <p>${item.organizationType || "Organization"}</p>
        <div class="record-meta">
          <span>${item.cognitusId || "No Cognitus ID"}</span>
          <span>${item.verificationStatus || "unverified"}</span>
          <span>${item.trustLevel || "unreviewed"}</span>
        </div>
        <div class="hero-actions">
          <button class="button button-light" type="button" data-save-org="${item.id}">Save Organization</button>
          <a class="button button-light" href="#/reports/quick?checkId=${lastCheckId}">Quick Report</a>
          <a class="button button-light" href="#/reports/full?checkId=${lastCheckId}">Full Report</a>
        </div>
      </article>
    `;
  }

  return `
    <article class="result-card">
      <p class="eyebrow">Person</p>
      <h3>${item.displayName || "Unnamed Profile"}</h3>
      <p>${item.professionalStanding || "Professional standing unreviewed"}</p>
      <div class="record-meta">
        <span>${item.cognitusId || "No Cognitus ID"}</span>
        <span>${item.identityStatus || "unverified"}</span>
        <span>Risk: ${item.riskLevel || "unreviewed"}</span>
      </div>
      <div class="alias-list">
        ${(item.robloxUsernames || []).map((name) => `<span>Roblox: ${name}</span>`).join("")}
        ${(item.discordUsernames || []).map((name) => `<span>Discord: ${name}</span>`).join("")}
      </div>
      <div class="hero-actions">
        <button class="button button-light" type="button" data-save-profile="${item.id}">Save Candidate</button>
        <a class="button button-light" href="#/claims">Claim Profile</a>
        <a class="button button-light" href="#/reports/quick?checkId=${lastCheckId}">Quick Report</a>
        <a class="button button-light" href="#/reports/full?checkId=${lastCheckId}">Full Report</a>
      </div>
    </article>
  `;
}

function showMessage(element, text) {
  element.textContent = text;
  element.hidden = false;
}
