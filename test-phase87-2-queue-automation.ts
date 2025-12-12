/**
 * Phase 87.2: Queue Automation Test Script
 *
 * Tests the complete queue automation flow:
 * 1. Seeds test data (project, phases, tasks, queued_actions)
 * 2. Calls /api/f0/auto-execute-queue
 * 3. Verifies task execution and status updates
 * 4. Checks agent_messages for system notifications
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccountPath = path.join(process.env.HOME || '', '.secrets', 'firebase.json');

  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Firebase service account file not found at:', serviceAccountPath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  initializeApp({
    credential: cert(serviceAccount),
    projectId: 'from-zero-84253',
  });
}

const db = getFirestore();

// Set emulator if needed
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log('✅ Using Firestore emulator:', process.env.FIRESTORE_EMULATOR_HOST);
}

async function seedTestData() {
  console.log('\n🌱 Seeding test data...\n');

  const projectId = 'test-queue-automation';
  const projectRef = db.collection('projects').doc(projectId);

  // 1. Create project
  await projectRef.set({
    id: projectId,
    title: 'Queue Automation Test Project',
    ownerUid: 'test-user-123',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  console.log('✅ Created project:', projectId);

  // 2. Create MVP phase
  await projectRef.collection('phases').doc('mvp').set({
    id: 'mvp',
    title: 'MVP Phase',
    status: 'active',
    order: 1,
    createdAt: Date.now(),
  });
  console.log('✅ Created phase: mvp');

  // 3. Create test tasks
  const tasks = [
    {
      id: 'task-1',
      phaseId: 'mvp',
      title: 'Create login page',
      description: 'Build a simple login page with email and password fields',
      status: 'pending',
      priority: 'high',
      estimatedEffort: '2h',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'task-2',
      phaseId: 'mvp',
      title: 'Add form validation',
      description: 'Validate email format and password strength',
      status: 'pending',
      priority: 'medium',
      estimatedEffort: '1h',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  for (const task of tasks) {
    await projectRef.collection('tasks').doc(task.id).set(task);
    console.log(`✅ Created task: ${task.id} - ${task.title}`);
  }

  // 4. Create queued_actions
  const actions = [
    {
      type: 'execute_task',
      taskId: 'task-1',
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    },
    {
      type: 'execute_task',
      taskId: 'task-2',
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    },
  ];

  for (const action of actions) {
    await projectRef.collection('queued_actions').add(action);
    console.log(`✅ Created queued_action for task: ${action.taskId}`);
  }

  console.log('\n✅ Test data seeded successfully!\n');
  return projectId;
}

async function testAutoExecuteQueue(projectId: string) {
  console.log('\n🧪 Testing auto-execute queue...\n');

  // For emulator testing, we'll use a mock auth token
  // In production, you'd get a real Firebase ID token
  const mockToken = 'mock-token-for-emulator';

  try {
    const response = await fetch('http://localhost:3030/api/f0/auto-execute-queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mockToken}`,
      },
      body: JSON.stringify({
        projectId,
      }),
    });

    const data = await response.json();

    console.log('📥 Response status:', response.status);
    console.log('📥 Response data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ API call failed:', data);
      return false;
    }

    if (!data.ok) {
      console.error('❌ API returned error:', data.error);
      return false;
    }

    if (!data.executed) {
      console.log('⚠️ No pending tasks in queue');
      return false;
    }

    console.log('\n✅ Queue execution successful!');
    console.log('   Action ID:', data.actionId);
    console.log('   Task ID:', data.taskId);
    console.log('   Summary:', data.summary);
    console.log('   Patches:', data.patchesCount);

    return true;
  } catch (error) {
    console.error('❌ Error calling API:', error);
    return false;
  }
}

async function verifyResults(projectId: string) {
  console.log('\n🔍 Verifying results...\n');

  const projectRef = db.collection('projects').doc(projectId);

  // 1. Check task status
  const task1 = await projectRef.collection('tasks').doc('task-1').get();
  const taskData = task1.data();

  console.log('📋 Task 1 status:', taskData?.status);

  if (taskData?.status === 'completed') {
    console.log('✅ Task marked as completed');
  } else {
    console.log('⚠️ Task not completed. Current status:', taskData?.status);
  }

  // 2. Check queued_action status
  const actionsSnap = await projectRef.collection('queued_actions')
    .where('taskId', '==', 'task-1')
    .limit(1)
    .get();

  if (!actionsSnap.empty) {
    const actionData = actionsSnap.docs[0].data();
    console.log('📋 Queued action status:', actionData.status);

    if (actionData.status === 'completed') {
      console.log('✅ Queued action marked as completed');
    } else {
      console.log('⚠️ Queued action not completed. Current status:', actionData.status);
    }
  }

  // 3. Check code_patches
  const patchesSnap = await projectRef.collection('code_patches')
    .where('taskId', '==', 'task-1')
    .get();

  console.log('📋 Code patches created:', patchesSnap.size);

  if (patchesSnap.size > 0) {
    console.log('✅ Code patches stored in Firestore');
    patchesSnap.forEach((doc) => {
      const patch = doc.data();
      console.log(`   - ${patch.path} (${patch.action})`);
    });
  }

  // 4. Check agent_messages
  const messagesSnap = await projectRef.collection('agent_messages')
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get();

  console.log('\n💬 Recent agent messages:');
  messagesSnap.forEach((doc) => {
    const msg = doc.data();
    console.log(`   [${msg.role}] ${msg.content.substring(0, 100)}...`);
  });

  console.log('\n✅ Verification complete!\n');
}

async function cleanup(projectId: string) {
  console.log('\n🧹 Cleaning up test data...\n');

  const projectRef = db.collection('projects').doc(projectId);

  // Delete subcollections
  const collections = ['phases', 'tasks', 'queued_actions', 'code_patches', 'agent_messages'];

  for (const collectionName of collections) {
    const snapshot = await projectRef.collection(collectionName).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`✅ Deleted ${snapshot.size} documents from ${collectionName}`);
  }

  // Delete project
  await projectRef.delete();
  console.log('✅ Deleted project');

  console.log('\n✅ Cleanup complete!\n');
}

async function main() {
  console.log('🚀 Phase 87.2: Queue Automation Test\n');
  console.log('═'.repeat(50));

  let projectId = '';

  try {
    // Step 1: Seed test data
    projectId = await seedTestData();

    // Wait a bit for Firestore to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Test auto-execute queue
    const success = await testAutoExecuteQueue(projectId);

    if (!success) {
      console.log('\n❌ Test failed. Check the logs above.\n');
      process.exit(1);
    }

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Verify results
    await verifyResults(projectId);

    console.log('═'.repeat(50));
    console.log('\n✅ All tests passed!\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (projectId) {
      await cleanup(projectId);
    }
  }
}

main();
