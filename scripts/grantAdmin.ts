// F0 Phase 36 - Grant Admin Access Script

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  `${process.env.HOME}/.secrets/firebase.json`;

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error);
  process.exit(1);
}

async function grantAdmin(uid: string) {
  try {
    // Get user
    const user = await admin.auth().getUser(uid);
    console.log(`\n📋 User found: ${user.email}`);

    // Set custom claims
    await admin.auth().setCustomUserClaims(uid, { 
      admin: true,
      role: 'admin'
    });

    console.log(`✅ Admin access granted to: ${uid}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Custom Claims: { admin: true, role: 'admin' }`);
    
    // Log to audit (if audit system is deployed)
    try {
      const db = admin.firestore();
      await db.collection('admin_activity').add({
        ts: admin.firestore.FieldValue.serverTimestamp(),
        action: 'admin.grant',
        actor: { uid: 'system', email: 'setup-script' },
        target: { type: 'user', id: uid, name: user.email || uid },
      });
      console.log(`📝 Audit log created`);
    } catch (auditError) {
      console.warn(`⚠️  Audit logging failed (this is OK during setup):`, auditError.message);
    }

    console.log(`\n🎉 Done! User can now access /admin/* routes`);
    console.log(`\nNext steps:`);
    console.log(`1. User must sign out and sign in again for claims to take effect`);
    console.log(`2. Visit /admin/audits to view audit dashboard`);
    console.log(`3. Check Firestore rules are allowing admin access`);
    
  } catch (error: any) {
    console.error(`❌ Error granting admin:`, error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Get UID from command line
const uid = process.argv[2];

if (!uid) {
  console.error(`
❌ Usage: node scripts/grantAdmin.js <USER_UID>

Example:
  node scripts/grantAdmin.js abc123def456

To find a user's UID:
1. Firebase Console → Authentication → Users
2. Click on user email
3. Copy "User UID"

Or get it programmatically:
  firebase auth:export users.json --project from-zero-84253
  cat users.json | jq '.users[] | {uid, email}'
`);
  process.exit(1);
}

// Run
console.log(`\n🔐 Granting admin access to: ${uid}`);
grantAdmin(uid);


