// desktop/src/state/healthAlertsContext.tsx
// Phase 127.2: Health Alerts Context (state + lifecycle)

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  buildHealthAlerts,
  type HealthAlert,
} from '../lib/analysis/codeHealthAlerts';
import { useCodeHealth } from './codeHealthContext';

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

type AlertsState = {
  /** All stored alerts (max 20) */
  alerts: HealthAlert[];
  /** Count of unread alerts */
  unreadCount: number;
  /** Latest critical alert for toast display */
  latestCriticalAlert: HealthAlert | null;
};

type AlertsContextValue = AlertsState & {
  /** Generate alerts after a snapshot or run is recorded */
  generateAlertsAfterSnapshot: () => void;
  /** Mark all alerts as read */
  markAllRead: () => void;
  /** Dismiss a specific alert by ID */
  dismissAlert: (id: string) => void;
  /** Clear all alerts */
  clearAll: () => void;
  /** Clear the latest critical alert (dismiss toast) */
  clearLatestCritical: () => void;
};

const HealthAlertsContext = createContext<AlertsContextValue | null>(null);

// ---------------------------------------------------------
// Provider
// ---------------------------------------------------------

interface HealthAlertsProviderProps {
  children: React.ReactNode;
}

export const HealthAlertsProvider: React.FC<HealthAlertsProviderProps> = ({
  children,
}) => {
  const { snapshots, getRecentRuns } = useCodeHealth();
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestCriticalAlert, setLatestCriticalAlert] = useState<HealthAlert | null>(null);

  // Get latest and previous snapshots
  const latestSnapshot = snapshots.length > 0 ? snapshots[0] : null;
  const previousSnapshot = snapshots.length > 1 ? snapshots[1] : null;

  // Get latest run
  const recentRuns = getRecentRuns(1);
  const lastRun = recentRuns.length > 0 ? recentRuns[0] : null;

  // Generate alerts after snapshot/run
  const generateAlertsAfterSnapshot = useCallback(() => {
    const newAlerts = buildHealthAlerts({
      latestSnapshot,
      previousSnapshot,
      lastRun,
    });

    if (newAlerts.length === 0) {
      console.log('[HealthAlerts] No new alerts generated');
      return;
    }

    // Filter out duplicates - don't add alerts that already exist by type
    setAlerts((prev) => {
      const existingTypes = new Set(prev.map((a) => a.type));
      const trulyNewAlerts = newAlerts.filter((a) => !existingTypes.has(a.type));

      if (trulyNewAlerts.length === 0) {
        console.log('[HealthAlerts] All alerts already exist, skipping duplicates');
        return prev;
      }

      // Find critical alerts for toast (only from truly new ones)
      const criticalAlerts = trulyNewAlerts.filter((a) => a.level === 'critical');
      if (criticalAlerts.length > 0) {
        setLatestCriticalAlert(criticalAlerts[0]);
      }

      // Increment unread count for truly new alerts
      setUnreadCount((count) => count + trulyNewAlerts.length);

      console.log('[HealthAlerts] Generated', trulyNewAlerts.length, 'new alerts:', trulyNewAlerts.map((a) => a.type));

      // Merge with existing alerts (max 20)
      const merged = [...trulyNewAlerts, ...prev].slice(0, 20);
      return merged;
    });
  }, [latestSnapshot, previousSnapshot, lastRun]);

  // Mark all alerts as read
  const markAllRead = useCallback(() => {
    setUnreadCount(0);
    console.log('[HealthAlerts] Marked all as read');
  }, []);

  // Dismiss a specific alert
  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    console.log('[HealthAlerts] Dismissed alert:', id);
  }, []);

  // Clear all alerts
  const clearAll = useCallback(() => {
    setAlerts([]);
    setUnreadCount(0);
    setLatestCriticalAlert(null);
    console.log('[HealthAlerts] Cleared all alerts');
  }, []);

  // Clear latest critical (dismiss toast)
  const clearLatestCritical = useCallback(() => {
    setLatestCriticalAlert(null);
  }, []);

  // Memoized context value
  const value = useMemo<AlertsContextValue>(
    () => ({
      alerts,
      unreadCount,
      latestCriticalAlert,
      generateAlertsAfterSnapshot,
      markAllRead,
      dismissAlert,
      clearAll,
      clearLatestCritical,
    }),
    [
      alerts,
      unreadCount,
      latestCriticalAlert,
      generateAlertsAfterSnapshot,
      markAllRead,
      dismissAlert,
      clearAll,
      clearLatestCritical,
    ]
  );

  return (
    <HealthAlertsContext.Provider value={value}>
      {children}
    </HealthAlertsContext.Provider>
  );
};

// ---------------------------------------------------------
// Hook
// ---------------------------------------------------------

export function useHealthAlerts(): AlertsContextValue {
  const ctx = useContext(HealthAlertsContext);
  if (!ctx) {
    throw new Error('useHealthAlerts must be used within HealthAlertsProvider');
  }
  return ctx;
}

export default HealthAlertsProvider;
