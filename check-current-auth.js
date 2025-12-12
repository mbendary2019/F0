// check-current-auth.js - Check all auth users in emulator
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'from-zero-84253',
  });
}

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

async function checkAuth() {
  console.log('🔍 Checking all auth users in emulator...\n');

  try {
    const listUsersResult = await admin.auth().listUsers();

    console.log(`✅ Total users: ${listUsersResult.users.length}\n`);

    if (listUsersResult.users.length === 0) {
      console.log('❌ No users found in Auth emulator');
      console.log('💡 You need to sign up first at: http://localhost:3030/en/auth\n');
      process.exit(0);
    }

    console.log('Users:\n');
    for (const user of listUsersResult.users) {
      console.log(`  📧 Email: ${user.email}`);
      console.log(`  🆔 UID: ${user.uid}`);
      console.log(`  ⏰ Created: ${new Date(user.metadata.creationTime).toLocaleString()}\n`);

      // Check if this user has a wallet
      const db = admin.firestore();
      const walletDoc = await db.collection('wallets').doc(user.uid).get();

      if (walletDoc.exists) {
        const data = walletDoc.data();
        console.log(`  ✅ Has wallet:`);
        console.log(`     Balance: ${data.balance}`);
        console.log(`     Plan: ${data.plan}\n`);
      } else {
        console.log(`  ❌ No wallet found for this user`);
        console.log(`  💡 Creating wallet now...\n`);

        await db.collection('wallets').doc(user.uid).set({
          balance: 1000,
          plan: 'pro',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`  ✅ Wallet created with balance: 1000, plan: pro\n`);
      }
      console.log('─'.repeat(60) + '\n');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  process.exit(0);
}

checkAuth();
