#!/usr/bin/env node
// scripts/set-admin.mjs
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE ||
                process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                resolve(__dirname, '../secrets/admin.json');

const email = process.argv[2];
if (!email) {
  console.error('❌ Usage: node scripts/set-admin.mjs <user-email>');
  console.error('Example: node scripts/set-admin.mjs user@example.com');
  process.exit(1);
}

try {
  // Initialize Firebase Admin
  const serviceAccount = await import(svcPath, { assert: { type: 'json' } });
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount.default),
  });

  console.log(`📝 Setting admin claims for: ${email}`);

  const auth = admin.auth();
  const user = await auth.getUserByEmail(email);

  console.log(`✓ Found user: ${user.uid}`);

  // Set custom claims
  await auth.setCustomUserClaims(user.uid, {
    admin: true,
    developer: true,
    roles: ['admin', 'developer']
  });

  console.log(`✅ Claims set successfully for ${email}:`);
  console.log('   - admin: true');
  console.log('   - developer: true');
  console.log('   - roles: ["admin", "developer"]');
  console.log('');
  console.log('⚠️  Important: User must sign out and sign in again for claims to take effect!');

  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error.message);
  if (error.code === 'ENOENT') {
    console.error(`\nService account file not found at: ${svcPath}`);
    console.error('Set FIREBASE_SERVICE_ACCOUNT_FILE or GOOGLE_APPLICATION_CREDENTIALS env var');
  }
  process.exit(1);
}
