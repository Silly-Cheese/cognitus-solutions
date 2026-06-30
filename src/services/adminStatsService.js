import { COLLECTIONS } from "../firebase/collections.js";
import { getFirestoreModules, listRecentDocuments } from "./firestoreCore.js";

export async function countCollection(collectionName) {
  const { db, firestore } = await getFirestoreModules();
  const snapshot = await firestore.getCountFromServer(firestore.collection(db, collectionName));
  return snapshot.data().count || 0;
}

export async function getAdminStats() {
  const [users, organizations, profiles, checks, reports, claims, appeals, passwordRequests, auditLogs] = await Promise.all([
    countCollection(COLLECTIONS.users),
    countCollection(COLLECTIONS.organizations),
    countCollection(COLLECTIONS.profiles),
    countCollection(COLLECTIONS.checkLogs),
    countCollection(COLLECTIONS.reports),
    countCollection(COLLECTIONS.claims),
    countCollection(COLLECTIONS.appeals),
    countCollection(COLLECTIONS.passwordResetRequests),
    countCollection(COLLECTIONS.auditLogs)
  ]);

  return { users, organizations, profiles, checks, reports, claims, appeals, passwordRequests, auditLogs };
}

export async function getAdminDashboardData() {
  const [stats, recentUsers, recentOrganizations, recentReports, recentChecks, recentAuditLogs] = await Promise.all([
    getAdminStats(),
    listRecentDocuments(COLLECTIONS.users, 8),
    listRecentDocuments(COLLECTIONS.organizations, 8),
    listRecentDocuments(COLLECTIONS.reports, 8),
    listRecentDocuments(COLLECTIONS.checkLogs, 8),
    listRecentDocuments(COLLECTIONS.auditLogs, 12)
  ]);

  return { stats, recentUsers, recentOrganizations, recentReports, recentChecks, recentAuditLogs };
}

export async function listRecentUsers(limitCount = 50) {
  return listRecentDocuments(COLLECTIONS.users, limitCount);
}

export async function listRecentOrganizations(limitCount = 50) {
  return listRecentDocuments(COLLECTIONS.organizations, limitCount);
}

export async function listRecentAuditLogs(limitCount = 100) {
  return listRecentDocuments(COLLECTIONS.auditLogs, limitCount);
}
