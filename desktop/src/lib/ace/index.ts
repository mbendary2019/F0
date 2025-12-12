// desktop/src/lib/ace/index.ts
// Phase 128: ACE (Auto Code Evolution) Library - Public exports
// Phase 150.3.9: Added ACE Job Watcher for Web-Desktop bridge

// Types
export * from './aceTypes';

// Debt Map
export {
  buildAceFileScores,
  calculateOverallDebtScore,
  getWorstFiles,
  type BuildDebtMapInput,
} from './aceDebtMap';

// Suggestions Engine
export {
  buildAceSuggestions,
  type BuildSuggestionsInput,
} from './aceSuggestions';

// Evolution Plan Generator
export {
  buildAcePlanFromSuggestions,
  getSuggestionsForPhase,
  markPhaseInProgress,
  markPhaseCompleted,
  getNextPhase,
  calculateTotalEffort,
} from './acePlanner';

// Impact Analysis
export {
  buildDependencyGraph,
  getAffectedFiles,
  analyzeImpact,
  analyzeAllSuggestionImpacts,
  sortSuggestionsByImpact,
  getHighRiskFiles,
  type DependencyEdge,
  type DependencyNode,
  type ImpactAnalysis,
} from './aceImpact';

// Phase 150.3.9: ACE Job Watcher (Web-Desktop Bridge)
export {
  AceJobWatcher,
  createAceJobWatcher,
  defaultAceJobExecutor,
  type AceJobDocument,
  type AceJobExecutionResult,
  type AceJobExecutorFn,
  type AceJobStatus,
  type AceJobWatcherOptions,
  type AceJobWatcherState,
} from './aceJobWatcher';
