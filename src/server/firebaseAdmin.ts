import * as admin from "firebase-admin";

/**
 * Firebase Admin SDK initialization
 * Used for server-side operations (API routes, Cloud Functions)
 */

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    // In production, use service account
    // In development, Application Default Credentials
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
    console.log("✅ Firebase Admin SDK initialized");
  } catch (error) {
    console.error("❌ Firebase Admin SDK initialization error:", error);
    // Fallback: initialize without credentials (will use ADC)
    admin.initializeApp();
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminApp = admin.app();

export default admin;
