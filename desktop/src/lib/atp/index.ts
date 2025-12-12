// desktop/src/lib/atp/index.ts
// Phase 140.1: Autonomous Test Pipeline - Exports
// Phase 140.2: Added Coverage Delta exports
// Phase 140.3: Added AMTG exports
// Phase 140.4: Added Failing Test Fixer exports
// Main entry point for ATP module

// Types
export * from './testCycleTypes';
export * from './coverageDeltaTypes';
export * from './amtgTypes';
export * from './failingTestTypes';

// Orchestrator
export {
  TestCycleOrchestrator,
  testCycleOrchestrator,
} from './testCycleOrchestrator';

// React Context & Hooks
export {
  TestCycleProvider,
  useTestCycle,
  useTestCyclePhase,
  useTestCycleLogs,
  useTestCycleMetrics,
  useATPTrigger,
} from './TestCycleContext';

// Phase 140.2: Coverage Delta Engine
export {
  computeCoverageDelta,
  formatCoverageDelta,
  getRegressionSeverity,
} from './coverageDeltaEngine';

// Phase 140.2: Coverage Snapshot Bridge
export {
  analysisResultToSnapshot,
  setBaselineSnapshot,
  getBaselineSnapshot,
  clearBaselineSnapshot,
  getCurrentCoverageSnapshot,
  getBaselineCoverageSnapshotForCycle,
  getPostRunCoverageSnapshotForCycle,
  generateMockSnapshot,
  generateMockAfterSnapshot,
} from './coverageSnapshotBridge';

// Phase 140.3: AMTG Bridge (Source-to-Test mapping)
export {
  type AMTGCandidate,
  detectTestFramework,
  sourceToTestPath,
  hasExistingTests,
  untestedFilesToCandidates,
  getCandidatesFromDelta,
  filterCandidatesByPolicy,
} from './amtgBridge';

// Phase 140.3: AMTG Engine (Test Generation)
export {
  generateMissingTests,
  getAMTGSummary,
} from './amtgEngine';

// Phase 140.4: Test Runner Bridge
export {
  type TestSuiteResult,
  type TestRunResult,
  type RunTestsOptions,
  runTestsForCycle,
  getAvailableTestSuites,
  parseTestOutput,
} from './testRunnerBridge';

// Phase 140.4: Failing Test Analyzer
export {
  extractFailureLocationFromStack,
  summarizeErrorMessage,
  failureToSuggestedFix,
  buildFailingTestsSummary,
  analyzeFailingTests,
  getFailingTestsSummaryText,
  groupFailuresByFile,
  filterFixesByStatus,
} from './failingTestAnalyzer';

// Phase 140.4: LLM Bridge (ACE integration stub)
export {
  type LLMEnrichmentOptions,
  type LLMEnrichmentResult,
  DEFAULT_LLM_OPTIONS,
  enrichSuggestedFixesWithLLM,
  generateFixPatch,
  validatePatch,
  isLLMAvailable,
  getLLMStatus,
} from './failingTestLLMBridge';
