import { firebaseConfig, firebaseReady } from "./firebaseConfig.js";

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

export async function initializeFirebaseServices() {
  if (!firebaseReady) {
    console.warn("Firebase config has not been added yet.");
    return { app: null, auth: null, db: null, ready: false };
  }

  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

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
