// scripts/seedDashboardDemo.ts
// Seeds demo data for Dashboard (wallets, ops_projects, deployments, liveSessions, ops_aiLogs)

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'from-zero-84253',
  });
}

const db = admin.firestore();

// Set emulator host
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

async function seedDashboardDemo() {
  console.log('🌱 Seeding Dashboard Demo Data...\n');

  const uid = process.env.OWNER_UID || 'demo-test-uid-12345';
  console.log(`👤 Owner UID: ${uid}\n`);

  try {
    // 1. Wallet
    console.log('💰 Creating wallet...');
    await db.collection('wallets').doc(uid).set({
      balance: 1000,
      plan: 'pro',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✅ Wallet created\n');

    // 2. Projects
    console.log('📁 Creating projects...');

    const project1Ref = db.collection('ops_projects').doc();
    await project1Ref.set({
      ownerUid: uid,
      name: 'Delivery App',
      status: 'draft',
      type: 'web',
      slug: 'delivery-app',
      createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      infraType: 'firebase',
      appTypes: ['web'],
    });

    const project2Ref = db.collection('ops_projects').doc();
    await project2Ref.set({
      ownerUid: uid,
      name: 'E-commerce Store',
      status: 'draft',
      type: 'web',
      slug: 'ecommerce-store',
      createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      infraType: 'vercel',
      appTypes: ['web'],
    });

    console.log('✅ 2 projects created\n');

    // 3. Deployments
    console.log('🚀 Creating deployments...');

    await db.collection('deployments').add({
      ownerUid: uid,
      projectId: project1Ref.id,
      projectName: 'Delivery App',
      env: 'production',
      provider: 'vercel',
      status: 'success',
      branch: 'main',
      createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });

    await db.collection('deployments').add({
      ownerUid: uid,
      projectId: project2Ref.id,
      projectName: 'E-commerce Store',
      env: 'production',
      provider: 'vercel',
      status: 'success',
      branch: 'main',
      createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1 * 24 * 60 * 60 * 1000),
    });

    await db.collection('deployments').add({
      ownerUid: uid,
      projectId: project2Ref.id,
      projectName: 'E-commerce Store',
      env: 'preview',
      provider: 'vercel',
      status: 'in_progress',
      branch: 'feature/checkout',
      createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    });

    console.log('✅ 3 deployments created\n');

    // 4. Live Sessions
    console.log('💻 Creating live sessions...');

    await db.collection('liveSessions').add({
      ownerUid: uid,
      projectId: project1Ref.id,
      status: 'active',
      createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      endedAt: null,
    });

    await db.collection('liveSessions').add({
      ownerUid: uid,
      projectId: project2Ref.id,
      status: 'ended',
      createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 5 * 24 * 60 * 60 * 1000),
      endedAt: admin.firestore.Timestamp.fromMillis(Date.now() - 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    });

    await db.collection('liveSessions').add({
      ownerUid: uid,
      projectId: project1Ref.id,
      status: 'ended',
      createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endedAt: admin.firestore.Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
    });

    console.log('✅ 3 live sessions created (1 active, 2 ended)\n');

    // 5. AI Logs
    console.log('🤖 Creating AI logs...');

    await db.collection('ops_aiLogs').add({
      ownerUid: uid,
      projectId: project1Ref.id,
      summary: 'AI optimized your Delivery App navigation for better UX.',
      message: 'Suggested improvements to the navigation menu based on user flow analysis.',
      createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    });

    await db.collection('ops_aiLogs').add({
      ownerUid: uid,
      projectId: project2Ref.id,
      summary: 'F0 Agent detected performance improvements for E-commerce Store.',
      message: 'Recommended code splitting for faster page load times.',
      createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    });

    console.log('✅ 2 AI logs created\n');

    console.log('🎉 SEED COMPLETED SUCCESSFULLY!\n');
    console.log('📊 Summary:');
    console.log('  - 1 wallet (balance: 1000, plan: pro)');
    console.log('  - 2 projects (Delivery App, E-commerce Store)');
    console.log('  - 3 deployments (2 success, 1 in_progress)');
    console.log('  - 3 live sessions (1 active, 2 ended)');
    console.log('  - 2 AI logs\n');

    console.log('🔗 View Dashboard: http://localhost:3030/en/f0\n');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }

  process.exit(0);
}

seedDashboardDemo();
