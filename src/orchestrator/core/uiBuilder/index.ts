// orchestrator/core/uiBuilder/index.ts
// =============================================================================
// Phase 167 – UI Builder Module Exports
// Autonomous UI Generation Pipeline
// =============================================================================

// Phase 163 Types & Store
export * from './types';
export * from './firestoreUiBuilderStore';

// Phase 167 Types
export * from './uiGenerationPlanTypes';

// Planner Agent (167.1)
export {
  buildUiGenerationPlan,
  buildUiGenerationPlanWithLLM,
  determineGenerationMode,
  extractLayoutHint,
  extractStyleHints,
  routeToPageName,
  routeToFilePath,
  treeToComponentPlans,
  generateFilePlans,
} from './uiPlannerAgent';
export type { BuildUiPlanParams } from './uiPlannerAgent';

// Codegen Agent (167.2)
export {
  generateUiCode,
  generateUiCodeWithLLM,
  generateComponentCode,
  generatePageFile,
  generateComponentFile,
  generateHookFile,
  TEMPLATES,
} from './uiCodegenAgent';
export type { CodegenOptions, LLMClient } from './uiCodegenAgent';

// File Mutation Engine (167.3)
export {
  applyUiCodegenResult,
  executeRollback,
  queueFileChanges,
  processQueuedWrites,
  isProtectedPath,
  validateContent,
  getVfsFileContent,
  writeToVfs,
  deleteFromVfs,
  createRollback,
} from './uiFileMutationEngine';
export type { FileWriteTarget, FileWriteJob } from './uiFileMutationEngine';

// Orchestrator (167.4)
export {
  executeUiGeneration,
  buildPlanOnly,
  executeCodegenOnly,
  executeApplyOnly,
  getPlan,
  listPlans,
  deletePlan,
} from './uiGenerationOrchestrator';

console.log('[167][UI_BUILDER] Module exports loaded');
