/**
 * Deduplicate Tasks Script
 * Removes duplicate tasks/phases, keeping only one instance per key
 * Usage: npx ts-node scripts/dedupeTasks.ts <projectId>
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Import ID utilities
function slugify(s: string): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\u0600-\u06FF\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function phaseKey(title: string): string {
  const slug = slugify(title);
  return `phase-${slug || 'untitled'}`;
}

function taskKey(phaseKey: string, title: string): string {
  const slug = slugify(title);
  return `${phaseKey}__${slug || 'untitled'}`;
}

async function dedupeTasks() {
  // Initialize Firebase Admin
  if (!getApps().length) {
    initializeApp({ projectId: 'from-zero-84253' }); // Use your project ID
  }

  const db = getFirestore();
  const projectId = process.argv[2];

  if (!projectId) {
    console.error('❌ Error: Please provide projectId as argument');
    console.log('Usage: npx ts-node scripts/dedupeTasks.ts <projectId>');
    process.exit(1);
  }

  console.log(`🔍 Deduplicating tasks for project: ${projectId}`);

  const projectRef = db.collection('projects').doc(projectId);

  // ====== DEDUPLICATE PHASES ======
  console.log('\n📂 Processing phases...');
  const phasesSnap = await projectRef.collection('phases').get();
  const phasesByKey: Record<string, FirebaseFirestore.QueryDocumentSnapshot[]> = {};

  // Group phases by key
  phasesSnap.forEach((doc) => {
    const data = doc.data();
    const key = phaseKey(data.title || doc.id);
    phasesByKey[key] = phasesByKey[key] || [];
    phasesByKey[key].push(doc);
  });

  let phasesKept = 0;
  let phasesRemoved = 0;

  // Process each phase key group
  for (const [key, docs] of Object.entries(phasesByKey)) {
    if (docs.length <= 1) {
      phasesKept++;
      continue;
    }

    // Sort by creation time (keep oldest)
    const sorted = docs.sort((a, b) => {
      const aTime = a.createTime?.toDate().getTime() || 0;
      const bTime = b.createTime?.toDate().getTime() || 0;
      return aTime - bTime;
    });

    const keep = sorted[0];
    const batch = db.batch();

    // Delete duplicates
    for (const doc of sorted.slice(1)) {
      batch.delete(doc.ref);
      phasesRemoved++;
    }

    // Ensure the kept document has the correct ID
    if (keep.id !== key) {
      const newRef = projectRef.collection('phases').doc(key);
      batch.set(newRef, keep.data(), { merge: true });
      batch.delete(keep.ref);
      console.log(`  ✅ [phases] Renamed "${keep.id}" → "${key}"`);
    } else {
      console.log(`  ✅ [phases] Kept "${key}" (removed ${sorted.length - 1} duplicates)`);
    }

    await batch.commit();
    phasesKept++;
  }

  console.log(`  📊 Summary: kept=${phasesKept} removed=${phasesRemoved}`);

  // ====== DEDUPLICATE TASKS ======
  console.log('\n📂 Processing tasks...');
  const tasksSnap = await projectRef.collection('tasks').get();
  const tasksByKey: Record<string, FirebaseFirestore.QueryDocumentSnapshot[]> = {};

  // Group tasks by key
  tasksSnap.forEach((doc) => {
    const data = doc.data();
    const pKey = data.phaseKey || phaseKey(data.phaseTitle || 'unknown');
    const key = taskKey(pKey, data.title || doc.id);
    tasksByKey[key] = tasksByKey[key] || [];
    tasksByKey[key].push(doc);
  });

  let tasksKept = 0;
  let tasksRemoved = 0;

  // Process each task key group
  for (const [key, docs] of Object.entries(tasksByKey)) {
    if (docs.length <= 1) {
      tasksKept++;
      continue;
    }

    // Sort by update time (keep most recently updated)
    const sorted = docs.sort((a, b) => {
      const aTime = a.data().updatedAt?.toDate().getTime() || a.createTime?.toDate().getTime() || 0;
      const bTime = b.data().updatedAt?.toDate().getTime() || b.createTime?.toDate().getTime() || 0;
      return bTime - aTime; // Most recent first
    });

    const keep = sorted[0];
    const batch = db.batch();

    // Delete duplicates
    for (const doc of sorted.slice(1)) {
      batch.delete(doc.ref);
      tasksRemoved++;
    }

    // Ensure the kept document has the correct ID
    if (keep.id !== key) {
      const newRef = projectRef.collection('tasks').doc(key);
      batch.set(newRef, keep.data(), { merge: true });
      batch.delete(keep.ref);
      console.log(`  ✅ [tasks] Renamed "${keep.id}" → "${key}"`);
    } else {
      console.log(`  ✅ [tasks] Kept "${key}" (removed ${sorted.length - 1} duplicates)`);
    }

    await batch.commit();
    tasksKept++;
  }

  console.log(`  📊 Summary: kept=${tasksKept} removed=${tasksRemoved}`);

  console.log('\n✅ Deduplication complete!');
  console.log(`📊 Total: Phases (kept=${phasesKept}, removed=${phasesRemoved}), Tasks (kept=${tasksKept}, removed=${tasksRemoved})`);
}

// Run the script
dedupeTasks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
