/**
 * Seed GoDaddy Integration to Firestore Emulator
 * Run: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm tsx scripts/seed-godaddy-emulator.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin with emulator
const app = initializeApp({
  projectId: 'from-zero-84253',
});

const db = getFirestore(app);

// GoDaddy credentials from .env.local
const GODADDY_KEY = 'e4hSVt1meBaD_8Tx8foYAKxEbbikGvCgBQ9';
const GODADDY_SECRET = 'WCMrEdLceREkmfngE7hrPb';

// Dev user ID (from functions/.env)
const DEV_UID = 'test-user-dev-local';

async function seedGoDaddyIntegration() {
  console.log('🌱 Seeding GoDaddy integration to Firestore Emulator...');
  console.log(`📍 Using FIRESTORE_EMULATOR_HOST: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`👤 Dev User ID: ${DEV_UID}`);

  try {
    // Save GoDaddy credentials to vault
    const vaultRef = db
      .collection('vault')
      .doc('integrations')
      .collection(DEV_UID)
      .doc('godaddy');

    await vaultRef.set({
      provider: 'godaddy',
      credentials: {
        apiKey: GODADDY_KEY,
        apiSecret: GODADDY_SECRET,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ GoDaddy integration seeded successfully!');
    console.log('\nPath:', `vault/integrations/${DEV_UID}/godaddy`);
    console.log('\nData:');
    console.log({
      provider: 'godaddy',
      credentials: {
        apiKey: GODADDY_KEY,
        apiSecret: '***' + GODADDY_SECRET.slice(-4),
      },
    });

    console.log('\n🎯 You can now test GoDaddy functions!');
    console.log('Test command:');
    console.log('curl -X POST http://127.0.0.1:5001/from-zero-84253/us-central1/getGoDaddyDomains -H "Content-Type: application/json" -d \'{"data": {}}\'');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding GoDaddy integration:', error);
    process.exit(1);
  }
}

seedGoDaddyIntegration();
