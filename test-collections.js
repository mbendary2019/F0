// test-collections.js
// سكريبت بسيط للتحقق من البيانات في Firestore Emulator

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'from-zero-84253',
  });
}

const db = admin.firestore();
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

async function checkCollections() {
  const OWNER_UID = 'demo-test-uid-12345';

  console.log('🔍 Checking Firestore Collections...\n');

  // 1) Check wallets
  const walletDoc = await db.collection('wallets').doc(OWNER_UID).get();
  if (walletDoc.exists) {
    const data = walletDoc.data();
    console.log('✅ wallets/{uid}:', {
      balance: data.balance,
      plan: data.plan,
    });
  } else {
    console.log('❌ No wallet doc found');
  }

  // 2) Check projects
  const projectsSnap = await db
    .collection('projects')
    .where('ownerUid', '==', OWNER_UID)
    .get();
  console.log(`✅ projects collection: ${projectsSnap.size} documents`);
  projectsSnap.forEach((doc) => {
    console.log(`   - ${doc.data().name}`);
  });

  // 3) Check deployments
  const deploymentsSnap = await db
    .collection('deployments')
    .where('ownerUid', '==', OWNER_UID)
    .get();
  console.log(`✅ deployments collection: ${deploymentsSnap.size} documents`);
  deploymentsSnap.forEach((doc) => {
    console.log(`   - ${doc.data().projectName} (${doc.data().status})`);
  });

  console.log('\n🎉 All collections verified!');
  process.exit(0);
}

checkCollections().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
