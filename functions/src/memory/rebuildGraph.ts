// =============================================================
// Phase 59 — Cognitive Memory Mesh - Graph Rebuild Function
// Cloud Function v2 - Scheduled weekly rebuild
// =============================================================

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Use Firebase Admin directly
const db = admin.firestore();

// Scheduled weekly rebuild for all active workspaces
export const weeklyRebuildMemoryGraphs = onSchedule(
  {
    schedule: 'every sunday 03:00',
    timeZone: 'UTC',
    memory: '1GiB',
    timeoutSeconds: 540, // 9 minutes
  },
  async (event) => {
    logger.info('[weeklyRebuildMemoryGraphs] Starting weekly graph rebuild');
    const startTime = Date.now();

    try {
      // Fetch active workspaces (those with recent activity)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const activeWorkspaces = await db
        .collection('ops_memory_snippets')
        .where('last_used_at', '>', thirtyDaysAgo.toISOString())
        .select('workspaceId')
        .get();

      const workspaceIds = new Set<string>();
      for (const doc of activeWorkspaces.docs) {
        const wsId = doc.get('workspaceId') as string;
        if (wsId) workspaceIds.add(wsId);
      }

      logger.info(`[weeklyRebuildMemoryGraphs] Found ${workspaceIds.size} active workspaces`);

      let successCount = 0;
      let errorCount = 0;

      for (const workspaceId of Array.from(workspaceIds)) {
        try {
          logger.info(`[weeklyRebuildMemoryGraphs] Rebuilding graph for workspace: ${workspaceId}`);
          const { rebuildGraphForWorkspace: rebuild } = await import('./memoryGraphStub');
          const result = await rebuild(workspaceId, {
            semantic: { threshold: 0.85, maxNeighbors: 12 },
            temporal: { halfLifeDays: 21 },
            feedback: { minWeight: 0.2 },
            ttlDays: 90,
          });

          // Log stats to Firestore for monitoring
          await db
            .collection('ops_memory_graph_jobs')
            .add({
              workspaceId,
              type: 'weekly_rebuild',
              status: 'success',
              result,
              timestamp: Timestamp.now(),
              durationMs: result.durationMs,
            });

          successCount++;
          logger.info(`[weeklyRebuildMemoryGraphs] Completed workspace ${workspaceId}:`, result);
        } catch (error: any) {
          errorCount++;
          logger.error(
            `[weeklyRebuildMemoryGraphs] Error rebuilding workspace ${workspaceId}:`,
            error
          );

          await db.collection('ops_memory_graph_jobs').add({
            workspaceId,
            type: 'weekly_rebuild',
            status: 'error',
            error: error.message,
            timestamp: Timestamp.now(),
          });
        }
      }

      const totalDuration = Date.now() - startTime;
      logger.info('[weeklyRebuildMemoryGraphs] Completed weekly rebuild', {
        totalWorkspaces: workspaceIds.size,
        successCount,
        errorCount,
        durationMs: totalDuration,
      });
    } catch (error: any) {
      logger.error('[weeklyRebuildMemoryGraphs] Fatal error:', error);
      throw error;
    }
  }
);

// Manual rebuild for a specific workspace (admin only)
export const rebuildMemoryGraph = onCall(
  {
    timeoutSeconds: 300,
    memory: '1GiB',
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const isAdmin = (request.auth.token as any)?.admin === true;
    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Admin access required');
    }

    const data = request.data as {
      workspaceId: string;
      options?: {
        semantic?: { threshold?: number; maxNeighbors?: number };
        temporal?: { halfLifeDays?: number };
        feedback?: { minWeight?: number };
        ttlDays?: number;
      };
    };

    const { workspaceId, options } = data;

    if (!workspaceId) {
      throw new HttpsError('invalid-argument', 'workspaceId is required');
    }

    logger.info(`[rebuildMemoryGraph] Manual rebuild requested for workspace: ${workspaceId}`);

    try {
      const { rebuildGraphForWorkspace: rebuild } = await import('./memoryGraphStub');
      const result = await rebuild(workspaceId, options || {});

      // Log to Firestore
      await db.collection('ops_memory_graph_jobs').add({
        workspaceId,
        type: 'manual_rebuild',
        status: 'success',
        result,
        timestamp: Timestamp.now(),
        durationMs: result.durationMs,
        requestedBy: request.auth.uid,
      });

      logger.info(`[rebuildMemoryGraph] Completed rebuild for workspace ${workspaceId}:`, result);

      return {
        success: true,
        workspaceId,
        result,
      };
    } catch (error: any) {
      logger.error(`[rebuildMemoryGraph] Error rebuilding workspace ${workspaceId}:`, error);

      await db.collection('ops_memory_graph_jobs').add({
        workspaceId,
        type: 'manual_rebuild',
        status: 'error',
        error: error.message,
        timestamp: Timestamp.now(),
        requestedBy: request.auth.uid,
      });

      throw new HttpsError('internal', `Failed to rebuild graph: ${error.message}`);
    }
  }
);

// Get graph stats for a workspace
export const getMemoryGraphStats = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const data = request.data as { workspaceId: string };
    const { workspaceId } = data;

    if (!workspaceId) {
      throw new HttpsError('invalid-argument', 'workspaceId is required');
    }

    logger.info(`[getMemoryGraphStats] Fetching stats for workspace: ${workspaceId}`);

    try {
      const { getGraphStats } = await import('./memoryGraphStub');
      const stats = await getGraphStats(workspaceId);

      return {
        success: true,
        stats,
      };
    } catch (error: any) {
      logger.error(`[getMemoryGraphStats] Error fetching stats for ${workspaceId}:`, error);
      throw new HttpsError('internal', `Failed to fetch stats: ${error.message}`);
    }
  }
);

// Delete graph for a workspace (admin only)
export const deleteMemoryGraph = onCall(
  {
    timeoutSeconds: 180,
    memory: '512MiB',
  },
  async (request) => {
    // Auth check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const isAdmin = (request.auth.token as any)?.admin === true;
    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Admin access required');
    }

    const data = request.data as { workspaceId: string };
    const { workspaceId } = data;

    if (!workspaceId) {
      throw new HttpsError('invalid-argument', 'workspaceId is required');
    }

    logger.info(`[deleteMemoryGraph] Deleting graph for workspace: ${workspaceId}`);

    try {
      const { deleteGraphForWorkspace } = await import('./memoryGraphStub');
      const result = await deleteGraphForWorkspace(workspaceId);

      logger.info(`[deleteMemoryGraph] Deleted ${result.deleted} edges for workspace ${workspaceId}`);

      return {
        success: true,
        deleted: result.deleted,
        workspaceId,
      };
    } catch (error: any) {
      logger.error(`[deleteMemoryGraph] Error deleting graph for ${workspaceId}:`, error);
      throw new HttpsError('internal', `Failed to delete graph: ${error.message}`);
    }
  }
);
