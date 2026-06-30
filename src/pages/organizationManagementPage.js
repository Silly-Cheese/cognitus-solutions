import { getAccountStore } from "../state/accountStore.js";
import { isAdminOrOwner } from "../security/permissions.js";
import { listRecentOrganizations } from "../services/adminOverviewService.js";
import { changeOrganizationTrust, changeOrganizationVerification } from "../services/managementService.js";
import { pill, smallDate } from "../components/adminComponents.js";

const verificationOptions = ["pending_verification", "verified", "unverified", "suspended", "restricted"];
const trustOptions = ["unreviewed", "good", "watch", "concern", "high_risk"];

export async function renderOrganizationManagementPage(root) {
  const account = getAccountStore();

  if (!account.record || !isAdminOrOwner(account.record)) {
    root.innerHTML = accessDenied();
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Organization Management</p>
      <h1>Manage organization records.</h1>
      <p>Review verification status, trust levels, and recent organization activity.</p>
    </section>
    <section id="organizations-panel" class="panel" style="margin-top: 1rem;">Loading organizations...</section>
  `;

  try {
    const organizations = await listRecentOrganizations(100);
    root.querySelector("#organizations-panel").innerHTML = renderOrganizations(organizations);
    attachOrganizationActions(root, account.record);
  } catch (error) {
    root.querySelector("#organizations-panel").innerHTML = `<div class="notice">${error?.message || "Could not load organizations."}</div>`;
  }
}

function renderOrganizations(organizations) {
  if (!organizations.length) return `<div class="empty-state"><h3>No organizations</h3><p>No organization records were found.</p></div>`;

  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Organization</th><th>Verification</th><th>Trust</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          ${organizations.map((org) => `
            <tr>
              <td><strong>${org.name || "Unnamed"}</strong><br><small>${org.cognitusId || org.id}</small></td>
              <td>${pill(org.verificationStatus || "pending")}</td>
              <td>${pill(org.trustLevel || "unreviewed")}</td>
              <td>${smallDate(org.createdAt)}</td>
              <td>
                <div class="mini-actions">
                  <select data-verify-org="${org.id}">
                    ${verificationOptions.map((value) => `<option value="${value}" ${value === org.verificationStatus ? "selected" : ""}>${value}</option>`).join("")}
                  </select>
                  <select data-trust-org="${org.id}">
                    ${trustOptions.map((value) => `<option value="${value}" ${value === org.trustLevel ? "selected" : ""}>${value}</option>`).join("")}
                  </select>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function attachOrganizationActions(root, actor) {
  root.querySelectorAll("[data-verify-org]").forEach((select) => {
    select.addEventListener("change", async () => {
      await changeOrganizationVerification(select.dataset.verifyOrg, select.value, actor);
    });
  });

  root.querySelectorAll("[data-trust-org]").forEach((select) => {
    select.addEventListener("change", async () => {
      await changeOrganizationTrust(select.dataset.trustOrg, select.value, actor);
    });
  });
}

function accessDenied() {
  return `<section class="hero"><p class="eyebrow">Access Denied</p><h1>Admin or Owner access required.</h1><div class="hero-actions"><a class="button button-dark" href="#/dashboard">Dashboard</a></div></section>`;
}
