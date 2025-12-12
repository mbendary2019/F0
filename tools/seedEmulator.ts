// tools/seedEmulator.ts
//
// سكريبت بسيط يضيف:
// - يوزر واحد (doc في users)
// - 3 مشاريع في ops_projects
// - 3 ديبلويمِنتس في ops_deployments
//
// قبل ما تشغّله:
// 1) تأكد إن الـ emulators شغّالين (Firestore على 8080).
// 2) عدّل OWNER_UID تحت وخليه الـ uid الحقيقي من Auth Emulator.

import admin from 'firebase-admin';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'from-zero-84253';

// ✋ عدّل ده وخليه الـ uid بتاع اليوزر اللي داخل به (من شاشة Auth Emulator)
const OWNER_UID = process.env.OWNER_UID || 'REPLACE_WITH_REAL_UID';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();

// نأكد إننا بنضرب على الـ Emulator مش الـ Cloud
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

async function seed() {
  if (!OWNER_UID || OWNER_UID === 'REPLACE_WITH_REAL_UID') {
    console.error('❌ عدّل OWNER_UID في tools/seedEmulator.ts قبل التشغيل.');
    console.error('   أو شغّله بـ: OWNER_UID=your-uid pnpm seed:emulator');
    process.exit(1);
  }

  console.log('🚀 Seeding Firestore Emulator...');
  console.log(`   Project ID: ${PROJECT_ID}`);
  console.log(`   Owner UID: ${OWNER_UID}`);
  console.log('');

  // ============= wallets/{uid} =============
  const walletRef = db.collection('wallets').doc(OWNER_UID);
  await walletRef.set(
    {
      balance: 230,  // رصيد التوكنز
      plan: 'pro',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log('✅ Seeded wallets doc');

  // ============= projects =============
  const projectsRef = db.collection('projects');

  const projectsPayload = [
    {
      name: 'Delivery App',
      type: 'web',
      status: 'draft',
    },
    {
      name: 'E-commerce Store',
      type: 'web',
      status: 'draft',
    },
    {
      name: 'F0 Platform',
      type: 'web',
      status: 'draft',
    },
    {
      name: 'Mobile Banking App',
      type: 'mobile',
      status: 'active',
    },
    {
      name: 'Dashboard Analytics',
      type: 'web',
      status: 'active',
    },
  ];

  for (const p of projectsPayload) {
    await projectsRef.add({
      ...p,
      ownerUid: OWNER_UID,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log(`✅ Seeded ${projectsPayload.length} projects in 'projects' collection`);

  // ============= deployments =============
  const deploymentsRef = db.collection('deployments');

  const deploymentsPayload = [
    {
      projectName: 'Delivery App',
      provider: 'vercel',
      status: 'success',
      branch: 'main',
      url: 'https://delivery-app.vercel.app',
    },
    {
      projectName: 'E-commerce Store',
      provider: 'vercel',
      status: 'in_progress',
      branch: 'feature/checkout',
      url: null,
    },
    {
      projectName: 'F0 Platform',
      provider: 'github-actions',
      status: 'failed',
      branch: 'dev',
      url: null,
    },
    {
      projectName: 'Mobile Banking App',
      provider: 'firebase',
      status: 'success',
      branch: 'main',
      url: 'https://banking-app.web.app',
    },
    {
      projectName: 'Dashboard Analytics',
      provider: 'vercel',
      status: 'success',
      branch: 'main',
      url: 'https://dashboard-analytics.vercel.app',
    },
    {
      projectName: 'F0 Platform',
      provider: 'vercel',
      status: 'success',
      branch: 'staging',
      url: 'https://f0-staging.vercel.app',
    },
  ];

  for (const d of deploymentsPayload) {
    await deploymentsRef.add({
      ...d,
      ownerUid: OWNER_UID,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log(`✅ Seeded ${deploymentsPayload.length} deployments in 'deployments' collection`);

  console.log('');
  console.log('🎉 Done seeding Firestore Emulator!');
  console.log('');
  console.log('📊 Expected Dashboard values:');
  console.log(`   Total Projects: ${projectsPayload.length}`);
  console.log(`   Projects This Week: ${projectsPayload.length} (all just created)`);
  console.log(`   Deployments: ${deploymentsPayload.length}`);
  console.log('   FZ Tokens: 230');
  console.log('   Plan: Pro ($29/mo)');
  console.log('   Progress Bar: 2.3% (230/10,000)');
  console.log('');
  console.log('🌐 Open Dashboard: http://localhost:3030/en/f0');

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
