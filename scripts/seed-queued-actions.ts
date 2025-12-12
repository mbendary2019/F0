/**
 * Helper script to create queued_actions for pending tasks
 *
 * This seeds the queue with pending tasks so they can be executed
 * via the auto-execute queue button.
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

async function seedQueuedActionsForProject(projectId: string) {
  console.log(`\n🌱 Seeding queued_actions for project: ${projectId}\n`);

  const projectRef = db.collection('projects').doc(projectId);

  // 1. Get all pending tasks
  const tasksSnapshot = await projectRef
    .collection('tasks')
    .where('status', '==', 'pending')
    .get();

  if (tasksSnapshot.empty) {
    console.log('⚠️ No pending tasks found in this project');
    return;
  }

  console.log(`📋 Found ${tasksSnapshot.size} pending tasks`);

  // 2. Create queued_action for each pending task
  let createdCount = 0;

  for (const taskDoc of tasksSnapshot.docs) {
    const task = taskDoc.data();
    const taskId = taskDoc.id;

    // Check if queued_action already exists for this task
    const existingActions = await projectRef
      .collection('queued_actions')
      .where('taskId', '==', taskId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existingActions.empty) {
      console.log(`⏭️  Skipping task "${task.title}" - already has queued_action`);
      continue;
    }

    // Create queued_action
    await projectRef.collection('queued_actions').add({
      type: 'execute_task',
      taskId,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    createdCount++;
    console.log(`✅ Created queued_action for task: "${task.title}" (${taskId})`);
  }

  console.log(`\n✅ Created ${createdCount} queued_actions for project ${projectId}\n`);
}

async function main() {
  const projectId = process.argv[2];

  if (!projectId) {
    console.error('❌ Usage: pnpm tsx scripts/seed-queued-actions.ts <projectId>');
    console.error('Example: pnpm tsx scripts/seed-queued-actions.ts my-project-id');
    process.exit(1);
  }

  console.log('🚀 Seeding queued_actions for pending tasks\n');
  console.log('═'.repeat(50));

  try {
    // Check if project exists
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      console.error(`❌ Project "${projectId}" not found`);
      process.exit(1);
    }

    await seedQueuedActionsForProject(projectId);

    console.log('═'.repeat(50));
    console.log('\n✅ Done! You can now use the "Run next queued task" button.\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
