// F0 Phase 35 - Cross-Device Sync (Main Export)

export * from './types';
export * from './conflict';
export * from './presence';
export * from './storage';

// Re-export commonly used functions
export {
  resolveLWW,
  resolveFieldLWW,
  mergeArrays,
  mergeQueues,
  detectConflict,
  threeWayMerge,
} from './conflict';

export {
  sendHeartbeat,
  registerFCMToken,
  HeartbeatManager,
  getDeviceCapabilities,
  generateDeviceId,
} from './presence';

export {
  LocalQueue,
  IndexedDBQueue,
  createQueue,
} from './storage';


