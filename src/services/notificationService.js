import { COLLECTIONS } from "../firebase/collections.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { normalizeInput } from "../utils/validation.js";
import { createDocument, queryDocuments, updateDocument, getFirestoreModules } from "./firestoreCore.js";

function newestFirst(items, limitCount) {
  return items
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, limitCount);
}

export async function createNotification({ userId, title, message, type = "info", link = "" }) {
  if (!userId) throw new Error("Notification user ID is required.");
  if (!normalizeInput(title)) throw new Error("Notification title is required.");

  return createDocument(COLLECTIONS.notifications, {
    cognitusId: createIdForEntity("notification"),
    userId,
    title: normalizeInput(title),
    message: normalizeInput(message),
    type,
    link: normalizeInput(link),
    read: false,
    readAt: null
  });
}

export async function listNotificationsForUser(userId, limitCount = 25) {
  const { firestore } = await getFirestoreModules();
  const items = await queryDocuments(COLLECTIONS.notifications, [
    firestore.where("userId", "==", userId),
    firestore.limit(100)
  ]);
  return newestFirst(items, limitCount);
}

export async function markNotificationRead(notificationId) {
  return updateDocument(COLLECTIONS.notifications, notificationId, {
    read: true,
    readAt: new Date().toISOString()
  });
}
