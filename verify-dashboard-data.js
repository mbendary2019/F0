// verify-dashboard-data.js - Verify all Dashboard collections
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'from-zero-84253',
  });
}

const db = admin.firestore();
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

async function verifyDashboardData() {
  const uid = 'upraBmuRv3PEMQOUKs7EuKXU8xLt';

  console.log('🔍 Verifying Dashboard Data...\n');
  console.log(`User: ${uid}\n`);

  try {
    // 1. Wallet
    console.log('💰 Wallet:');
    const walletDoc = await db.collection('wallets').doc(uid).get();
    if (walletDoc.exists) {
      const data = walletDoc.data();
      console.log(`  ✅ balance: ${data.balance}`);
      console.log(`  ✅ plan: ${data.plan}\n`);
    } else {
      console.log('  ❌ No wallet found\n');
    }

    // 2. Projects
    console.log('📁 Projects (ops_projects):');
    const projectsSnap = await db.collection('ops_projects')
      .where('ownerUid', '==', uid)
      .get();
    console.log(`  ✅ Total: ${projectsSnap.size}`);
    projectsSnap.forEach(doc => {
      const data = doc.data();
      console.log(`     - ${data.name}`);
    });
    console.log('');

    // 3. Deployments
    console.log('🚀 Deployments:');
    const deploymentsSnap = await db.collection('deployments')
      .where('ownerUid', '==', uid)
      .get();
    console.log(`  ✅ Total: ${deploymentsSnap.size}`);
    deploymentsSnap.forEach(doc => {
      const data = doc.data();
      console.log(`     - ${data.projectName} (${data.status})`);
    });
    console.log('');

    // 4. Live Sessions
    console.log('💻 Live Sessions:');
    const sessionsSnap = await db.collection('liveSessions')
      .where('ownerUid', '==', uid)
      .get();
    console.log(`  ✅ Total: ${sessionsSnap.size}`);

    let activeCount = 0;
    let endedCount = 0;
    sessionsSnap.forEach(doc => {
      const data = doc.data();
      if (data.status === 'active') activeCount++;
      if (data.status === 'ended') endedCount++;
    });
    console.log(`     - Active: ${activeCount}`);
    console.log(`     - Ended: ${endedCount}`);
    console.log('');

    // 5. AI Logs
    console.log('🤖 AI Logs (ops_aiLogs):');
    const logsSnap = await db.collection('ops_aiLogs')
      .where('ownerUid', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();
    console.log(`  ✅ Total: ${logsSnap.size}`);
    if (!logsSnap.empty) {
      const latest = logsSnap.docs[0].data();
      console.log(`     Latest: "${latest.summary}"\n`);
    }

    console.log('─'.repeat(60));
    console.log('\n📊 Dashboard Summary:\n');
    console.log(`  Total Projects: ${projectsSnap.size}`);
    console.log(`  Deployments: ${deploymentsSnap.size}`);
    console.log(`  FZ Tokens: ${walletDoc.exists ? walletDoc.data().balance : 0}`);
    console.log(`  Plan: ${walletDoc.exists ? walletDoc.data().plan : 'N/A'}`);
    console.log(`  Live Sessions (Active): ${activeCount}`);
    console.log(`  AI Logs: ${logsSnap.size}\n`);

    console.log('✅ All data verified!\n');
    console.log('🔗 View Dashboard: http://localhost:3030/en/f0\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

verifyDashboardData();
