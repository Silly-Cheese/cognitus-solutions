import { firebaseConfig, firebaseReady } from "./firebaseConfig.js";

export const FIREBASE_SDK_VERSION = "12.15.0";
export const FIREBASE_CDN_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

export async function initializeFirebaseServices() {
  if (!firebaseReady) {
    console.warn("Firebase config has not been added yet.");
    return { app: null, auth: null, db: null, ready: false };
  }

  const { initializeApp } = await import(`${FIREBASE_CDN_BASE}/firebase-app.js`);
  const { getAuth } = await import(`${FIREBASE_CDN_BASE}/firebase-auth.js`);
  const { getFirestore } = await import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`);

  firebaseApp = firebaseApp || initializeApp(firebaseConfig);
  firebaseAuth = firebaseAuth || getAuth(firebaseApp);
  firebaseDb = firebaseDb || getFirestore(firebaseApp);

  return {
    app: firebaseApp,
    auth: firebaseAuth,
    db: firebaseDb,
    ready: true
  };
}

export function getFirebaseState() {
  return {
    app: firebaseApp,
    auth: firebaseAuth,
    db: firebaseDb,
    ready: Boolean(firebaseApp && firebaseAuth && firebaseDb)
  };
}
