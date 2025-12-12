// src/state/qualityHistoryContext.tsx
// =============================================================================
// Phase 149 – Desktop Quality & Deploy Gate v1 (LOCKED)
// =============================================================================
// NOTE: This file is part of the locked Quality pipeline.
// Any major behavioral changes should be done in a new Phase (>= 150).
// =============================================================================
// Phase 135.4: Quality History Context
// Phase 149.8: Added [149.7][QUALITY] logging for wiring validation
// Tracks project quality snapshots over time with localStorage persistence

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  QualitySnapshot,
  QualityHistoryContextValue,
} from '../lib/quality/qualityHistoryTypes';
import { calculateTrend } from '../lib/quality/qualityHistoryTypes';

const STORAGE_KEY_PREFIX = 'f0:qualityHistory:';
const MAX_SNAPSHOTS = 50;

const QualityHistoryContext =
  createContext<QualityHistoryContextValue | undefined>(undefined);

interface QualityHistoryProviderProps {
  /** Optional project ID for project-specific history */
  projectId?: string;
  children: React.ReactNode;
}

/**
 * Get localStorage key for a project
 */
function getStorageKey(projectId?: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId ?? 'default'}`;
}

/**
 * Load snapshots from localStorage
 */
function loadSnapshots(projectId?: string): QualitySnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QualitySnapshot[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.warn('[QualityHistory] Failed to parse snapshots from localStorage', e);
    return [];
  }
}

/**
 * Save snapshots to localStorage
 */
function saveSnapshots(projectId: string | undefined, snapshots: QualitySnapshot[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getStorageKey(projectId),
      JSON.stringify(snapshots)
    );
  } catch (e) {
    console.warn('[QualityHistory] Failed to save snapshots to localStorage', e);
  }
}

/**
 * Check if two snapshots are similar (to avoid duplicate entries)
 */
function areSimilar(a: QualitySnapshot, b: Omit<QualitySnapshot, 'id' | 'createdAt'>): boolean {
  return (
    a.health === b.health &&
    a.totalIssues === b.totalIssues &&
    a.securityAlerts === b.securityAlerts &&
    a.policyStatus === b.policyStatus
  );
}

/**
 * Quality History Provider
 * Manages quality snapshots with localStorage persistence
 */
export const QualityHistoryProvider: React.FC<QualityHistoryProviderProps> = ({
  projectId,
  children,
}) => {
  const [snapshots, setSnapshots] = useState<QualitySnapshot[]>([]);

  // Load snapshots on mount and when projectId changes
  useEffect(() => {
    const initial = loadSnapshots(projectId);
    setSnapshots(initial);
  }, [projectId]);

  // Add a new snapshot
  const addSnapshot = useCallback(
    (snapshotInput: Omit<QualitySnapshot, 'id' | 'createdAt'>) => {
      setSnapshots((prev) => {
        // Check if last snapshot is similar (avoid duplicates within 1 minute)
        const lastSnapshot = prev[prev.length - 1];
        if (lastSnapshot) {
          const lastTime = new Date(lastSnapshot.createdAt).getTime();
          const now = Date.now();
          const diffMin = (now - lastTime) / 60000;

          // If less than 1 minute and similar values, skip
          if (diffMin < 1 && areSimilar(lastSnapshot, snapshotInput)) {
            console.log('[QualityHistory] Skipping duplicate snapshot');
            return prev;
          }
        }

        const now = new Date().toISOString();
        const id = `qh_${Date.now()}`;

        const newSnapshot: QualitySnapshot = {
          id,
          createdAt: now,
          ...snapshotInput,
        };

        // Add to array
        const merged = [...prev, newSnapshot];

        // Limit to last MAX_SNAPSHOTS
        const limited =
          merged.length > MAX_SNAPSHOTS
            ? merged.slice(merged.length - MAX_SNAPSHOTS)
            : merged;

        // Persist to localStorage
        saveSnapshots(projectId, limited);

        console.log('[QualityHistory] Added snapshot:', {
          health: newSnapshot.health,
          issues: newSnapshot.totalIssues,
          status: newSnapshot.policyStatus,
        });

        // Phase 149.8: Enhanced logging for wiring validation
        console.log('[149.7][QUALITY] Applying quality snapshot', {
          source: newSnapshot.source,
          filesScanned: newSnapshot.filesScanned,
          totalIssues: newSnapshot.totalIssues,
          score: newSnapshot.health,
          status: newSnapshot.policyStatus,
          recordedAt: newSnapshot.createdAt,
        });

        return limited;
      });
    },
    [projectId]
  );

  // Clear history for a project
  const clearHistoryForProject = useCallback(
    (pid?: string) => {
      const key = getStorageKey(pid ?? projectId);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      setSnapshots([]);
      console.log('[QualityHistory] Cleared history for:', pid ?? projectId ?? 'default');
    },
    [projectId]
  );

  // Get latest snapshot
  const latestSnapshot = useMemo(() => {
    if (snapshots.length === 0) return null;
    return snapshots[snapshots.length - 1];
  }, [snapshots]);

  // Calculate trend
  const trend = useMemo(() => calculateTrend(snapshots), [snapshots]);

  // Context value
  const value: QualityHistoryContextValue = useMemo(
    () => ({
      snapshots,
      addSnapshot,
      clearHistoryForProject,
      latestSnapshot,
      trend,
    }),
    [snapshots, addSnapshot, clearHistoryForProject, latestSnapshot, trend]
  );

  return (
    <QualityHistoryContext.Provider value={value}>
      {children}
    </QualityHistoryContext.Provider>
  );
};

/**
 * Hook to access quality history
 */
export function useQualityHistory(): QualityHistoryContextValue {
  const ctx = useContext(QualityHistoryContext);
  if (!ctx) {
    throw new Error(
      'useQualityHistory must be used within a QualityHistoryProvider'
    );
  }
  return ctx;
}

export default QualityHistoryProvider;
