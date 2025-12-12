const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'from-zero-84253' });
}

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const db = admin.firestore();

async function checkMessages() {
  const projectId = 'test-phase99-1764097887040';

  const snapshot = await db
    .collection('ops_projects')
    .doc(projectId)
    .collection('agent_messages')
    .orderBy('createdAt', 'asc')
    .get();

  console.log('\n📋 Messages in Firestore:\n');
  snapshot.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log(`Message ${i + 1} (${data.role}):`);
    console.log(data.content);
    console.log('\n' + '─'.repeat(60) + '\n');
  });
}

checkMessages();
