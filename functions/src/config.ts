// functions/src/config.ts
import * as dotenv from "dotenv";
import * as admin from 'firebase-admin';

dotenv.config(); // Reads functions/.env in emulator

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Check if running in emulator mode
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' ||
                   process.env.FIRESTORE_EMULATOR_HOST;

// Configure Firestore to use emulator if in emulator mode
if (isEmulator) {
  const db = admin.firestore();
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  db.settings({
    host: firestoreHost,
    ssl: false
  });

  // Configure Storage emulator
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
  }

  console.log('🔧 Admin SDK configured for emulator mode');
  console.log(`   Firestore: ${firestoreHost}`);
  console.log(`   Storage: ${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`);
}

// Export Firestore instance
export const db = admin.firestore();

type Cfg = {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PORTAL_RETURN_URL: string;
  API_KEY_HASH_SECRET: string;
  PROJECT_ID: string;
  REGION: string;
};

export function getConfig(): Cfg {
  // Priority: process.env → functions params/config
  const STRIPE_SECRET_KEY =
    process.env.STRIPE_SECRET_KEY || (process.env as any).stripe?.secret_key;
  const STRIPE_WEBHOOK_SECRET =
    process.env.STRIPE_WEBHOOK_SECRET || (process.env as any).stripe?.webhook_secret;
  const PORTAL_RETURN_URL =
    process.env.PORTAL_RETURN_URL || (process.env as any).portal?.return_url || "http://localhost:3000/developers";
  const API_KEY_HASH_SECRET =
    process.env.API_KEY_HASH_SECRET || (process.env as any).api?.hash_secret;

  const PROJECT_ID =
    process.env.GCLOUD_PROJECT ||
    (process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : undefined) ||
    process.env.PROJECT_ID ||
    "demo-project";
  const REGION = process.env.FUNCTIONS_REGION || "us-central1";

  // Validate required secrets
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !API_KEY_HASH_SECRET) {
    console.warn("⚠️ Missing required secrets - using demo values");
  }

  return {
    STRIPE_SECRET_KEY: STRIPE_SECRET_KEY || "sk_test_demo",
    STRIPE_WEBHOOK_SECRET: STRIPE_WEBHOOK_SECRET || "whsec_demo",
    PORTAL_RETURN_URL,
    API_KEY_HASH_SECRET: API_KEY_HASH_SECRET || "demo_secret",
    PROJECT_ID,
    REGION,
  };
}
