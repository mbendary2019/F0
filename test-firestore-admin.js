// test-firestore-admin.js
// اختبار البيانات باستخدام Firebase Admin SDK

const admin = require('firebase-admin');

// Initialize admin with emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'from-zero-84253',
  });
}

const db = admin.firestore();

async function testFirestoreData() {
  console.log('🔍 Testing Firestore Emulator Data with Admin SDK...\n');

  try {
    // Test ops_projects
    console.log('📁 Checking ops_projects collection:');
    const projectsSnap = await db.collection('ops_projects').get();
    console.log(`   Total documents: ${projectsSnap.size}`);

    if (projectsSnap.size > 0) {
      console.log('   Sample documents:');
      projectsSnap.docs.slice(0, 3).forEach((doc) => {
        const data = doc.data();
        console.log(`   - ${doc.id}:`, {
          ownerUid: data.ownerUid,
          name: data.name,
          createdAt: data.createdAt?._seconds
            ? new Date(data.createdAt._seconds * 1000).toISOString()
            : data.createdAt,
        });
      });
    } else {
      console.log('   ⚠️  No documents found!');
    }
    console.log('');

    // Test ops_deployments
    console.log('📁 Checking ops_deployments collection:');
    const deploymentsSnap = await db.collection('ops_deployments').get();
    console.log(`   Total documents: ${deploymentsSnap.size}`);

    if (deploymentsSnap.size > 0) {
      console.log('   Sample documents:');
      deploymentsSnap.docs.slice(0, 3).forEach((doc) => {
        const data = doc.data();
        console.log(`   - ${doc.id}:`, {
          ownerUid: data.ownerUid,
          projectId: data.projectId,
        });
      });
    } else {
      console.log('   ⚠️  No documents found!');
    }
    console.log('');

    // Test billing
    console.log('📁 Checking billing collection:');
    const billingSnap = await db.collection('billing').get();
    console.log(`   Total documents: ${billingSnap.size}`);

    if (billingSnap.size > 0) {
      console.log('   Sample documents:');
      billingSnap.docs.slice(0, 3).forEach((doc) => {
        const data = doc.data();
        console.log(`   - ${doc.id}:`, {
          tokens: data.tokens,
          plan: data.plan,
        });
      });
    } else {
      console.log('   ⚠️  No documents found!');
    }
    console.log('');

    // Test users (alternative location for tokens)
    console.log('📁 Checking users collection:');
    const usersSnap = await db.collection('users').get();
    console.log(`   Total documents: ${usersSnap.size}`);

    if (usersSnap.size > 0) {
      console.log('   Sample documents:');
      usersSnap.docs.slice(0, 3).forEach((doc) => {
        const data = doc.data();
        console.log(`   - ${doc.id}:`, {
          email: data.email,
          fzTokens: data.fzTokens,
          tokens: data.tokens,
        });
      });
    } else {
      console.log('   ⚠️  No documents found!');
    }

    console.log('\n✅ Test completed!');
    console.log('\n📋 Summary:');
    console.log(`   ops_projects: ${projectsSnap.size} documents`);
    console.log(`   ops_deployments: ${deploymentsSnap.size} documents`);
    console.log(`   billing: ${billingSnap.size} documents`);
    console.log(`   users: ${usersSnap.size} documents`);

    if (projectsSnap.size === 0) {
      console.log('\n⚠️  WARNING: No projects found!');
      console.log('   The Dashboard will show 0 projects because ops_projects is empty.');
      console.log('   You need to create projects through the UI or seed script.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testFirestoreData();
