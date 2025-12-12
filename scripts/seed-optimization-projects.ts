// scripts/seed-optimization-projects.ts
// Phase 138: Seeds test projects in the 'projects' collection for optimization testing

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

async function seedOptimizationProjects() {
  console.log('🌱 Seeding Optimization Test Projects...\n');

  const uid = process.env.OWNER_UID || 'demo-test-uid-12345';
  console.log(`👤 Owner UID: ${uid}\n`);

  try {
    // 1. Create test project in 'projects' collection
    const projectId = 'test-optimization-project';
    console.log(`📁 Creating project: ${projectId}`);

    await db.collection('projects').doc(projectId).set({
      ownerUid: uid,
      name: 'Test Optimization Project',
      status: 'active',
      type: 'web',
      slug: 'test-optimization',
      appTypes: ['web'],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✅ Project created\n');

    // 2. Seed some test runs (for history testing)
    console.log('📊 Creating test coverage reports...');
    await db
      .collection('projects')
      .doc(projectId)
      .collection('coverageReports')
      .add({
        line: 75,
        branch: 60,
        filesMeasured: 42,
        createdAt: new Date().toISOString(),
      });
    console.log('✅ Coverage report created\n');

    // 3. Seed test runs
    console.log('🧪 Creating test runs...');
    await db
      .collection('projects')
      .doc(projectId)
      .collection('testRuns')
      .add({
        stats: {
          total: 50,
          passed: 45,
          failed: 3,
          flaky: 2,
        },
        createdAt: new Date().toISOString(),
      });
    console.log('✅ Test run created\n');

    // 4. Seed security stats
    console.log('🔐 Creating security stats...');
    await db
      .collection('projects')
      .doc(projectId)
      .collection('securityStats')
      .add({
        totalAlerts: 5,
        blocking: 0,
        high: 1,
        createdAt: new Date().toISOString(),
      });
    console.log('✅ Security stats created\n');

    // 5. Seed code health
    console.log('💊 Creating code health snapshot...');
    await db
      .collection('projects')
      .doc(projectId)
      .collection('codeHealthSnapshots')
      .add({
        issues: {
          total: 12,
          critical: 0,
          high: 2,
          medium: 5,
          low: 5,
        },
        createdAt: new Date().toISOString(),
      });
    console.log('✅ Code health snapshot created\n');

    // 6. Seed deployments
    console.log('🚀 Creating deployments...');
    for (let i = 0; i < 3; i++) {
      await db
        .collection('projects')
        .doc(projectId)
        .collection('deployments')
        .add({
          status: 'success',
          env: i === 0 ? 'production' : 'preview',
          branch: i === 0 ? 'main' : `feature-${i}`,
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        });
    }
    console.log('✅ 3 deployments created\n');

    // 7. Seed live sessions
    console.log('📡 Creating live sessions...');
    for (let i = 0; i < 5; i++) {
      await db
        .collection('projects')
        .doc(projectId)
        .collection('liveSessions')
        .add({
          status: i === 0 ? 'active' : 'ended',
          createdAt: new Date(Date.now() - i * 12 * 60 * 60 * 1000).toISOString(),
        });
    }
    console.log('✅ 5 live sessions created\n');

    // 8. Seed agent tasks
    console.log('🤖 Creating agent tasks...');
    for (let i = 0; i < 10; i++) {
      await db
        .collection('projects')
        .doc(projectId)
        .collection('agentTasks')
        .add({
          status: 'completed',
          type: i % 2 === 0 ? 'code_review' : 'refactor',
          createdAt: new Date(Date.now() - i * 6 * 60 * 60 * 1000).toISOString(),
        });
    }
    console.log('✅ 10 agent tasks created\n');

    console.log('🎉 SEED COMPLETED SUCCESSFULLY!\n');
    console.log('📊 Summary:');
    console.log(`  - 1 project: ${projectId}`);
    console.log('  - 1 coverage report (75% line coverage)');
    console.log('  - 1 test run (45/50 passed)');
    console.log('  - 1 security stats (5 alerts, 1 high)');
    console.log('  - 1 code health snapshot (12 issues)');
    console.log('  - 3 deployments');
    console.log('  - 5 live sessions');
    console.log('  - 10 agent tasks\n');

    console.log(`🔗 Test optimization at: http://localhost:3030/en/projects/${projectId}\n`);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }

  process.exit(0);
}

seedOptimizationProjects();
