export type Limits = { tokens: number; latencyMs: number };

export type ContextHandle = {
  userId: string;
  sessionId: string;
  goal: string;
  hints?: string[];
  clusterIds?: string[];
  limits: Limits;
};

export type Citation = { docId: string; score: number; snippet?: string; url?: string; lines?: string };
