// desktop/src/lib/runtime/index.ts
// =============================================================================
// Phase 150.5.4 – Desktop Runtime Sync - Public Exports
// All functions for syncing Desktop state to Firestore
// =============================================================================

// Quality Sync
export {
  recordQualitySnapshotToFirestore,
  updateLatestQualitySnapshot,
  type QualitySnapshotData,
  type RecordQualitySnapshotOptions,
} from './qualitySync';

// ACE Run Sync
export {
  recordAceRunToFirestore,
  markAceJobFailed,
  type AceRunResult,
  type RecordAceRunOptions,
} from './aceRunSync';

// Security Sync
export {
  updateSecurityStatsToFirestore,
  clearSecurityAlerts,
  type SecurityStatsData,
} from './securitySync';

// Tests Sync
export {
  updateTestsStatsToFirestore,
  markTestsRunning,
  recordTestRunResult,
  type TestsStatsData,
} from './testsSync';

// Phase 152.3: File Writes Watcher (Web → Desktop sync)
export { startFileWritesWatcher } from './fileWritesWatcher';
