// seed-billing-data.js
// إضافة بيانات billing للمستخدم الموجود

const admin = require('firebase-admin');

// Initialize admin with emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'from-zero-84253',
  });
}

const db = admin.firestore();

async function seedBillingData() {
  console.log('🌱 Seeding billing data...\n');

  try {
    // Get the UID from existing projects
    const projectsSnap = await db.collection('ops_projects').limit(1).get();

    if (projectsSnap.empty) {
      console.error('❌ No projects found! Cannot determine ownerUid.');
      process.exit(1);
    }

    const ownerUid = projectsSnap.docs[0].data().ownerUid;
    console.log(`📝 Found ownerUid: ${ownerUid}`);

    // Create billing document
    const billingData = {
      tokens: 1250,           // رصيد التوكنز
      plan: 'pro',            // الباقة الحالية
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('billing').doc(ownerUid).set(billingData);
    console.log(`✅ Created billing document for ${ownerUid}`);
    console.log(`   Tokens: ${billingData.tokens}`);
    console.log(`   Plan: ${billingData.plan}`);

    // Verify
    const billingDoc = await db.collection('billing').doc(ownerUid).get();
    if (billingDoc.exists()) {
      console.log('\n✅ Billing document verified!');
      console.log('   Data:', billingDoc.data());
    }

    console.log('\n🎉 Billing data seeded successfully!');
    console.log('\n📊 Expected Dashboard values:');
    console.log(`   - Total Projects: 16`);
    console.log(`   - Deployments: 6`);
    console.log(`   - FZ Tokens: 1,250`);
    console.log(`   - Plan: Pro ($29/mo)`);
    console.log(`   - Progress Bar: 12.5% (1,250 / 10,000)`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seedBillingData();
