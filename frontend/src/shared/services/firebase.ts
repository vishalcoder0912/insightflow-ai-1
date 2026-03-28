import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0,
);

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

if (hasFirebaseConfig) {
  firebaseApp = getApps()[0] || initializeApp(firebaseConfig);
  firestoreDb = getFirestore(firebaseApp);
}

export const db = firestoreDb;
export const isFirebaseTrackingEnabled = Boolean(firestoreDb);
