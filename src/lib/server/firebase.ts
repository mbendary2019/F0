/**
 * Server-side Firebase Admin initialization for Next.js
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export function initAdmin() {
  if (getApps().length === 0) {
    // Initialize with Application Default Credentials (ADC)
    // or service account key if provided
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      initializeApp();
    }
  }
}

export const firestoreAdmin = getFirestore();
export const authAdmin = getAuth();
