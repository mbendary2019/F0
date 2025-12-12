// desktop/src/state/previewLogsState.ts
// Phase 117: Preview Logs State Management (Zustand)
// Captures console.log/warn/error from the webview and stores them for display
import { create } from 'zustand';

export type PreviewLogLevel = 'log' | 'info' | 'warn' | 'error';

export type PreviewLogEntry = {
  id: string;
  ts: number;
  level: PreviewLogLevel;
  message: string;
  source?: string;
  lineNumber?: number;
};

interface PreviewLogsState {
  logs: PreviewLogEntry[];
  filterLevel: 'all' | PreviewLogLevel;

  addLog: (entry: Omit<PreviewLogEntry, 'id' | 'ts'>) => void;
  clearLogs: () => void;
  setFilterLevel: (level: 'all' | PreviewLogLevel) => void;
}

const MAX_LOGS = 500;

export const usePreviewLogsState = create<PreviewLogsState>((set) => ({
  logs: [],
  filterLevel: 'all',

  addLog: (entry) =>
    set((state) => {
      const newEntry: PreviewLogEntry = {
        ...entry,
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
      };
      // Keep only last MAX_LOGS entries
      const logs = [...state.logs, newEntry].slice(-MAX_LOGS);
      return { logs };
    }),

  clearLogs: () => set({ logs: [] }),

  setFilterLevel: (level) => set({ filterLevel: level }),
}));

// Helper to get filtered logs
export function getFilteredLogs(logs: PreviewLogEntry[], filterLevel: 'all' | PreviewLogLevel): PreviewLogEntry[] {
  if (filterLevel === 'all') return logs;
  return logs.filter((log) => log.level === filterLevel);
}

// --- Phase 118: Agent-Aware Runtime Debugging Helpers ---

// Noise patterns to filter out from error/warn logs
const NOISE_PATTERNS = [
  'Download the React DevTools for a better development experience',
  'Electron Security Warning',
  '[HMR]',
  '[Fast Refresh]',
];

/**
 * Check if a log message is noise (React DevTools, Electron, HMR, etc.)
 */
function isNoiseLog(message: string): boolean {
  return NOISE_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Get the last N error/warn logs from the preview
 * Filters out noise (React DevTools, Electron warnings, HMR messages)
 */
export function getLastErrorLogs(limit: number = 5): PreviewLogEntry[] {
  const state = usePreviewLogsState.getState();
  return state.logs
    .filter((l) => {
      // Only errors and warnings
      if (l.level !== 'error' && l.level !== 'warn') return false;
      // Skip noise
      if (isNoiseLog(l.message)) return false;
      return true;
    })
    .slice(-limit);
}

/**
 * Get a formatted summary of recent runtime errors for the agent
 * Returns null if no errors/warnings exist
 */
export function getRuntimeErrorSummary(limit: number = 5): string | null {
  const errors = getLastErrorLogs(limit);
  if (errors.length === 0) return null;

  const lines = errors.map((e, idx) => {
    const where =
      e.source && typeof e.lineNumber === 'number'
        ? `${e.source}:${e.lineNumber}`
        : e.source || 'unknown';

    return `${idx + 1}. [${e.level.toUpperCase()}] ${e.message}${
      where !== 'unknown' ? ` (at ${where})` : ''
    }`;
  });

  return [
    `Recent preview runtime issues (${errors.length}):`,
    ...lines,
  ].join('\n');
}
