// Firebase configuration will be pasted here during the final setup part.
// Do not place secret server keys in this project. Firebase web config is safe for client apps,
// but Firestore Security Rules must enforce all real access control.

export const firebaseConfig = {
  apiKey: "PASTE_FIREBASE_API_KEY_HERE",
  authDomain: "PASTE_FIREBASE_AUTH_DOMAIN_HERE",
  projectId: "PASTE_FIREBASE_PROJECT_ID_HERE",
  storageBucket: "PASTE_FIREBASE_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_FIREBASE_MESSAGING_SENDER_ID_HERE",
  appId: "PASTE_FIREBASE_APP_ID_HERE"
};

export const firebaseReady = !Object.values(firebaseConfig).some((value) =>
  String(value).startsWith("PASTE_")
);
