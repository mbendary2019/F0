// desktop/src/lib/quality/index.ts
// Phase 132: Quality Monitor Library
// Phase 135.2: Added Policy Engine exports
// Phase 135.3: Added Policy Actions exports
// Phase 135.4: Added Quality History exports
// Phase 135.5: Added Quality Coach exports

export * from './qualityMonitorTypes';
export { useQualityWatchdog } from './useQualityWatchdog';
// Phase 135.2: Policy Engine
export * from './policyEngine';
// Phase 135.3: Policy Actions
export * from './policyActions';
// Phase 135.4: Quality History
export * from './qualityHistoryTypes';
// Phase 135.5: Quality Coach
export * from './qualityCoach';
// Phase 135.5: Auto-Improve Pipeline
export * from './autoImprovePipeline';
