#!/usr/bin/env node
// scripts/set-admin.js
const admin = require('firebase-admin');
const path = require('path');

const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE ||
                process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                path.resolve(__dirname, '../secrets/admin.json');

const email = process.argv[2];
if (!email) {
  console.error('❌ Usage: node scripts/set-admin.js <user-email>');
  console.error('Example: node scripts/set-admin.js user@example.com');
  process.exit(1);
}

async function main() {
  try {
    // Initialize Firebase Admin
    const serviceAccount = require(svcPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
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
    if (error.code === 'ENOENT' || error.code === 'MODULE_NOT_FOUND') {
      console.error(`\nService account file not found at: ${svcPath}`);
      console.error('Set FIREBASE_SERVICE_ACCOUNT_FILE or GOOGLE_APPLICATION_CREDENTIALS env var');
    }
    process.exit(1);
  }
}

main();
