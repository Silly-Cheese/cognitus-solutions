import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "../firebase/firebaseApp.js";
import { OWNER_BOOTSTRAP, isOwnerBootstrapConfigured } from "../config/bootstrapConfig.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { USER_ROLES } from "../data/constants.js";

const BOOTSTRAP_DOC_PATH = ["settings", "bootstrap"];

async function loadFirestoreModule() {
  return import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`);
}

export async function getBootstrapStatus() {
  const { db, ready } = await initializeFirebaseServices();

  if (!ready) {
    return {
      firebaseReady: false,
      configured: isOwnerBootstrapConfigured(),
      complete: false,
      canAttempt: false,
      message: "Firebase is not configured yet."
    };
  }

  const firestore = await loadFirestoreModule();
  const snapshot = await firestore.getDoc(firestore.doc(db, ...BOOTSTRAP_DOC_PATH));
  const data = snapshot.exists() ? snapshot.data() : null;

  return {
    firebaseReady: true,
    configured: isOwnerBootstrapConfigured(),
    complete: Boolean(data?.complete),
    completedBy: data?.completedBy || null,
    completedAt: data?.completedAt || null,
    canAttempt: isOwnerBootstrapConfigured() && !data?.complete,
    message: data?.complete ? "Owner bootstrap is already complete." : "Owner bootstrap is available."
  };
}

export async function attemptOwnerBootstrap(userRecord) {
  const { db, ready } = await initializeFirebaseServices();

  if (!ready) {
    throw new Error("Firebase is not configured yet.");
  }

  if (!isOwnerBootstrapConfigured()) {
    throw new Error("Owner bootstrap is not configured. Add the owner Discord ID first.");
  }

  if (!userRecord?.uid) {
    throw new Error("You must be logged in before running owner bootstrap.");
  }

  if (userRecord.discordId !== OWNER_BOOTSTRAP.ownerDiscordId) {
    throw new Error("This account is not authorized for owner bootstrap.");
  }

  const firestore = await loadFirestoreModule();
  const bootstrapRef = firestore.doc(db, ...BOOTSTRAP_DOC_PATH);
  const userRef = firestore.doc(db, "users", userRecord.uid);

  await firestore.runTransaction(db, async (transaction) => {
    const bootstrapSnap = await transaction.get(bootstrapRef);

    if (bootstrapSnap.exists() && bootstrapSnap.data()?.complete) {
      throw new Error("Owner bootstrap is already complete.");
    }

    const now = firestore.serverTimestamp();

    transaction.set(
      userRef,
      {
        role: USER_ROLES.owner,
        status: "active",
        ownerBootstrap: true,
        ownerDisplayName: OWNER_BOOTSTRAP.ownerDisplayName,
        robloxUsername: OWNER_BOOTSTRAP.ownerRobloxUsername,
        updatedAt: now
      },
      { merge: true }
    );

    transaction.set(bootstrapRef, {
      cognitusId: createIdForEntity("audit"),
      complete: true,
      completedBy: userRecord.uid,
      completedByDiscordId: userRecord.discordId,
      completedAt: now,
      lockAfterFirstBootstrap: OWNER_BOOTSTRAP.lockAfterFirstBootstrap,
      ownerDiscordId: OWNER_BOOTSTRAP.ownerDiscordId
    });
  });

  return true;
}
