// firebase setup
import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

export const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] || "AIzaSyBi_CZwvsVv2Tr1Nseip4DdQu8n15on28k",
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] || "bank-d08b2.firebaseapp.com",
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] || "bank-d08b2",
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] || "bank-d08b2.firebasestorage.app",
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] || "808246782180",
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] || "1:808246782180:web:108c0d1b3d6d9bde5564f1",
  measurementId: import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"] || "G-HW801SQSB7",
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

const authEmulator = import.meta.env["VITE_AUTH_EMULATOR_HOST"];
if (authEmulator && typeof window !== "undefined") {
  connectAuthEmulator(auth, `http://${authEmulator}`, { disableWarnings: true });
}

export let analytics: any = null;
if (typeof window !== "undefined") {
  isSupported().then((yes) => {
    if (yes) {
      analytics = getAnalytics(app);
    }
  });
}

export default app;

