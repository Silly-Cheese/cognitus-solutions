import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "../firebase/firebaseApp.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { normalizeDiscordId, normalizeInput } from "../utils/validation.js";

const AUTH_EMAIL_DOMAIN = "cognitus.local";

export function discordIdToAuthEmail(discordId) {
  const cleanDiscordId = normalizeDiscordId(discordId);

  if (!cleanDiscordId) {
    throw new Error("A valid Discord ID is required.");
  }

  return `${cleanDiscordId}@${AUTH_EMAIL_DOMAIN}`;
}

async function loadAuthModule() {
  return import(`${FIREBASE_CDN_BASE}/firebase-auth.js`);
}

async function loadFirestoreModule() {
  return import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`);
}

export async function setAuthPersistenceMode(rememberMe) {
  const { auth, ready } = await initializeFirebaseServices();

  if (!ready) {
    throw new Error("Firebase is not configured yet.");
  }

  const authModule = await loadAuthModule();
  const persistence = rememberMe ? authModule.browserLocalPersistence : authModule.browserSessionPersistence;
  await authModule.setPersistence(auth, persistence);
}

export async function registerWithDiscordAccount({
  discordUsername,
  discordId,
  password,
  accountType = "individual",
  rememberMe = true
}) {
  const { auth, db, ready } = await initializeFirebaseServices();

  if (!ready) {
    throw new Error("Firebase is not configured yet. Add Firebase config before registering accounts.");
  }

  const cleanDiscordId = normalizeDiscordId(discordId);
  const cleanDiscordUsername = normalizeInput(discordUsername);

  if (!cleanDiscordUsername) throw new Error("Discord username is required.");
  if (!cleanDiscordId) throw new Error("A valid Discord ID is required.");
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");

  await setAuthPersistenceMode(rememberMe);

  const authModule = await loadAuthModule();
  const firestore = await loadFirestoreModule();

  const email = discordIdToAuthEmail(cleanDiscordId);
  const credential = await authModule.createUserWithEmailAndPassword(auth, email, password);

  await authModule.updateProfile(credential.user, {
    displayName: cleanDiscordUsername
  });

  const now = firestore.serverTimestamp();
  const userCognitusId = createIdForEntity("user");
  const profileCognitusId = createIdForEntity("profile");
  const userRef = firestore.doc(db, "users", credential.user.uid);
  const profileRef = firestore.doc(db, "profiles", credential.user.uid);

  await firestore.writeBatch(db)
    .set(userRef, {
      uid: credential.user.uid,
      cognitusId: userCognitusId,
      profileId: credential.user.uid,
      displayName: cleanDiscordUsername,
      discordUsername: cleanDiscordUsername,
      discordId: cleanDiscordId,
      accountType,
      role: "user",
      status: "active",
      organizationId: null,
      syntheticEmail: email,
      realEmailCollected: false,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    })
    .set(profileRef, {
      id: credential.user.uid,
      cognitusId: profileCognitusId,
      linkedUserId: credential.user.uid,
      type: "person",
      displayName: cleanDiscordUsername,
      robloxUsernames: [],
      discordUsernames: [cleanDiscordUsername],
      discordIds: [cleanDiscordId],
      knownAliases: [],
      claimedByUid: credential.user.uid,
      identityStatus: "self_registered",
      identityConfidence: 100,
      professionalStanding: "unreviewed",
      riskLevel: "unreviewed",
      reportCount: 0,
      appealCount: 0,
      lastReviewedAt: null,
      createdAt: now,
      updatedAt: now
    })
    .commit();

  return credential.user;
}

export async function loginWithDiscordId({ discordId, password, rememberMe = false }) {
  const { auth, db, ready } = await initializeFirebaseServices();

  if (!ready) {
    throw new Error("Firebase is not configured yet. Add Firebase config before logging in.");
  }

  const cleanDiscordId = normalizeDiscordId(discordId);
  if (!cleanDiscordId) throw new Error("A valid Discord ID is required.");
  if (!password) throw new Error("Password is required.");

  await setAuthPersistenceMode(rememberMe);

  const authModule = await loadAuthModule();
  const firestore = await loadFirestoreModule();

  const credential = await authModule.signInWithEmailAndPassword(auth, discordIdToAuthEmail(cleanDiscordId), password);
  const userRef = firestore.doc(db, "users", credential.user.uid);

  await firestore.setDoc(
    userRef,
    {
      lastLoginAt: firestore.serverTimestamp(),
      lastRememberMeChoice: Boolean(rememberMe),
      updatedAt: firestore.serverTimestamp()
    },
    { merge: true }
  );

  return credential.user;
}

export async function logout() {
  const { auth, ready } = await initializeFirebaseServices();
  if (!ready) return;

  const authModule = await loadAuthModule();
  await authModule.signOut(auth);
}

export async function getCurrentUserRecord(uid) {
  const { db, ready } = await initializeFirebaseServices();
  if (!ready || !uid) return null;

  const firestore = await loadFirestoreModule();
  const snapshot = await firestore.getDoc(firestore.doc(db, "users", uid));

  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function onAuthStateChange(callback) {
  const { auth, ready } = await initializeFirebaseServices();

  if (!ready) {
    callback({ firebaseReady: false, authUser: null, userRecord: null });
    return () => {};
  }

  const authModule = await loadAuthModule();

  return authModule.onAuthStateChanged(auth, async (authUser) => {
    const userRecord = authUser ? await getCurrentUserRecord(authUser.uid) : null;
    callback({ firebaseReady: true, authUser, userRecord });
  });
}
