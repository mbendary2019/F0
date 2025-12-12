// desktop/src/state/backgroundWatcherConfig.ts
// Phase 127.1: Background Watcher Configuration

/**
 * Background Watcher watches for:
 * - Is there a project open?
 * - When was the last scan?
 * - Is there a scan/fix running?
 *
 * If idle for long enough, it triggers an automatic project scan
 * and updates Dashboard + Recommendations + Alerts.
 */

/** Enable/disable background watcher entirely */
export const BACKGROUND_WATCHER_ENABLED = true;

/** Minimum interval between background scans (in ms) */
export const BACKGROUND_SCAN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/** Check interval - how often to check if scan is needed */
export const BACKGROUND_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

/** Only scan when user is idle (no activity for X ms) */
export const BACKGROUND_SCAN_IDLE_ONLY = true;

/** Consider user idle after this many ms of no activity */
export const BACKGROUND_IDLE_THRESHOLD_MS = 30 * 1000; // 30 seconds

/**
 * Phase 181: Unified scan configuration
 * Both manual and background scans now use the same max files for consistency
 * This ensures Quality/Security indicators remain stable across scan types
 */
export const DEFAULT_SCAN_MAX_FILES = 200;

/** Max files to scan in background (unified with manual scan for consistency) */
export const BACKGROUND_SCAN_MAX_FILES = DEFAULT_SCAN_MAX_FILES;

/**
 * Phase 181: Default ignore patterns for all scans
 * Ensures consistent file filtering across manual and background scans
 */
export const DEFAULT_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/*.min.js',
  '**/*.min.css',
  '**/package-lock.json',
  '**/pnpm-lock.yaml',
  '**/yarn.lock',
  '**/.DS_Store',
  '**/*.log',
  '**/tmp/**',
  '**/temp/**',
  '**/.cache/**',
];
