import { COLLECTIONS } from "../firebase/collections.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { normalizeInput } from "../utils/validation.js";
import { createDocument, queryDocuments, updateDocument, getFirestoreModules } from "./firestoreCore.js";

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
  return queryDocuments(COLLECTIONS.notifications, [
    firestore.where("userId", "==", userId),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(limitCount)
  ]);
}

export async function markNotificationRead(notificationId) {
  return updateDocument(COLLECTIONS.notifications, notificationId, {
    read: true,
    readAt: new Date().toISOString()
  });
}
