// check-wallets.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'from-zero-84253',
  });
}

const db = admin.firestore();
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

async function checkWallets() {
  console.log('🔍 Checking wallets collection...\n');

  const snap = await db.collection('wallets').get();

  console.log(`✅ Total wallets: ${snap.size}\n`);

  if (snap.size > 0) {
    console.log('Wallets:');
    snap.forEach((doc) => {
      const data = doc.data();
      console.log(`  - ${doc.id}:`);
      console.log(`    balance: ${data.balance}`);
      console.log(`    plan: ${data.plan}`);
      console.log('');
    });
  } else {
    console.log('❌ No wallets found');
  }

  // Check specific user
  const userId = 'upraBmuRv3PEMQOUKs7EuKXU8xLt';
  console.log(`\n🔍 Checking wallet for user: ${userId}`);

  const userWalletDoc = await db.collection('wallets').doc(userId).get();

  if (userWalletDoc.exists) {
    const data = userWalletDoc.data();
    console.log('✅ Wallet found:');
    console.log(`   balance: ${data.balance}`);
    console.log(`   plan: ${data.plan}`);
  } else {
    console.log('❌ No wallet found for this user');
    console.log('💡 Creating wallet for this user...');

    await db.collection('wallets').doc(userId).set({
      balance: 230,
      plan: 'pro',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Wallet created successfully!');
  }

  process.exit(0);
}

checkWallets().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
