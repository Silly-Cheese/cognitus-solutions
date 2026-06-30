import { initializeFirebaseServices } from "../firebase/firebaseApp.js";

export async function getFirestoreModules() {
  const { db, ready } = await initializeFirebaseServices();

  if (!ready) {
    throw new Error("Firebase is not configured yet.");
  }

  const firestore = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
  return { db, firestore };
}

export async function createDocument(collectionName, data) {
  const { db, firestore } = await getFirestoreModules();
  const ref = firestore.doc(firestore.collection(db, collectionName));
  const now = firestore.serverTimestamp();

  await firestore.setDoc(ref, {
    ...data,
    id: ref.id,
    createdAt: now,
    updatedAt: now
  });

  return ref.id;
}

export async function setDocument(collectionName, id, data, merge = true) {
  const { db, firestore } = await getFirestoreModules();
  const ref = firestore.doc(db, collectionName, id);
  const now = firestore.serverTimestamp();

  await firestore.setDoc(
    ref,
    {
      ...data,
      id,
      updatedAt: now
    },
    { merge }
  );

  return id;
}

export async function getDocument(collectionName, id) {
  const { db, firestore } = await getFirestoreModules();
  const snapshot = await firestore.getDoc(firestore.doc(db, collectionName, id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function updateDocument(collectionName, id, data) {
  const { db, firestore } = await getFirestoreModules();
  await firestore.updateDoc(firestore.doc(db, collectionName, id), {
    ...data,
    updatedAt: firestore.serverTimestamp()
  });
  return id;
}

export async function listRecentDocuments(collectionName, limitCount = 25, orderField = "createdAt") {
  const { db, firestore } = await getFirestoreModules();
  const queryRef = firestore.query(
    firestore.collection(db, collectionName),
    firestore.orderBy(orderField, "desc"),
    firestore.limit(limitCount)
  );

  const snapshot = await firestore.getDocs(queryRef);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function queryDocuments(collectionName, constraints = []) {
  const { db, firestore } = await getFirestoreModules();
  const queryRef = firestore.query(firestore.collection(db, collectionName), ...constraints);
  const snapshot = await firestore.getDocs(queryRef);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function serverNow() {
  const { firestore } = await getFirestoreModules();
  return firestore.serverTimestamp();
}
