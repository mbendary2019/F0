/**
 * Server-side Firebase Admin initialization for Next.js
 */

import { getApps, getApp, initializeApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App | null = null;
let firestore: Firestore | null = null;
let adminAuth: Auth | null = null;
let adminStorage: Storage | null = null;

function initAdminApp(): App {
  if (adminApp) return adminApp;

  if (!getApps().length) {
    adminApp = initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'from-zero-84253',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'from-zero-84253.firebasestorage.app',
    });
  } else {
    adminApp = getApp();
  }

  return adminApp!;
}

export function getFirestoreAdmin(): Firestore {
  if (firestore) return firestore;

  const app = initAdminApp();
  firestore = getFirestore(app);

  // ⚠️ مهم: نضبط الـ emulator مرة واحدة بس
  // ماينفعش نعمل settings() كل مرة
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // لما تستخدم Admin SDK مع emulator، عادة مش محتاج settings()
    // مجرد FIRESTORE_EMULATOR_HOST بيكفي
    // لو عندك كود قديم بيعمل firestore.settings(...) شيله
  }

  return firestore!;
}

export function getAuthAdmin(): Auth {
  if (adminAuth) return adminAuth;

  const app = initAdminApp();
  adminAuth = getAuth(app);
  return adminAuth!;
}

export function getStorageAdmin(): Storage {
  if (adminStorage) return adminStorage;

  const app = initAdminApp();
  adminStorage = getStorage(app);
  return adminStorage!;
}

// Legacy exports for backwards compatibility
// These will be initialized on first access
export const firestoreAdmin = new Proxy({} as Firestore, {
  get(target, prop) {
    const db = getFirestoreAdmin();
    return (db as any)[prop];
  },
});

export const authAdmin = new Proxy({} as Auth, {
  get(target, prop) {
    const auth = getAuthAdmin();
    return (auth as any)[prop];
  },
});

// Legacy function export for backwards compatibility
export const initAdmin = initAdminApp;
