// src/lib/firebaseClient.ts - Client-side Firebase initialization (browser only)
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, GoogleAuthProvider, GithubAuthProvider } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Singleton pattern - initialize Firebase app only once
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
// Explicitly set region to match Cloud Functions deployment
export const functions = getFunctions(app, "us-central1");
export const storage = getStorage(app);

// App Check (browser only, production)
if (typeof window !== 'undefined' && !('__appCheckInit' in window)) {
  (window as any).__appCheckInit = true;

  // Enable debug mode for local development
  const debugToken = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
  if (debugToken && process.env.NEXT_PUBLIC_USE_EMULATORS === '1') {
    // @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'true' ? true : debugToken;
  }

  // Only initialize App Check when NOT using emulators
  if (process.env.NEXT_PUBLIC_USE_EMULATORS !== '1' && process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
      console.log("✅ [firebaseClient] App Check initialized");
    } catch (e) {
      console.warn("[firebaseClient] App Check initialization failed:", e);
    }
  }
}

// Emulator connections (development only)
if (process.env.NEXT_PUBLIC_USE_EMULATORS === '1') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log("✅ [firebaseClient] Connected to Firestore Emulator: 127.0.0.1:8080");
  } catch (e: any) {
    if (!e.message?.includes('already')) {
      console.warn("[firebaseClient] Firestore emulator connection failed:", e);
    }
  }

  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    console.log("✅ [firebaseClient] Connected to Auth Emulator: http://127.0.0.1:9099");
  } catch (e: any) {
    if (!e.message?.includes('already')) {
      console.warn("[firebaseClient] Auth emulator connection failed:", e);
    }
  }

  try {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    console.log("✅ [firebaseClient] Connected to Functions Emulator: 127.0.0.1:5001");
  } catch (e: any) {
    if (!e.message?.includes('already')) {
      console.warn("[firebaseClient] Functions emulator connection failed:", e);
    }
  }

  try {
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    console.log("✅ [firebaseClient] Connected to Storage Emulator: 127.0.0.1:9199");
  } catch (e: any) {
    if (!e.message?.includes('already')) {
      console.warn("[firebaseClient] Storage emulator connection failed:", e);
    }
  }
}

// Auth providers
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
