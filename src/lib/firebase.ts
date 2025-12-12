/**
 * Firebase Client SDK Configuration
 * Phase 82: Unified Environment Management
 * Single source of truth for Firebase client initialization with emulator support
 */

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { resolveClientEnv, logClientEnv } from '@/lib/env/resolveEnv';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Initialize Firebase app (singleton pattern)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const firestore = db; // Alias for compatibility
export const functions = getFunctions(app, 'us-central1');
export const storage = getStorage(app);

// Phase 82: Unified Environment Resolution
const env = resolveClientEnv();

// Global flag to prevent duplicate emulator connections
let emulatorsConnected = false;

if (env.effective === 'emulator' && !emulatorsConnected) {
  try {
    // Connect Auth emulator (client-side only)
    if (typeof window !== 'undefined' && env.auth.useEmulator && env.auth.url) {
      connectAuthEmulator(auth, env.auth.url, { disableWarnings: true });
    }

    // Connect Firestore emulator (both client & server)
    if (env.firestore.useEmulator && env.firestore.host && env.firestore.port) {
      connectFirestoreEmulator(db, env.firestore.host, env.firestore.port);
    }

    // Connect Functions emulator (both client & server)
    if (env.functions.useEmulator && env.functions.host && env.functions.port) {
      connectFunctionsEmulator(functions, env.functions.host, env.functions.port);
    }

    // Connect Storage emulator (client-side only)
    if (typeof window !== 'undefined') {
      connectStorageEmulator(storage, 'localhost', 9199);
    }

    emulatorsConnected = true;
    console.log('✅ [Phase 82] Connected to Firebase emulators');
    logClientEnv('[Phase 82]');

    // Auto sign-in anonymously for emulator (ensures request.auth != null)
    if (typeof window !== 'undefined') {
      // Wait for auth to be ready, then sign in
      auth.onAuthStateChanged((user) => {
        if (!user) {
          signInAnonymously(auth)
            .then(() => console.log('✅ [Phase 82] Signed in anonymously'))
            .catch((e) => console.warn('⚠️ [Phase 82] Anonymous sign-in failed:', e.message));
        }
      });
    }
  } catch (error: any) {
    // Emulators already connected or not available
    if (!error.message?.includes('already been called') && !error.message?.includes('emulator-config-failed')) {
      console.warn('⚠️ [Phase 82] Emulators not available:', error.message);
    }
  }
} else if (env.effective === 'cloud') {
  console.log('☁️ [Phase 82] Using Firebase Cloud services');
  logClientEnv('[Phase 82]');
}

// Export default app for compatibility
export default app;
