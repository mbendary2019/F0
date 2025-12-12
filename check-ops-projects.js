// check-ops-projects.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'from-zero-84253',
  });
}

const db = admin.firestore();
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

async function checkOpsProjects() {
  console.log('🔍 Checking ops_projects collection...\n');

  const snap = await db.collection('ops_projects').get();

  console.log(`✅ Total documents: ${snap.size}\n`);

  if (snap.size > 0) {
    console.log('Documents:');
    snap.forEach((doc) => {
      const data = doc.data();
      console.log(`  - ${doc.id}:`);
      console.log(`    name: ${data.name}`);
      console.log(`    ownerUid: ${data.ownerUid}`);
      console.log(`    createdAt: ${data.createdAt}`);
      console.log('');
    });
  } else {
    console.log('❌ No documents found in ops_projects');
    console.log('💡 Tip: You may need to seed this collection with data');
  }

  process.exit(0);
}

checkOpsProjects().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
