// desktop/src/lib/tests/index.ts
// Phase 130: Test System exports (Browser-safe versions)
// Phase 137.2: Added testRecipes exports
// Phase 137.3: Added testCoach exports
// Phase 137.4: Added coverage analysis exports
// Phase 137.4.2: Added coverageCoach exports

export * from './testTypes';
export * from './testLabTypes';
export * from './testRecipes';
export * from './testCoach';
export * from './coverageTypes';
export * from './coverageEngine';
export * from './coverageCoach';

// Use browser-safe versions that don't require Node.js modules
export {
  detectFramework,
  parseTestScripts,
  discoverTestSuites,
  buildFileTestMap,
  findTestsForFiles,
  loadTestMeta,
  saveTestMeta,
  discoverAndCacheTests,
  getTestMeta,
} from './testDiscoveryBrowser';

export {
  parseTestOutput,
  runTestSuite,
  runTestsForFiles,
  runAllTests,
  aggregateResults,
  loadTestHistory,
  saveToHistory,
} from './testRunnerBrowser';

