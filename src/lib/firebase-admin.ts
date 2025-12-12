// src/lib/firebase-admin.ts - Server-side Firebase Admin SDK initialization
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK (singleton pattern)
if (!admin.apps.length) {
  try {
    // In production: Use Application Default Credentials (ADC) or service account
    // In development: Use ADC (set GOOGLE_APPLICATION_CREDENTIALS env var)
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
    });
    console.log("✅ [firebase-admin] Firebase Admin SDK initialized");
  } catch (error: any) {
    // Fallback: Initialize without explicit credentials (uses ADC)
    if (error.code !== 'app/duplicate-app') {
      console.warn("[firebase-admin] Initializing without credentials (using ADC):", error.message);
      try {
        admin.initializeApp();
      } catch (fallbackError) {
        console.error("❌ [firebase-admin] Failed to initialize:", fallbackError);
      }
    }
  }
}

// Export singleton instances
export { admin };
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminStorage = admin.storage();

// Alias exports for backward compatibility
export const auth = adminAuth;
export const storage = adminStorage;
export const db = adminDb; // Used by many files expecting { db }

// Legacy init function for backward compatibility
export function initAdmin() {
  return { admin, db: adminDb };
}

// Utility functions for server-side operations
export async function verifyIdToken(token?: string) {
  if (!token) {
    throw new Error('No token provided');
  }

  // In emulator mode, you might want to bypass verification for local testing
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === '1') {
    console.warn("[firebase-admin] Running in emulator mode - token verification bypassed");
    // Return a mock user for local development
    return {
      uid: 'dev-user',
      email: 'dev@example.com',
      admin: true,
      sub_tier: 'pro',
      sub_active: true,
    };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("[firebase-admin] Token verification failed:", error);
    throw error;
  }
}

export async function verifySessionCookie(cookie?: string) {
  if (!cookie) {
    throw new Error('No session cookie provided');
  }

  // In emulator mode, bypass verification
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === '1') {
    console.warn("[firebase-admin] Running in emulator mode - session cookie verification bypassed");
    return {
      uid: 'dev-user',
      email: 'dev@example.com',
      claims: {
        admin: true,
        sub_tier: 'pro',
        sub_active: true,
      },
    };
  }

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(cookie, true);
    return decodedClaims;
  } catch (error) {
    console.error("[firebase-admin] Session cookie verification failed:", error);
    throw error;
  }
}
