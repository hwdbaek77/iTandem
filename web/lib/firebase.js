/**
 * Firebase client SDK initialization for the Next.js web app.
 * Uses environment variables for config, with fallbacks for local dev.
 */

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAdMbd6CjU_S7Joaw3bSM08pHsPJ6miq94",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "itandem-api.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "itandem-api",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "itandem-api.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "954488814160",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:954488814160:web:18f5bf2a958bb7ce0b98c5",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export { app, auth, firebaseConfig };
