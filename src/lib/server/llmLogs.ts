// src/lib/server/llmLogs.ts
// Phase 170: LLM Runs Logging to Firestore

import { getFirestoreAdmin } from './firebase';
import type { LLMRunMetricsSimple, LLMTaskType, LLMModelId } from '../../../orchestrator/core/llm/types';

/**
 * LLM Run Log Entry
 */
export interface LLMRunLog {
  id?: string;
  // Request info
  taskType: LLMTaskType;
  modelId: LLMModelId;
  provider: string;
  userId: string;
  projectId?: string;
  // Metrics
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  success: boolean;
  // Routing info
  wasRouted: boolean;
  originalModel?: string;
  fallbackUsed?: boolean;
  // Timestamps
  createdAt: string;
  // Optional
  error?: string;
  cached?: boolean;
}

/**
 * Log an LLM run to Firestore
 */
export async function logLLMRun(
  run: Omit<LLMRunLog, 'id' | 'createdAt'>
): Promise<string> {
  try {
    const db = getFirestoreAdmin();
    const logsRef = db.collection('llmRuns');

    const logEntry: Omit<LLMRunLog, 'id'> = {
      ...run,
      createdAt: new Date().toISOString(),
    };

    const docRef = await logsRef.add(logEntry);

    console.log('[LLM Logs] Run logged:', {
      id: docRef.id,
      model: run.modelId,
      taskType: run.taskType,
      success: run.success,
    });

    return docRef.id;
  } catch (err) {
    console.error('[LLM Logs] Failed to log run:', err);
    throw err;
  }
}

/**
 * Get LLM runs for a user
 */
export async function getUserLLMRuns(
  userId: string,
  limit: number = 50
): Promise<LLMRunLog[]> {
  const db = getFirestoreAdmin();

  const snapshot = await db
    .collection('llmRuns')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as LLMRunLog[];
}

/**
 * Get LLM runs for a project
 */
export async function getProjectLLMRuns(
  projectId: string,
  limit: number = 50
): Promise<LLMRunLog[]> {
  const db = getFirestoreAdmin();

  const snapshot = await db
    .collection('llmRuns')
    .where('projectId', '==', projectId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as LLMRunLog[];
}

/**
 * Get aggregated stats for a user
 */
export async function getUserLLMStats(userId: string): Promise<{
  totalRuns: number;
  totalCostUSD: number;
  totalTokens: number;
  successRate: number;
  avgLatencyMs: number;
  modelBreakdown: Record<string, number>;
  taskBreakdown: Record<string, number>;
}> {
  const runs = await getUserLLMRuns(userId, 1000);

  if (runs.length === 0) {
    return {
      totalRuns: 0,
      totalCostUSD: 0,
      totalTokens: 0,
      successRate: 0,
      avgLatencyMs: 0,
      modelBreakdown: {},
      taskBreakdown: {},
    };
  }

  const successfulRuns = runs.filter((r) => r.success);
  const totalCost = runs.reduce((sum, r) => sum + (r.estimatedCostUSD || 0), 0);
  const totalTokens = runs.reduce(
    (sum, r) => sum + r.inputTokens + r.outputTokens,
    0
  );
  const avgLatency =
    runs.reduce((sum, r) => sum + r.latencyMs, 0) / runs.length;

  const modelBreakdown: Record<string, number> = {};
  const taskBreakdown: Record<string, number> = {};

  for (const run of runs) {
    modelBreakdown[run.modelId] = (modelBreakdown[run.modelId] || 0) + 1;
    taskBreakdown[run.taskType] = (taskBreakdown[run.taskType] || 0) + 1;
  }

  return {
    totalRuns: runs.length,
    totalCostUSD: totalCost,
    totalTokens,
    successRate: successfulRuns.length / runs.length,
    avgLatencyMs: avgLatency,
    modelBreakdown,
    taskBreakdown,
  };
}

/**
 * Get daily cost for a user (for budget tracking)
 */
export async function getUserDailyCost(userId: string): Promise<number> {
  const db = getFirestoreAdmin();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const snapshot = await db
    .collection('llmRuns')
    .where('userId', '==', userId)
    .where('createdAt', '>=', today.toISOString())
    .get();

  return snapshot.docs.reduce((sum, doc) => {
    const data = doc.data();
    return sum + (data.estimatedCostUSD || 0);
  }, 0);
}

export default {
  logLLMRun,
  getUserLLMRuns,
  getProjectLLMRuns,
  getUserLLMStats,
  getUserDailyCost,
};
