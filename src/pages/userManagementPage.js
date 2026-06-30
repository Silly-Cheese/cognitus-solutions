import { ACCOUNT_STATUSES, USER_ROLES } from "../data/constants.js";
import { getAccountStore } from "../state/accountStore.js";
import { isAdminOrOwner, isOwner } from "../security/permissions.js";
import { listRecentUsers } from "../services/adminOverviewService.js";
import { changeUserRole, changeUserStatus } from "../services/managementService.js";
import { pill, smallDate } from "../components/adminComponents.js";

export async function renderUserManagementPage(root) {
  const account = getAccountStore();

  if (!account.record || !isAdminOrOwner(account.record)) {
    root.innerHTML = accessDenied();
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">User Management</p>
      <h1>Manage Cognitus accounts.</h1>
      <p>Review users, update status, and manage roles. Owner-only roles are protected in the interface.</p>
    </section>
    <section id="users-panel" class="panel" style="margin-top: 1rem;">Loading users...</section>
  `;

  try {
    const users = await listRecentUsers(100);
    root.querySelector("#users-panel").innerHTML = renderUsers(users, account.record);
    attachUserActions(root, account.record);
  } catch (error) {
    root.querySelector("#users-panel").innerHTML = `<div class="notice">${error?.message || "Could not load users."}</div>`;
  }
}

function renderUsers(users, actor) {
  if (!users.length) return `<div class="empty-state"><h3>No users</h3><p>No user records were found.</p></div>`;

  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map((user) => `
            <tr>
              <td><strong>${user.displayName || "Unnamed"}</strong><br><small>${user.cognitusId || user.id}</small></td>
              <td>${pill(user.role || "user")}</td>
              <td>${pill(user.status || "active")}</td>
              <td>${smallDate(user.createdAt)}</td>
              <td>
                <div class="mini-actions">
                  <select data-role-user="${user.id}" ${!isOwner(actor) && user.role === USER_ROLES.owner ? "disabled" : ""}>
                    ${Object.values(USER_ROLES).map((role) => `<option value="${role}" ${role === user.role ? "selected" : ""}>${role}</option>`).join("")}
                  </select>
                  <select data-status-user="${user.id}">
                    ${ACCOUNT_STATUSES.map((status) => `<option value="${status}" ${status === user.status ? "selected" : ""}>${status}</option>`).join("")}
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

function attachUserActions(root, actor) {
  root.querySelectorAll("[data-role-user]").forEach((select) => {
    select.addEventListener("change", async () => {
      await changeUserRole(select.dataset.roleUser, select.value, actor);
    });
  });

  root.querySelectorAll("[data-status-user]").forEach((select) => {
    select.addEventListener("change", async () => {
      await changeUserStatus(select.dataset.statusUser, select.value, actor);
    });
  });
}

function accessDenied() {
  return `<section class="hero"><p class="eyebrow">Access Denied</p><h1>Admin or Owner access required.</h1><div class="hero-actions"><a class="button button-dark" href="#/dashboard">Dashboard</a></div></section>`;
}
