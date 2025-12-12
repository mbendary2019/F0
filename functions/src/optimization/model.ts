// functions/src/optimization/model.ts
// Phase 138.0.2: Firestore Model Helper for OptimizationRun
// Provides CRUD operations for optimization runs

import * as admin from 'firebase-admin';
import { OptimizationRun } from './types';

const db = admin.firestore();

/**
 * Get reference to optimizationRuns collection for a project
 */
export const optimizationRunsCollection = (projectId: string) =>
  db.collection('projects').doc(projectId).collection('optimizationRuns');

/**
 * Create a new optimization run
 */
export const createOptimizationRun = async (
  projectId: string,
  run: Omit<OptimizationRun, 'id'>
): Promise<OptimizationRun> => {
  const colRef = optimizationRunsCollection(projectId);
  const docRef = colRef.doc();

  const fullRun: OptimizationRun = {
    ...run,
    id: docRef.id,
  };

  await docRef.set(fullRun);
  return fullRun;
};

/**
 * Get an optimization run by ID
 */
export const getOptimizationRun = async (
  projectId: string,
  runId: string
): Promise<OptimizationRun | null> => {
  const docRef = optimizationRunsCollection(projectId).doc(runId);
  const snap = await docRef.get();

  if (!snap.exists) return null;
  return snap.data() as OptimizationRun;
};

/**
 * Update an optimization run
 */
export const updateOptimizationRun = async (
  projectId: string,
  runId: string,
  updates: Partial<OptimizationRun>
): Promise<void> => {
  const docRef = optimizationRunsCollection(projectId).doc(runId);
  await docRef.update({
    ...updates,
    updatedAt: new Date().toISOString(),
  });
};

/**
 * Get recent optimization runs for a project
 */
export const getRecentOptimizationRuns = async (
  projectId: string,
  limit: number = 10
): Promise<OptimizationRun[]> => {
  const snap = await optimizationRunsCollection(projectId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map((doc) => doc.data() as OptimizationRun);
};
