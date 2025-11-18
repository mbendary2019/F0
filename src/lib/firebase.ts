/**
 * Firebase Client SDK Configuration
 * Unified exports for Firebase services with emulator support
 */

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

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

// Connect to Firebase Emulators in development
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === '1' || process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

if (useEmulators) {
  let emulatorsConnected = false;

  try {
    if (!emulatorsConnected) {
      // Connect Auth emulator (client-side only)
      if (typeof window !== 'undefined') {
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      }

      // Connect Firestore emulator (both client & server)
      connectFirestoreEmulator(db, 'localhost', 8080);

      // Connect Functions emulator (both client & server)
      connectFunctionsEmulator(functions, 'localhost', 5001);

      // Connect Storage emulator (client-side only)
      if (typeof window !== 'undefined') {
        connectStorageEmulator(storage, 'localhost', 9199);
      }

      emulatorsConnected = true;
      console.log('✅ [firebase] Connected to emulators');

      // Auto sign-in anonymously for emulator (ensures request.auth != null)
      if (typeof window !== 'undefined') {
        // Wait for auth to be ready, then sign in
        auth.onAuthStateChanged((user) => {
          if (!user) {
            signInAnonymously(auth)
              .then(() => console.log('✅ [firebase] Signed in anonymously'))
              .catch((e) => console.warn('⚠️ [firebase] Anonymous sign-in failed:', e.message));
          }
        });
      }
    }
  } catch (error: any) {
    // Emulators already connected or not available
    if (!error.message?.includes('already been called')) {
      console.warn('⚠️ [firebase] Emulators not available:', error.message);
    }
  }
}

// Export default app for compatibility
export default app;
