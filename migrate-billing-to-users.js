// migrate-billing-to-users.js
// نقل بيانات التوكنز من billing إلى users

const admin = require('firebase-admin');

// Initialize admin with emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'from-zero-84253',
  });
}

const db = admin.firestore();

async function migrateBillingToUsers() {
  console.log('🔄 Migrating billing data to users collection...\n');

  try {
    // 1) Get all billing documents
    const billingSnap = await db.collection('billing').get();

    if (billingSnap.empty) {
      console.log('⚠️  No billing documents found!');
      process.exit(0);
    }

    console.log(`📦 Found ${billingSnap.size} billing document(s)\n`);

    // 2) Migrate each document
    for (const billingDoc of billingSnap.docs) {
      const uid = billingDoc.id;
      const billingData = billingDoc.data();

      console.log(`📝 Processing UID: ${uid}`);
      console.log(`   Billing data:`, billingData);

      // Check if user document exists
      const userDocRef = db.collection('users').doc(uid);
      const userDocSnap = await userDocRef.get();

      if (userDocSnap.exists) {
        // Update existing user document
        await userDocRef.update({
          fzTokens: billingData.tokens ?? 0,
          planId: billingData.plan ?? 'starter',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`   ✅ Updated existing users/${uid}`);
      } else {
        // Create new user document
        await userDocRef.set({
          fzTokens: billingData.tokens ?? 0,
          planId: billingData.plan ?? 'starter',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`   ✅ Created new users/${uid}`);
      }

      console.log('');
    }

    console.log('✅ Migration completed!\n');

    // 3) Verify migration
    console.log('📋 Verification:');
    const usersSnap = await db.collection('users').get();
    console.log(`   users collection: ${usersSnap.size} document(s)`);

    usersSnap.docs.forEach((doc) => {
      const data = doc.data();
      console.log(`   - ${doc.id}:`, {
        fzTokens: data.fzTokens,
        planId: data.planId,
      });
    });

    console.log('\n🎉 Migration successful!');
    console.log('\n📊 Dashboard should now show:');
    console.log('   - FZ Tokens from users/{uid}.fzTokens');
    console.log('   - Plan from users/{uid}.planId');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

migrateBillingToUsers();
