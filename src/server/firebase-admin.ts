// =============================================================
// Firebase Admin SDK Helper - Safe Singleton Pattern
// Phase 59 - Cognitive Memory Mesh
// =============================================================

import * as admin from 'firebase-admin';

let _app: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK (singleton)
 * Safe to call multiple times
 */
export function initAdmin(): admin.app.App {
  if (!_app) {
    try {
      if (admin.apps.length) {
        _app = admin.app();
      } else {
        _app = admin.initializeApp();
        console.log("✅ [firebase-admin] Firebase Admin SDK initialized");
      }
    } catch (error) {
      // If initialization fails, try to get existing app
      if ((error as any)?.code === 'app/duplicate-app') {
        _app = admin.app();
      } else {
        console.error("❌ [firebase-admin] Failed to initialize:", error);
        throw error;
      }
    }
  }
  return _app;
}

// Initialize on import
initAdmin();

// Export admin instance
export { admin };

// Export service instances
export const db = (): admin.firestore.Firestore => initAdmin().firestore();
export const auth = (): admin.auth.Auth => initAdmin().auth();
export const storage = (): admin.storage.Storage => initAdmin().storage();

// Export Firestore types for convenience
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
