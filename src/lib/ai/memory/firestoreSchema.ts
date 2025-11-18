// src/lib/ai/memory/firestoreSchema.ts
// Firestore schema and types for memory clusters and context links
// Integrates with Firebase Admin SDK

import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

// Initialize Admin once (safe to call multiple times)
if (!getApps().length) {
  try {
    // Try explicit credentials first
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({
        credential: cert(require(process.env.GOOGLE_APPLICATION_CREDENTIALS)),
        projectId: process.env.FIREBASE_PROJECT_ID || "from-zero-84253",
      });
    } else if (process.env.FIREBASE_CONFIG) {
      // Parse from env (Cloud Functions style)
      const config = JSON.parse(process.env.FIREBASE_CONFIG);
      initializeApp({
        credential: applicationDefault(),
        projectId: config.projectId || process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      // Application default credentials (works in Cloud Functions/Cloud Run)
      initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || "from-zero-84253",
      });
    }
  } catch (error) {
    console.error("[firestoreSchema] Firebase Admin initialization failed:", error);
    throw error;
  }
}

export const db = getFirestore();

// === Collections ===
export const COL_CLUSTERS = "ops_memory_clusters" as const;
export const COL_LINKS = "ops_memory_links" as const;
export const COL_MEMORIES = "ops_collab_memory" as const; // Reference to existing memories

// === Types (align with Phase 56 Day 4) ===

/**
 * Memory Cluster Document
 * Stores clustered memories with metadata from auto-tagging
 */
export type ClusterDoc = {
  cluster_id: string; // Stable ID from clusterer (e.g., "cl_abc123")
  user_id: string; // Owner of these memories
  title: string; // Auto-generated title (max 8 words)
  summary: string; // Auto-generated summary (1-2 sentences)
  tags: string[]; // 3-7 tags (kebab-case)
  item_ids: string[]; // Memory document IDs in this cluster
  centroid: number[]; // L2-normalized embedding centroid
  confidence: number; // Auto-tagger confidence (0-1)
  representative_id: string; // Most representative memory ID
  similarity_stats: {
    avg: number; // Average intra-cluster similarity
    min: number; // Minimum similarity
    max: number; // Maximum similarity
  };
  size: number; // Number of items in cluster
  created_at: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  last_updated: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  metadata?: {
    // Optional metadata for advanced use cases
    locale?: "ar" | "en" | string;
    source?: string; // Where this cluster came from
    version?: number; // Schema version for migrations
  };
};

/**
 * Context Link Document
 * Links new memories to existing clusters for context retrieval
 */
export type LinkDoc = {
  link_id: string; // Generated unique ID (e.g., "lnk_123abc")
  user_id: string; // Owner
  source_memory_id: string; // New memory ID being linked
  target_cluster_id: string; // Cluster ID it links to
  similarity: number; // Cosine similarity to cluster centroid (0-1)
  created_at: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  metadata?: {
    // Optional metadata
    threshold_used?: number; // Threshold that was applied
    model_used?: string; // Embedding model used
  };
};

/**
 * Memory Document Reference (from existing schema)
 * This is the structure we read from ops_collab_memory
 */
export type MemoryDoc = {
  id: string;
  userId: string;
  roomId: string;
  sessionId: string;
  type: string; // "message" | "summary" | etc.
  content: string; // The actual memory text
  createdAt: FirebaseFirestore.Timestamp;
  metadata?: Record<string, unknown>;
};

// === Helpers ===

/**
 * Get server timestamp for Firestore
 */
export const now = () => FieldValue.serverTimestamp();

/**
 * Convert ClusterDoc to JSON-safe object (for API responses)
 */
export function clusterToJSON(doc: ClusterDoc): Record<string, unknown> {
  return {
    cluster_id: doc.cluster_id,
    user_id: doc.user_id,
    title: doc.title,
    summary: doc.summary,
    tags: doc.tags,
    item_ids: doc.item_ids,
    confidence: doc.confidence,
    representative_id: doc.representative_id,
    similarity_stats: doc.similarity_stats,
    size: doc.size,
    created_at:
      doc.created_at instanceof Timestamp
        ? doc.created_at.toDate().toISOString()
        : null,
    last_updated:
      doc.last_updated instanceof Timestamp
        ? doc.last_updated.toDate().toISOString()
        : null,
    metadata: doc.metadata,
    // Note: centroid omitted for size (can be 1536+ dimensions)
  };
}

/**
 * Convert LinkDoc to JSON-safe object
 */
export function linkToJSON(doc: LinkDoc): Record<string, unknown> {
  return {
    link_id: doc.link_id,
    user_id: doc.user_id,
    source_memory_id: doc.source_memory_id,
    target_cluster_id: doc.target_cluster_id,
    similarity: doc.similarity,
    created_at:
      doc.created_at instanceof Timestamp
        ? doc.created_at.toDate().toISOString()
        : null,
    metadata: doc.metadata,
  };
}

/**
 * Validate cluster document structure
 */
export function isValidClusterDoc(doc: unknown): doc is ClusterDoc {
  if (typeof doc !== "object" || doc === null) return false;
  const d = doc as Record<string, unknown>;

  return (
    typeof d.cluster_id === "string" &&
    typeof d.user_id === "string" &&
    typeof d.title === "string" &&
    typeof d.summary === "string" &&
    Array.isArray(d.tags) &&
    Array.isArray(d.item_ids) &&
    Array.isArray(d.centroid) &&
    typeof d.confidence === "number" &&
    typeof d.similarity_stats === "object"
  );
}

/**
 * Validate link document structure
 */
export function isValidLinkDoc(doc: unknown): doc is LinkDoc {
  if (typeof doc !== "object" || doc === null) return false;
  const d = doc as Record<string, unknown>;

  return (
    typeof d.link_id === "string" &&
    typeof d.user_id === "string" &&
    typeof d.source_memory_id === "string" &&
    typeof d.target_cluster_id === "string" &&
    typeof d.similarity === "number"
  );
}

// === Firestore Collection References (for convenience) ===

export function getClustersCollection() {
  return db.collection(COL_CLUSTERS);
}

export function getLinksCollection() {
  return db.collection(COL_LINKS);
}

export function getMemoriesCollection() {
  return db.collection(COL_MEMORIES);
}

export function getClusterDoc(clusterId: string) {
  return db.collection(COL_CLUSTERS).doc(clusterId);
}

export function getLinkDoc(linkId: string) {
  return db.collection(COL_LINKS).doc(linkId);
}

export function getMemoryDoc(memoryId: string) {
  return db.collection(COL_MEMORIES).doc(memoryId);
}
