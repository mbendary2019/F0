// src/hooks/useProjectRuntime.ts
// =============================================================================
// Phase 150.5.2 – Unified Project Runtime Hook
// Phase 150.6.1 – Performance: Error handling + onError callback
// Single hook that fetches all runtime data from Firestore
// =============================================================================
// 🔒 LOCK (Phase 150.7): This hook is the SINGLE entry point for Firestore runtime data.
//    Use useProjectRuntime() ONCE per page, then pass data to child hooks/components.
//    DO NOT create multiple instances - use the "WithRuntime" variants instead.
// =============================================================================
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  limit,
  query,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import {
  type ProjectRuntimeState,
  type QualitySnapshotDoc,
  type AceRunDoc,
  type SecurityStatsDoc,
  type TestsStatsDoc,
  type RuntimeError,
  type RuntimeErrorType,
  initialRuntimeState,
  timestampToIso,
} from '@/shared/runtime/projectRuntime';

// Re-export types for consumers
export type { ProjectRuntimeState, RuntimeError, RuntimeErrorType } from '@/shared/runtime/projectRuntime';

/**
 * Options for useProjectRuntime
 */
export interface UseProjectRuntimeOptions {
  /**
   * Callback when a Firestore error occurs
   * Use this to show toast notifications
   */
  onError?: (error: RuntimeError) => void;
}

/**
 * Unified hook to fetch all project runtime data from Firestore
 * Provides real-time updates for quality, ACE runs, security, and tests
 *
 * Phase 150.6.1: Now supports onError callback for toast notifications
 */
export function useProjectRuntime(
  projectId: string | null,
  options?: UseProjectRuntimeOptions
): ProjectRuntimeState {
  const [state, setState] = useState<ProjectRuntimeState>(initialRuntimeState);
  const onErrorRef = useRef(options?.onError);

  // Update ref when callback changes
  useEffect(() => {
    onErrorRef.current = options?.onError;
  }, [options?.onError]);

  // Update state helper
  const updateState = useCallback((partial: Partial<ProjectRuntimeState>) => {
    setState((prev) => ({ ...prev, ...partial, loading: false }));
  }, []);

  // Add error helper
  const addError = useCallback((type: RuntimeErrorType, message: string) => {
    const error: RuntimeError = {
      type,
      message,
      timestamp: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      errors: [...prev.errors.filter((e) => e.type !== type), error],
    }));

    // Call onError callback if provided
    if (onErrorRef.current) {
      onErrorRef.current(error);
    }
  }, []);

  // Clear specific error
  const clearError = useCallback((type: RuntimeErrorType) => {
    setState((prev) => ({
      ...prev,
      errors: prev.errors.filter((e) => e.type !== type),
    }));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setState({ ...initialRuntimeState, loading: false });
      return;
    }

    console.log('[150.6][useProjectRuntime] Starting listeners...', { projectId });

    const unsubscribers: Array<() => void> = [];

    // =========================================================================
    // Quality Snapshots (latest)
    // =========================================================================
    try {
      const qualityRef = collection(db, 'projects', projectId, 'qualitySnapshots');
      const qualityQuery = query(qualityRef, orderBy('recordedAt', 'desc'), limit(1));

      unsubscribers.push(
        onSnapshot(
          qualityQuery,
          (snap) => {
            clearError('quality_listener');
            const docSnap = snap.docs[0];
            if (docSnap) {
              const data = docSnap.data();
              const latest: QualitySnapshotDoc = {
                source: data.source || 'scan',
                filesScanned: data.filesScanned || 0,
                totalIssues: data.totalIssues || 0,
                score: data.score || 0,
                status: data.status || 'needs_work',
                recordedAt: timestampToIso(data.recordedAt) || new Date().toISOString(),
              };
              console.log('[150.6][useProjectRuntime] Quality snapshot loaded', {
                projectId,
                score: latest.score,
                status: latest.status,
              });
              updateState({ latestQuality: latest });
            } else {
              console.log('[150.6][useProjectRuntime] No quality snapshots found', { projectId });
              updateState({ latestQuality: null });
            }
          },
          (error) => {
            console.error('[150.6][useProjectRuntime] Quality listener error:', error);
            addError('quality_listener', error.message || 'Failed to load quality data');
          }
        )
      );
    } catch (e) {
      console.error('[150.6][useProjectRuntime] Failed to setup quality listener:', e);
      addError('quality_listener', (e as Error).message || 'Failed to setup quality listener');
    }

    // =========================================================================
    // ACE Runs (latest)
    // =========================================================================
    try {
      const aceRunsRef = collection(db, 'projects', projectId, 'aceRuns');
      const aceRunsQuery = query(aceRunsRef, orderBy('finishedAt', 'desc'), limit(1));

      unsubscribers.push(
        onSnapshot(
          aceRunsQuery,
          (snap) => {
            clearError('ace_listener');
            const docSnap = snap.docs[0];
            if (docSnap) {
              const data = docSnap.data();
              const run: AceRunDoc = {
                id: docSnap.id,
                startedAt: timestampToIso(data.startedAt) || new Date().toISOString(),
                finishedAt: timestampToIso(data.finishedAt) || new Date().toISOString(),
                filesProcessed: data.filesProcessed || 0,
                totalApplied: data.totalApplied || 0,
                totalErrors: data.totalErrors || 0,
                targetedIssues: data.targetedIssues,
                totalSkipped: data.totalSkipped,
                issuesBefore: data.issuesBefore,
                issuesAfter: data.issuesAfter,
                projectRoot: data.projectRoot,
                source: data.source || 'manual',
                jobId: data.jobId,
              };
              console.log('[150.6][useProjectRuntime] ACE run loaded', {
                projectId,
                runId: run.id,
                totalApplied: run.totalApplied,
              });
              updateState({ latestAceRun: run });
            } else {
              console.log('[150.6][useProjectRuntime] No ACE runs found', { projectId });
              updateState({ latestAceRun: null });
            }
          },
          (error) => {
            console.error('[150.6][useProjectRuntime] ACE runs listener error:', error);
            addError('ace_listener', error.message || 'Failed to load ACE data');
          }
        )
      );
    } catch (e) {
      console.error('[150.6][useProjectRuntime] Failed to setup ACE runs listener:', e);
      addError('ace_listener', (e as Error).message || 'Failed to setup ACE listener');
    }

    // =========================================================================
    // Security Stats
    // =========================================================================
    try {
      const securityRef = doc(db, 'projects', projectId, 'security', 'latest');

      unsubscribers.push(
        onSnapshot(
          securityRef,
          (snap) => {
            clearError('security_listener');
            if (snap.exists()) {
              const data = snap.data();
              const stats: SecurityStatsDoc = {
                totalAlerts: data.totalAlerts ?? 0,
                hasBlocking: !!data.hasBlocking,
                bySeverity: data.bySeverity,
                updatedAt: timestampToIso(data.updatedAt) || new Date().toISOString(),
              };
              console.log('[150.6][useProjectRuntime] Security stats loaded', {
                projectId,
                totalAlerts: stats.totalAlerts,
                hasBlocking: stats.hasBlocking,
              });
              updateState({ securityStats: stats });
            } else {
              console.log('[150.6][useProjectRuntime] No security stats found', { projectId });
              // Default: no alerts
              updateState({
                securityStats: {
                  totalAlerts: 0,
                  hasBlocking: false,
                  updatedAt: new Date().toISOString(),
                },
              });
            }
          },
          (error) => {
            console.error('[150.6][useProjectRuntime] Security listener error:', error);
            addError('security_listener', error.message || 'Failed to load security data');
          }
        )
      );
    } catch (e) {
      console.error('[150.6][useProjectRuntime] Failed to setup security listener:', e);
      addError('security_listener', (e as Error).message || 'Failed to setup security listener');
    }

    // =========================================================================
    // Tests Stats
    // =========================================================================
    try {
      const testsRef = doc(db, 'projects', projectId, 'tests', 'latest');

      unsubscribers.push(
        onSnapshot(
          testsRef,
          (snap) => {
            clearError('tests_listener');
            if (snap.exists()) {
              const data = snap.data();
              const stats: TestsStatsDoc = {
                status: data.status ?? 'not_run',
                coverage: data.coverage ?? null,
                lastRunAt: timestampToIso(data.lastRunAt),
                suites: data.suites,
                updatedAt: timestampToIso(data.updatedAt) || new Date().toISOString(),
              };
              console.log('[150.6][useProjectRuntime] Tests stats loaded', {
                projectId,
                status: stats.status,
                coverage: stats.coverage,
              });
              updateState({ testsStats: stats });
            } else {
              console.log('[150.6][useProjectRuntime] No tests stats found', { projectId });
              // Default: not run
              updateState({
                testsStats: {
                  status: 'not_run',
                  coverage: null,
                  lastRunAt: null,
                  updatedAt: new Date().toISOString(),
                },
              });
            }
          },
          (error) => {
            console.error('[150.6][useProjectRuntime] Tests listener error:', error);
            addError('tests_listener', error.message || 'Failed to load tests data');
          }
        )
      );
    } catch (e) {
      console.error('[150.6][useProjectRuntime] Failed to setup tests listener:', e);
      addError('tests_listener', (e as Error).message || 'Failed to setup tests listener');
    }

    // Cleanup
    return () => {
      console.log('[150.6][useProjectRuntime] Cleaning up listeners...', { projectId });
      unsubscribers.forEach((u) => u());
    };
  }, [projectId, updateState, addError, clearError]);

  return state;
}

export default useProjectRuntime;
