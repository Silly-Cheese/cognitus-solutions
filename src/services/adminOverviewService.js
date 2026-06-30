import { COLLECTIONS } from "../firebase/collections.js";
import { listRecentDocuments } from "./firestoreCore.js";

export async function getAdminOverviewData() {
  const [recentUsers, recentOrganizations, recentReports, recentChecks, recentAuditLogs] = await Promise.all([
    listRecentDocuments(COLLECTIONS.users, 8),
    listRecentDocuments(COLLECTIONS.organizations, 8),
    listRecentDocuments(COLLECTIONS.reports, 8),
    listRecentDocuments(COLLECTIONS.checkLogs, 8),
    listRecentDocuments(COLLECTIONS.auditLogs, 12)
  ]);

  return { recentUsers, recentOrganizations, recentReports, recentChecks, recentAuditLogs };
}
