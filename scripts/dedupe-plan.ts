/**
 * Deduplicate Plan Script
 * Removes duplicate phases and tasks, keeping only one instance per slug
 * Usage: ts-node scripts/dedupe-plan.ts <projectId>
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function dedupePlan() {
  // Initialize Firebase Admin
  if (!getApps().length) {
    initializeApp({ projectId: 'from-zero-84253' }); // Use your project ID
  }

  const db = getFirestore();
  const projectId = process.argv[2];

  if (!projectId) {
    console.error('❌ Error: Please provide projectId as argument');
    console.log('Usage: ts-node scripts/dedupe-plan.ts <projectId>');
    process.exit(1);
  }

  console.log(`🔍 Deduplicating plan for project: ${projectId}`);

  const projectRef = db.collection('projects').doc(projectId);

  // Process phases and tasks
  for (const collectionName of ['phases', 'tasks']) {
    console.log(`\n📂 Processing ${collectionName}...`);

    const snapshot = await projectRef.collection(collectionName).get();
    const bySlug: Record<string, FirebaseFirestore.QueryDocumentSnapshot[]> = {};

    // Group by slug
    snapshot.forEach((doc) => {
      const data = doc.data();
      const slug = data.slug || 'no-slug';
      bySlug[slug] = bySlug[slug] || [];
      bySlug[slug].push(doc);
    });

    let keptCount = 0;
    let removedCount = 0;

    // Process each slug group
    for (const [slug, docs] of Object.entries(bySlug)) {
      if (docs.length <= 1) {
        keptCount++;
        continue;
      }

      // Sort by creation time (keep oldest)
      const sorted = docs.sort((a, b) => {
        const aTime = a.createTime?.toDate().getTime() || 0;
        const bTime = b.createTime?.toDate().getTime() || 0;
        return aTime - bTime;
      });

      const keep = sorted[0];

      // Delete duplicates
      for (const doc of sorted.slice(1)) {
        await doc.ref.delete();
        removedCount++;
      }

      // Ensure slug field exists on kept document
      await keep.ref.set({ slug }, { merge: true });

      console.log(
        `  ✅ [${collectionName}] slug="${slug}" kept=${keep.id} removed=${sorted.length - 1}`
      );

      keptCount++;
    }

    console.log(
      `  📊 Summary: kept=${keptCount} removed=${removedCount} total=${keptCount + removedCount}`
    );
  }

  console.log('\n✅ Deduplication complete!');
}

// Run the script
dedupePlan()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
