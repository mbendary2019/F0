// functions/src/schedules/compactSnippets.ts
// Phase 57.3: Weekly scheduled compaction of duplicate snippets

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

const COL_SNIPPETS = 'ops_memory_snippets';
const COL_SNIPPET_FEEDBACK = 'ops_memory_snippet_feedback';

type CompactionResult = {
  totalSnippets: number;
  duplicatesFound: number;
  snippetsMerged: number;
  feedbackMigrated: number;
  errors: number;
  dryRun: boolean;
  timestamp: Date;
};

/**
 * Weekly compaction of duplicate snippets
 * Runs every Monday at 03:10 Asia/Kuwait time
 */
export const weeklyCompactSnippets = onSchedule(
  {
    schedule: '10 3 * * 1', // Every Monday at 03:10
    timeZone: 'Asia/Kuwait',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540, // 9 minutes
  },
  async (event) => {
    const startTime = Date.now();
    logger.info('[weeklyCompactSnippets] Starting weekly compaction...');

    try {
      const result = await compactSnippets({ dryRun: false, batchSize: 100 });

      const duration = Date.now() - startTime;
      logger.info('[weeklyCompactSnippets] Compaction complete', {
        result,
        durationMs: duration,
      });

      // Store compaction result for monitoring
      await getFirestore()
        .collection('ops_compaction_logs')
        .add({
          ...result,
          duration_ms: duration,
          created_at: FieldValue.serverTimestamp(),
        });

      // v2 scheduler functions must return void
    } catch (error) {
      logger.error('[weeklyCompactSnippets] Compaction failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
);

/**
 * Core compaction logic
 */
async function compactSnippets(options: {
  dryRun?: boolean;
  batchSize?: number;
} = {}): Promise<CompactionResult> {
  const { dryRun = true, batchSize = 100 } = options;
  const db = getFirestore();

  logger.info('[compactSnippets] Starting compaction', { dryRun, batchSize });

  // 1) Fetch all snippets
  const snippetsSnap = await db.collection(COL_SNIPPETS).get();
  logger.info(`[compactSnippets] Found ${snippetsSnap.size} total snippets`);

  if (snippetsSnap.empty) {
    return {
      totalSnippets: 0,
      duplicatesFound: 0,
      snippetsMerged: 0,
      feedbackMigrated: 0,
      errors: 0,
      dryRun,
      timestamp: new Date(),
    };
  }

  // 2) Group by text_hash
  const byHash = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  for (const doc of snippetsSnap.docs) {
    const data = doc.data();
    const hash = data.text_hash;

    if (!hash) {
      logger.warn(`[compactSnippets] Snippet ${doc.id} missing text_hash`);
      continue;
    }

    const group = byHash.get(hash) || [];
    group.push(doc);
    byHash.set(hash, group);
  }

  logger.info(`[compactSnippets] Found ${byHash.size} unique text hashes`);

  // 3) Process duplicates
  let duplicatesFound = 0;
  let snippetsMerged = 0;
  let feedbackMigrated = 0;
  let errors = 0;

  for (const [hash, docs] of byHash) {
    if (docs.length <= 1) continue;

    duplicatesFound += docs.length - 1;
    logger.info(`[compactSnippets] Hash ${hash}: ${docs.length} duplicates`);

    try {
      // Sort by created_at (earliest = canonical)
      const sorted = docs.sort((a, b) => {
        const aTime = a.data().created_at?.toMillis?.() || 0;
        const bTime = b.data().created_at?.toMillis?.() || 0;
        return aTime - bTime;
      });

      const canonical = sorted[0];
      const canonicalId = canonical.id;
      const duplicates = sorted.slice(1);

      logger.info(`[compactSnippets] Canonical: ${canonicalId}, Duplicates: ${duplicates.length}`);

      // 4) Migrate feedback from duplicates to canonical
      let feedbackCount = 0;
      for (const dup of duplicates) {
        const feedbackSnap = await db
          .collection(COL_SNIPPET_FEEDBACK)
          .where('snip_id', '==', dup.id)
          .get();

        if (!feedbackSnap.empty) {
          feedbackCount += feedbackSnap.size;

          if (!dryRun) {
            const batch = db.batch();
            for (const feedbackDoc of feedbackSnap.docs) {
              batch.update(feedbackDoc.ref, {
                snip_id: canonicalId,
                migrated_at: FieldValue.serverTimestamp(),
                original_snip_id: dup.id,
              });
            }
            await batch.commit();
            logger.info(
              `[compactSnippets] Migrated ${feedbackSnap.size} feedback from ${dup.id} → ${canonicalId}`
            );
          }
        }

        // 5) Mark duplicate as merged
        if (!dryRun) {
          await db
            .collection(COL_SNIPPETS)
            .doc(dup.id)
            .update({
              merged_into: canonicalId,
              merged_at: FieldValue.serverTimestamp(),
            });
        }

        snippetsMerged++;
      }

      feedbackMigrated += feedbackCount;

      // 6) Update canonical use_count (sum of all duplicates)
      if (!dryRun) {
        const totalUseCount = docs.reduce((sum, doc) => sum + (doc.data().use_count || 0), 0);
        await db
          .collection(COL_SNIPPETS)
          .doc(canonicalId)
          .update({
            use_count: totalUseCount,
            last_compacted_at: FieldValue.serverTimestamp(),
            duplicate_count: docs.length - 1,
          });
      }
    } catch (error) {
      logger.error(`[compactSnippets] Error processing hash ${hash}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      errors++;
    }
  }

  const result: CompactionResult = {
    totalSnippets: snippetsSnap.size,
    duplicatesFound,
    snippetsMerged,
    feedbackMigrated,
    errors,
    dryRun,
    timestamp: new Date(),
  };

  logger.info('[compactSnippets] Compaction complete', result);

  return result;
}
