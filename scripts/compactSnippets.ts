// scripts/compactSnippets.ts
// Phase 57.3: Offline compaction job to merge duplicate snippets
// Consolidates snippets with same text_hash and migrates feedback

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin
if (!getApps().length) {
  const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : undefined;

  initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : undefined,
    projectId: process.env.FIREBASE_PROJECT_ID || "from-zero-84253",
  });
}

const db = getFirestore();

const COL_SNIPPETS = "ops_memory_snippets";
const COL_SNIPPET_FEEDBACK = "ops_memory_snippet_feedback";

// === Types ===

type CompactionResult = {
  totalSnippets: number;
  duplicatesFound: number;
  snippetsMerged: number;
  feedbackMigrated: number;
  errors: Array<{ hash: string; error: string }>;
  dryRun: boolean;
};

// === Main Function ===

/**
 * Compact duplicate snippets by merging them into canonical documents
 *
 * Strategy:
 * 1. Group snippets by text_hash
 * 2. For each group with duplicates:
 *    - Keep earliest created_at as canonical
 *    - Migrate feedback from duplicates to canonical
 *    - Mark duplicates as merged_into: <canonical_id>
 *    - Update canonical use_count
 *
 * @param options - Compaction options
 * @returns Compaction result
 */
export async function compactSnippets(options: {
  dryRun?: boolean;
  batchSize?: number;
} = {}): Promise<CompactionResult> {
  const { dryRun = true, batchSize = 100 } = options;

  console.log(`[compactSnippets] Starting compaction (dryRun: ${dryRun})...`);

  const result: CompactionResult = {
    totalSnippets: 0,
    duplicatesFound: 0,
    snippetsMerged: 0,
    feedbackMigrated: 0,
    errors: [],
    dryRun,
  };

  try {
    // 1) Fetch all snippets
    const snippetsSnap = await db.collection(COL_SNIPPETS).get();
    result.totalSnippets = snippetsSnap.size;

    console.log(`[compactSnippets] Found ${result.totalSnippets} total snippets`);

    // 2) Group by text_hash
    const byHash = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();

    for (const doc of snippetsSnap.docs) {
      const data = doc.data();
      const hash = data.text_hash;

      if (!hash) {
        console.warn(`[compactSnippets] Snippet ${doc.id} missing text_hash, skipping`);
        continue;
      }

      const group = byHash.get(hash) || [];
      group.push(doc);
      byHash.set(hash, group);
    }

    console.log(`[compactSnippets] Found ${byHash.size} unique text hashes`);

    // 3) Process duplicates
    for (const [hash, docs] of byHash) {
      if (docs.length <= 1) continue; // No duplicates

      result.duplicatesFound += docs.length - 1;

      try {
        // Sort by created_at (earliest first)
        const sorted = docs.sort((a, b) => {
          const aTime = a.data().created_at?.toMillis?.() || 0;
          const bTime = b.data().created_at?.toMillis?.() || 0;
          return aTime - bTime;
        });

        const canonical = sorted[0];
        const canonicalId = canonical.id;
        const duplicates = sorted.slice(1);

        console.log(
          `[compactSnippets] Hash ${hash}: ${docs.length} duplicates, canonical: ${canonicalId}`
        );

        // 4) Migrate feedback from duplicates to canonical
        for (const dup of duplicates) {
          const dupId = dup.id;

          // Find feedback referencing this duplicate
          const feedbackSnap = await db
            .collection(COL_SNIPPET_FEEDBACK)
            .where("snip_id", "==", dupId)
            .limit(batchSize)
            .get();

          if (!feedbackSnap.empty) {
            console.log(
              `[compactSnippets] Migrating ${feedbackSnap.size} feedback from ${dupId} → ${canonicalId}`
            );

            if (!dryRun) {
              const batch = db.batch();

              for (const feedbackDoc of feedbackSnap.docs) {
                batch.update(feedbackDoc.ref, { snip_id: canonicalId });
              }

              await batch.commit();
            }

            result.feedbackMigrated += feedbackSnap.size;
          }

          // 5) Mark duplicate as merged
          if (!dryRun) {
            await db
              .collection(COL_SNIPPETS)
              .doc(dupId)
              .update({
                merged_into: canonicalId,
                last_updated: new Date(),
              });
          }

          result.snippetsMerged++;
        }

        // 6) Update canonical use_count (sum of all duplicates)
        if (!dryRun) {
          const totalUseCount = docs.reduce(
            (sum, doc) => sum + (doc.data().use_count || 0),
            0
          );

          await db.collection(COL_SNIPPETS).doc(canonicalId).update({
            use_count: totalUseCount,
            last_updated: new Date(),
          });
        }
      } catch (error) {
        console.error(`[compactSnippets] Error processing hash ${hash}:`, error);
        result.errors.push({
          hash,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(`[compactSnippets] Compaction complete:`);
    console.log(`  - Total snippets: ${result.totalSnippets}`);
    console.log(`  - Duplicates found: ${result.duplicatesFound}`);
    console.log(`  - Snippets merged: ${result.snippetsMerged}`);
    console.log(`  - Feedback migrated: ${result.feedbackMigrated}`);
    console.log(`  - Errors: ${result.errors.length}`);

    if (dryRun) {
      console.log(`\n⚠️  DRY RUN - No changes were made`);
      console.log(`Run with { dryRun: false } to apply changes`);
    }

    return result;
  } catch (error) {
    console.error(`[compactSnippets] Fatal error:`, error);
    throw error;
  }
}

/**
 * Clean up merged snippets (delete duplicates marked as merged_into)
 * Run this after verifying compaction results
 */
export async function cleanupMergedSnippets(options: {
  dryRun?: boolean;
  batchSize?: number;
} = {}): Promise<{ deleted: number }> {
  const { dryRun = true, batchSize = 100 } = options;

  console.log(`[cleanupMergedSnippets] Starting cleanup (dryRun: ${dryRun})...`);

  const query = db
    .collection(COL_SNIPPETS)
    .where("merged_into", "!=", null)
    .limit(batchSize);

  const snap = await query.get();

  if (snap.empty) {
    console.log(`[cleanupMergedSnippets] No merged snippets to clean up`);
    return { deleted: 0 };
  }

  console.log(`[cleanupMergedSnippets] Found ${snap.size} merged snippets`);

  if (!dryRun) {
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`[cleanupMergedSnippets] Deleted ${snap.size} merged snippets`);
  } else {
    console.log(`\n⚠️  DRY RUN - Would delete ${snap.size} snippets`);
  }

  return { deleted: snap.size };
}

// === CLI Entry Point ===

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--no-dry-run");
  const cleanup = args.includes("--cleanup");

  (async () => {
    try {
      if (cleanup) {
        const result = await cleanupMergedSnippets({ dryRun });
        console.log(`\nCleanup result: ${result.deleted} snippets deleted`);
      } else {
        const result = await compactSnippets({ dryRun });
        console.log(`\nCompaction result:`);
        console.log(JSON.stringify(result, null, 2));
      }

      process.exit(0);
    } catch (error) {
      console.error("Fatal error:", error);
      process.exit(1);
    }
  })();
}
