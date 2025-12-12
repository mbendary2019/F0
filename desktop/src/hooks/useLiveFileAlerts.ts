// desktop/src/hooks/useLiveFileAlerts.ts
// Phase 127.2: Live File Alerts Hook - detects patterns while typing

import { useEffect, useState, useMemo } from 'react';
import {
  LIVE_PATTERNS,
  type LivePattern,
  type LivePatternId,
  type LivePatternSeverity,
} from '../lib/analysis/livePatterns';

/**
 * A single live alert detected in the file
 */
export interface LiveFileAlert {
  patternId: LivePatternId;
  severity: LivePatternSeverity;
  message: string;
  messageAr: string;
  icon: string;
  count: number;
}

/**
 * Summary of all live alerts in the file
 */
export interface LiveAlertsSummary {
  alerts: LiveFileAlert[];
  totalCount: number;
  hasCritical: boolean;
  hasWarning: boolean;
  hasInfo: boolean;
}

/**
 * File extensions that support live alerts
 */
const SUPPORTED_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.vue', '.svelte',
];

/**
 * Check if file is supported for live alerts
 */
function isFileSupported(filePath: string | null): boolean {
  if (!filePath) return false;
  return SUPPORTED_EXTENSIONS.some(ext => filePath.endsWith(ext));
}

/**
 * Hook to detect live patterns in file content
 *
 * @param content - Current file content
 * @param filePath - Current file path
 * @param debounceMs - Debounce delay (default 300ms)
 */
export function useLiveFileAlerts(
  content: string | null,
  filePath: string | null,
  debounceMs: number = 300
): LiveAlertsSummary {
  const [alerts, setAlerts] = useState<LiveFileAlert[]>([]);

  // Check if file type is supported
  const isSupported = useMemo(() => isFileSupported(filePath), [filePath]);

  useEffect(() => {
    // Clear alerts if no content or unsupported file
    if (!content || !isSupported) {
      setAlerts([]);
      return;
    }

    // Debounce the pattern matching
    const handle = setTimeout(() => {
      const newAlerts: LiveFileAlert[] = [];

      for (const pattern of LIVE_PATTERNS) {
        // Reset regex lastIndex for global patterns
        pattern.regex.lastIndex = 0;

        let count = 0;
        let match;

        // Count matches (limit to 100 for performance)
        while ((match = pattern.regex.exec(content)) !== null) {
          count++;
          if (count > 100) break;
        }

        if (count > 0) {
          newAlerts.push({
            patternId: pattern.id,
            severity: pattern.severity,
            message: pattern.message,
            messageAr: pattern.messageAr,
            icon: pattern.icon,
            count,
          });
        }
      }

      // Sort by severity (critical first)
      newAlerts.sort((a, b) => {
        const order: Record<LivePatternSeverity, number> = {
          critical: 0,
          warning: 1,
          info: 2,
        };
        return order[a.severity] - order[b.severity];
      });

      setAlerts(newAlerts);
    }, debounceMs);

    return () => clearTimeout(handle);
  }, [content, isSupported, debounceMs]);

  // Compute summary
  const summary = useMemo<LiveAlertsSummary>(() => {
    const totalCount = alerts.reduce((sum, a) => sum + a.count, 0);
    return {
      alerts,
      totalCount,
      hasCritical: alerts.some(a => a.severity === 'critical'),
      hasWarning: alerts.some(a => a.severity === 'warning'),
      hasInfo: alerts.some(a => a.severity === 'info'),
    };
  }, [alerts]);

  return summary;
}

export default useLiveFileAlerts;
