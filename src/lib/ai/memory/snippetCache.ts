// src/lib/ai/memory/snippetCache.ts
// Phase 57.2: Cache snippet embeddings to reduce latency and cost
// Stores normalized snippets and their embeddings with deduplication via content hash

import OpenAI from "openai";
import { db } from "./firestoreSchema";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createTTLField, DEFAULT_TTL_DAYS } from "../util/ttl";

// === Constants ===

const COL_SNIPPETS = "ops_memory_snippets" as const;
const DEFAULT_MODEL = "text-embedding-3-large";

// === Types ===

export type SnippetDoc = {
  snip_id: string; // "snp_<hash>"
  text: string; // Normalized snippet text
  text_hash: string; // Hash of normalized text
  embedding: number[]; // Cached embedding vector
  model: string; // Embedding model used
  created_at: FieldValue | Timestamp;
  last_used_at: FieldValue | Timestamp;
  use_count: number; // Number of times retrieved
  expire_at?: Date | Timestamp; // TTL expiration (Phase 57.3)
  merged_into?: string; // If compacted, points to canonical snippet
  metadata?: {
    avg_tokens?: number; // Average tokens (estimated)
    languages?: string[]; // Detected languages
  };
};

export type CachedSnippet = {
  snip_id: string;
  text: string;
  embedding: number[];
  cache: "hit" | "miss";
};

export type BatchCacheResult = {
  hits: Array<{ snip_id: string; text: string; embedding: number[] }>;
  misses: Array<{ snip_id: string; text: string; embedding: number[] }>;
  stats: {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
  };
};

// === Main Functions ===

/**
 * Get cached embedding or embed new snippet
 * Single snippet version with automatic caching
 *
 * @param text - Snippet text
 * @param model - Embedding model (default: text-embedding-3-large)
 * @returns Cached snippet with embedding
 *
 * @example
 * ```typescript
 * const { snip_id, embedding, cache } = await getOrEmbedSnippet(
 *   "Deploy to production using Firebase"
 * );
 * console.log(`Cache ${cache}: ${snip_id}`); // "Cache hit: snp_abc123"
 * ```
 */
export async function getOrEmbedSnippet(
  text: string,
  model: string = DEFAULT_MODEL
): Promise<CachedSnippet> {
  const textNorm = normalizeText(text);
  const hash = hashText(textNorm);
  const snippetId = `snp_${hash}`;

  const ref = db.collection(COL_SNIPPETS).doc(snippetId);
  const snap = await ref.get();

  if (snap.exists) {
    // Cache hit: update usage metadata
    const data = snap.data() as SnippetDoc;

    // Async update (fire and forget)
    ref
      .update({
        last_used_at: FieldValue.serverTimestamp(),
        use_count: FieldValue.increment(1),
      })
      .catch((err) => console.warn(`[snippetCache] Failed to update metadata:`, err));

    return {
      snip_id: snippetId,
      text: data.text,
      embedding: data.embedding,
      cache: "hit",
    };
  }

  // Cache miss: embed and store
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.embeddings.create({
    model,
    input: textNorm,
  });

  const embedding = response.data[0].embedding;

  const snippetDoc: SnippetDoc = {
    snip_id: snippetId,
    text: textNorm,
    text_hash: hash,
    embedding,
    model,
    created_at: FieldValue.serverTimestamp(),
    last_used_at: FieldValue.serverTimestamp(),
    use_count: 1,
    ...createTTLField('snippet', { useCount: 1 }), // Phase 57.3: TTL
    metadata: {
      avg_tokens: Math.ceil(textNorm.length / 4), // Simple estimation
    },
  };

  await ref.set(snippetDoc, { merge: false });

  console.log(`[snippetCache] Cache miss, embedded: ${snippetId}`);

  return {
    snip_id: snippetId,
    text: textNorm,
    embedding,
    cache: "miss",
  };
}

/**
 * Batch get or embed multiple snippets with deduplication
 * Optimized for bulk operations with single batch embedding call
 *
 * @param snippets - Array of snippet texts
 * @param model - Embedding model (default: text-embedding-3-large)
 * @returns Batch result with hits, misses, and stats
 *
 * @example
 * ```typescript
 * const result = await getManyOrEmbed([
 *   "Deploy to production",
 *   "Run tests before deploying",
 *   "Deploy to production" // Duplicate, will be deduped
 * ]);
 *
 * console.log(`Hit rate: ${(result.stats.hitRate * 100).toFixed(1)}%`);
 * // Hit rate: 66.7% (2/3, duplicate removed)
 * ```
 */
export async function getManyOrEmbed(
  snippets: string[],
  model: string = DEFAULT_MODEL
): Promise<BatchCacheResult> {
  if (!snippets.length) {
    return {
      hits: [],
      misses: [],
      stats: {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        hitRate: 1.0,
      },
    };
  }

  // 1) Deduplicate inputs by normalized text
  const uniqueTexts = Array.from(
    new Map(snippets.map((s) => [hashText(normalizeText(s)), normalizeText(s)])).values()
  );

  const snippetIds = uniqueTexts.map((text) => `snp_${hashText(text)}`);

  // 2) Batch fetch from Firestore
  const refs = snippetIds.map((id) => db.collection(COL_SNIPPETS).doc(id));
  const snaps = await db.getAll(...refs);

  const hits: Array<{ snip_id: string; text: string; embedding: number[] }> = [];
  const missTexts: string[] = [];
  const missIds: string[] = [];

  snaps.forEach((snap, i) => {
    if (snap.exists) {
      const data = snap.data() as SnippetDoc;
      hits.push({
        snip_id: snap.id,
        text: data.text,
        embedding: data.embedding,
      });
    } else {
      missTexts.push(uniqueTexts[i]);
      missIds.push(snippetIds[i]);
    }
  });

  // 3) Batch embed misses
  const missRecords: Array<{ snip_id: string; text: string; embedding: number[] }> = [];

  if (missTexts.length > 0) {
    console.log(`[snippetCache] Embedding ${missTexts.length} new snippets...`);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // OpenAI allows up to 2048 inputs per batch
    const batchSize = 100;
    const batches = Math.ceil(missTexts.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, missTexts.length);
      const batchTexts = missTexts.slice(start, end);

      const response = await client.embeddings.create({
        model,
        input: batchTexts,
      });

      for (let j = 0; j < batchTexts.length; j++) {
        const globalIdx = start + j;
        missRecords.push({
          snip_id: missIds[globalIdx],
          text: batchTexts[j],
          embedding: response.data[j].embedding,
        });
      }
    }

    // 4) Batch write to Firestore
    const batch = db.batch();

    for (const record of missRecords) {
      const ref = db.collection(COL_SNIPPETS).doc(record.snip_id);

      const snippetDoc: SnippetDoc = {
        snip_id: record.snip_id,
        text: record.text,
        text_hash: hashText(record.text),
        embedding: record.embedding,
        model,
        created_at: FieldValue.serverTimestamp(),
        last_used_at: FieldValue.serverTimestamp(),
        use_count: 1,
        ...createTTLField('snippet', { useCount: 1 }), // Phase 57.3: TTL
        metadata: {
          avg_tokens: Math.ceil(record.text.length / 4),
        },
      };

      batch.set(ref, snippetDoc, { merge: false });
    }

    await batch.commit();
    console.log(`[snippetCache] Stored ${missRecords.length} new embeddings`);
  }

  // 5) Update hit metadata (async, best effort)
  if (hits.length > 0) {
    const updateBatch = db.batch();

    for (const hit of hits) {
      const ref = db.collection(COL_SNIPPETS).doc(hit.snip_id);
      updateBatch.update(ref, {
        last_used_at: FieldValue.serverTimestamp(),
        use_count: FieldValue.increment(1),
      });
    }

    updateBatch.commit().catch((err) => {
      console.warn(`[snippetCache] Failed to update hit metadata:`, err);
    });
  }

  // 6) Compute stats
  const totalRequests = uniqueTexts.length;
  const cacheHits = hits.length;
  const cacheMisses = missRecords.length;
  const hitRate = totalRequests > 0 ? cacheHits / totalRequests : 1.0;

  return {
    hits,
    misses: missRecords,
    stats: {
      totalRequests,
      cacheHits,
      cacheMisses,
      hitRate,
    },
  };
}

/**
 * Get snippet by ID (for feedback and analytics)
 */
export async function getSnippetById(
  snippetId: string
): Promise<SnippetDoc | null> {
  const snap = await db.collection(COL_SNIPPETS).doc(snippetId).get();

  if (!snap.exists) return null;

  return snap.data() as SnippetDoc;
}

/**
 * Get snippets by IDs (batch)
 */
export async function getSnippetsByIds(
  snippetIds: string[]
): Promise<Map<string, SnippetDoc>> {
  const refs = snippetIds.map((id) => db.collection(COL_SNIPPETS).doc(id));
  const snaps = await db.getAll(...refs);

  const result = new Map<string, SnippetDoc>();

  snaps.forEach((snap) => {
    if (snap.exists) {
      result.set(snap.id, snap.data() as SnippetDoc);
    }
  });

  return result;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalSnippets: number;
  totalUses: number;
  avgUsesPerSnippet: number;
  mostUsed: Array<{ snip_id: string; text: string; use_count: number }>;
}> {
  const query = db
    .collection(COL_SNIPPETS)
    .orderBy("use_count", "desc")
    .limit(10);

  const snap = await query.get();

  const mostUsed = snap.docs.map((doc) => {
    const data = doc.data() as SnippetDoc;
    return {
      snip_id: doc.id,
      text: data.text.substring(0, 100),
      use_count: data.use_count,
    };
  });

  // Get total count (approximate from aggregation)
  const countSnap = await db.collection(COL_SNIPPETS).count().get();
  const totalSnippets = countSnap.data().count;

  const totalUses = mostUsed.reduce((sum, s) => sum + s.use_count, 0);
  const avgUsesPerSnippet = totalSnippets > 0 ? totalUses / totalSnippets : 0;

  return {
    totalSnippets,
    totalUses,
    avgUsesPerSnippet,
    mostUsed,
  };
}

/**
 * Clean up old, unused snippets (TTL policy)
 * Run as scheduled job
 */
export async function cleanupOldSnippets(
  maxAgeDays: number = 180,
  minUseCount: number = 1
): Promise<{ deleted: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  const query = db
    .collection(COL_SNIPPETS)
    .where("last_used_at", "<", Timestamp.fromDate(cutoffDate))
    .where("use_count", "<", minUseCount)
    .limit(500);

  const snap = await query.get();

  if (snap.empty) {
    return { deleted: 0 };
  }

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  console.log(`[snippetCache] Cleaned up ${snap.size} old snippets`);

  return { deleted: snap.size };
}

// === Helper Functions ===

/**
 * Normalize text for consistent hashing
 */
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
    .toLowerCase();
}

/**
 * Simple hash function for text
 * Uses 32-bit FNV-1a hash algorithm
 */
function hashText(text: string): string {
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  return Math.abs(hash).toString(36);
}

/**
 * Estimate cost savings from cache
 */
export function estimateCostSavings(stats: {
  cacheHits: number;
  avgTokensPerSnippet?: number;
}): { tokensSaved: number; costSaved: number } {
  const avgTokens = stats.avgTokensPerSnippet || 50; // Default estimate
  const tokensSaved = stats.cacheHits * avgTokens;

  // OpenAI text-embedding-3-large pricing: $0.13 per 1M tokens
  const costPerToken = 0.13 / 1_000_000;
  const costSaved = tokensSaved * costPerToken;

  return { tokensSaved, costSaved };
}
