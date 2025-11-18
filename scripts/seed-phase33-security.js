#!/usr/bin/env node
/**
 * Seed Security Policies for Phase 33
 * Creates initial ops_policies and admin user
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function seedSecurityPolicies() {
  console.log('🌱 Seeding Phase 33 Security Policies...\n');

  try {
    // 1. Create denylist
    console.log('1️⃣ Creating ops_policies/denylist...');
    await db.collection('ops_policies').doc('denylist').set({
      actions: [
        'delete_database',
        'drop_collection',
        'modify_auth',
        'delete_user_data',
        'modify_billing',
        'change_ownership'
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    console.log('   ✅ Denylist created\n');

    // 2. Create protected_targets
    console.log('2️⃣ Creating ops_policies/protected_targets...');
    await db.collection('ops_policies').doc('protected_targets').set({
      targets: [
        'production',
        'main_db',
        'auth_service',
        'payment_service',
        'user_data'
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    console.log('   ✅ Protected targets created\n');

    // 3. Create test admin user (optional - update with your UID)
    console.log('3️⃣ Creating sample admin user...');
    const sampleAdminUid = 'REPLACE_WITH_YOUR_UID'; // Update this!
    
    if (sampleAdminUid !== 'REPLACE_WITH_YOUR_UID') {
      await db.collection('admins').doc(sampleAdminUid).set({
        uid: sampleAdminUid,
        email: 'admin@example.com', // Update this!
        roles: ['admin', 'owner'],
        active: true,
        highRiskApproved: true,
        suspended: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      console.log('   ✅ Admin user created\n');
    } else {
      console.log('   ⚠️  SKIPPED: Update sampleAdminUid in script first!\n');
    }

    // 4. Create observability_cache/totals (for runbook triggers)
    console.log('4️⃣ Creating observability_cache/totals...');
    await db.collection('observability_cache').doc('totals').set({
      calls24h: 0,
      errors24h: 0,
      p95: 0,
      updatedAt: Date.now()
    }, { merge: true });
    console.log('   ✅ Observability cache initialized\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Security policies seeded successfully!\n');
    console.log('📋 Next Steps:');
    console.log('  1. Update sampleAdminUid with your actual UID');
    console.log('  2. Verify policies in Firestore Console');
    console.log('  3. Deploy Phase 33: ./DEPLOY_PHASE_33.sh\n');

  } catch (error) {
    console.error('❌ Error seeding policies:', error);
    process.exit(1);
  }
}

// Run seeding
seedSecurityPolicies()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


