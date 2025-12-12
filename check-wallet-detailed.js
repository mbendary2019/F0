// check-wallet-detailed.js - Detailed wallet inspection
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'from-zero-84253',
  });
}

const db = admin.firestore();
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

async function checkWalletDetailed() {
  const userId = 'upraBmuRv3PEMQOUKs7EuKXU8xLt';

  console.log('🔍 Detailed wallet inspection...\n');
  console.log(`User ID: ${userId}\n`);

  const walletDoc = await db.collection('wallets').doc(userId).get();

  if (!walletDoc.exists) {
    console.log('❌ Wallet does not exist!');
    process.exit(1);
  }

  const data = walletDoc.data();

  console.log('✅ Wallet found!\n');
  console.log('📊 Raw data:');
  console.log(JSON.stringify(data, null, 2));
  console.log('\n');

  console.log('🔍 Field inspection:');
  console.log(`  balance: ${data.balance}`);
  console.log(`  balance type: ${typeof data.balance}`);
  console.log(`  balance === undefined: ${data.balance === undefined}`);
  console.log(`  balance === null: ${data.balance === null}`);
  console.log(`  balance === 0: ${data.balance === 0}`);
  console.log('\n');

  console.log(`  plan: ${data.plan}`);
  console.log(`  plan type: ${typeof data.plan}`);
  console.log('\n');

  // Check if it's a number
  const isNumber = typeof data.balance === 'number';
  console.log(`✅ Is balance a number? ${isNumber}`);

  if (!isNumber) {
    console.log('\n⚠️  WARNING: balance is NOT a number!');
    console.log('💡 Fixing now...\n');

    await db.collection('wallets').doc(userId).update({
      balance: 1000,
    });

    console.log('✅ Updated balance to 1000 (number type)');
  } else if (data.balance === 0) {
    console.log('\n⚠️  WARNING: balance is 0!');
    console.log('💡 Updating to 1000...\n');

    await db.collection('wallets').doc(userId).update({
      balance: 1000,
    });

    console.log('✅ Updated balance to 1000');
  } else {
    console.log(`\n✅ Balance is correct: ${data.balance}`);
  }

  process.exit(0);
}

checkWalletDetailed().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
