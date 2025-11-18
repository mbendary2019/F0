// =============================================================
// Phase 59 — Cognitive Memory Mesh - Type Definitions
// Production TypeScript (Firebase Admin + Cached OpenAI Embeddings)
// =============================================================

import type { Timestamp } from 'firebase-admin/firestore';

export type MemoryNodeType = 'snippet' | 'tag' | 'concept';
export type MemoryEdgeType = 'semantic' | 'temporal' | 'feedback';

export interface MemoryNode {
  id: string;                  // same as snippet doc id (or synthetic for tag/concept)
  workspaceId: string;         // isolation key
  type: MemoryNodeType;
  text: string;                // normalized text
  embedding?: number[];        // 1536-dim by default (model-dependent)
  createdAt: string;           // ISO date
  updatedAt: string;           // ISO date
  useCount?: number;           // usage frequency (optional)
  lastUsedAt?: string;         // ISO date
}

export interface MemoryEdge {
  id: string;                  // `${from}_${to}_${relation}`
  workspaceId: string;
  from: string;                // node id
  to: string;                  // node id
  relation: MemoryEdgeType;
  weight: number;              // [0..1]
  meta?: Record<string, any>;  // diagnostics (e.g., similarity, signals)
  createdAt: string;           // ISO
  updatedAt: string;           // ISO
  expire_at?: Timestamp;       // TTL-compatible (optional)
}

export interface RelatedNode {
  nodeId: string;
  score: number;
  reason: 'semantic' | 'temporal' | 'feedback' | 'hybrid';
  text?: string;
}

export interface BuildGraphOptions {
  semantic: {
    threshold: number;         // cosine threshold to keep an edge
    maxNeighbors: number;      // cap per node
  };
  temporal: {
    halfLifeDays: number;      // decay older co-usage edges
  };
  feedback: {
    minWeight: number;         // minimum aggregated feedback to form link
  };
  ttlDays?: number;            // optional TTL for edges
}

// Default production config
export const DEFAULT_GRAPH_OPTS: BuildGraphOptions = {
  semantic: { threshold: 0.85, maxNeighbors: 12 },
  temporal: { halfLifeDays: 21 },
  feedback: { minWeight: 0.2 },
  ttlDays: 90,
};

export interface GraphBuildResult {
  semantic: number;
  temporal: number;
  feedback: number;
  totalNodes?: number;
  totalEdges?: number;
  durationMs?: number;
}

export interface QueryRelatedParams {
  workspaceId: string;
  queryText?: string;
  queryEmbedding?: number[];
  threshold?: number;
  topK?: number;
}

export interface ManualEdgeParams {
  workspaceId: string;
  from: string;
  to: string;
  relation: 'semantic' | 'temporal' | 'feedback';
  weight?: number;
  meta?: Record<string, any>;
}

export interface GraphStats {
  workspaceId: string;
  nodeCount: number;
  edgeCount: number;
  edgesByType: {
    semantic: number;
    temporal: number;
    feedback: number;
  };
  avgDegree: number;
  timestamp: string;
}
