// orchestrator/core/uiBuilder/uiGenerationOrchestrator.ts
// =============================================================================
// Phase 167.4 – UI Generation Orchestrator
// End-to-end flow: Proposal → Plan → Codegen → Apply
// =============================================================================

import { getFirestore } from 'firebase-admin/firestore';

import {
  UiGenerationPlan,
  UiCodegenResult,
  UiApplyResult,
  ExecuteUiGenerationParams,
  ExecuteUiGenerationResult,
  UiGenerationMode,
  UiStyleHints,
} from './uiGenerationPlanTypes';

import { buildUiGenerationPlan, BuildUiPlanParams } from './uiPlannerAgent';
import { generateUiCode, CodegenOptions } from './uiCodegenAgent';
import { applyUiCodegenResult } from './uiFileMutationEngine';

// =============================================================================
// Types
// =============================================================================

/**
 * UI Generation Proposal (from Phase 163)
 */
interface UiGenerationProposal {
  id: string;
  projectId: string;
  attachmentId?: string;
  prompt?: string;
  componentTree: {
    type: string;
    name?: string;
    children?: unknown[];
    props?: Record<string, unknown>;
  };
  suggestedRoute?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  createdAt: number;
}

/**
 * Media Memory Node (from Phase 165)
 */
interface MediaMemoryNode {
  id: string;
  projectId: string;
  attachmentId: string;
  summary: string;
  layoutTypes: string[];
  entities: string[];
  components: string[];
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColors: string[];
  styleHints: {
    borderRadius?: string;
    shadowLevel?: number;
    spacing?: string;
    theme?: string;
  };
}

// =============================================================================
// Constants
// =============================================================================

const PROPOSALS_COLLECTION = 'uiGenerationProposals';
const PLANS_COLLECTION = 'uiGenerationPlans';
const MEDIA_MEMORY_COLLECTION = 'mediaMemoryNodes';

// =============================================================================
// Firestore Access
// =============================================================================

let db: FirebaseFirestore.Firestore | null = null;

function getDb(): FirebaseFirestore.Firestore {
  if (!db) {
    db = getFirestore();
  }
  return db;
}

// =============================================================================
// Data Loaders
// =============================================================================

/**
 * Load UI Generation Proposal
 */
async function loadProposal(proposalId: string): Promise<UiGenerationProposal | null> {
  const doc = await getDb().collection(PROPOSALS_COLLECTION).doc(proposalId).get();
  return doc.exists ? (doc.data() as UiGenerationProposal) : null;
}

/**
 * Load Media Memory Node
 */
async function loadMediaMemory(
  projectId: string,
  attachmentId: string,
): Promise<MediaMemoryNode | null> {
  const snap = await getDb()
    .collection(MEDIA_MEMORY_COLLECTION)
    .where('projectId', '==', projectId)
    .where('attachmentId', '==', attachmentId)
    .limit(1)
    .get();

  return snap.empty ? null : (snap.docs[0].data() as MediaMemoryNode);
}

/**
 * Load Related Media Memory Nodes
 */
async function loadRelatedMedia(
  projectId: string,
  excludeId?: string,
  limit = 5,
): Promise<MediaMemoryNode[]> {
  const snap = await getDb()
    .collection(MEDIA_MEMORY_COLLECTION)
    .where('projectId', '==', projectId)
    .orderBy('createdAt', 'desc')
    .limit(limit + 1)
    .get();

  return snap.docs
    .map(doc => doc.data() as MediaMemoryNode)
    .filter(m => m.id !== excludeId)
    .slice(0, limit);
}

/**
 * Save Generation Plan to Firestore
 */
async function savePlan(plan: UiGenerationPlan): Promise<void> {
  await getDb().collection(PLANS_COLLECTION).doc(plan.id).set(plan);
}

/**
 * Update Plan Status
 */
async function updatePlanStatus(
  planId: string,
  status: UiGenerationPlan['status'],
  updates: Partial<UiGenerationPlan> = {},
): Promise<void> {
  await getDb()
    .collection(PLANS_COLLECTION)
    .doc(planId)
    .update({
      status,
      ...updates,
      updatedAt: Date.now(),
    });
}

/**
 * Update Proposal Status
 */
async function updateProposalStatus(
  proposalId: string,
  status: UiGenerationProposal['status'],
): Promise<void> {
  await getDb()
    .collection(PROPOSALS_COLLECTION)
    .doc(proposalId)
    .update({
      status,
      updatedAt: Date.now(),
    });
}

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Execute full UI generation pipeline
 * Proposal → Plan → Codegen → Apply
 */
export async function executeUiGeneration(
  params: ExecuteUiGenerationParams,
): Promise<ExecuteUiGenerationResult> {
  console.log('[167.4][ORCHESTRATOR] Starting UI generation:', params.proposalId);

  const { projectId, proposalId, attachmentId, modeOverride, dryRun = false } = params;

  let plan: UiGenerationPlan | null = null;
  let codegen: UiCodegenResult | null = null;
  let applySummary: UiApplyResult | null = null;
  let currentStage: 'PLAN' | 'CODEGEN' | 'APPLY' | 'COMPLETE' = 'PLAN';

  try {
    // ===========================================
    // Stage 1: Load Proposal
    // ===========================================
    console.log('[167.4][ORCHESTRATOR] Stage 1: Loading proposal');

    const proposal = await loadProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    if (proposal.projectId !== projectId) {
      throw new Error('Project ID mismatch');
    }

    // ===========================================
    // Stage 2: Load Media Memory & Context
    // ===========================================
    console.log('[167.4][ORCHESTRATOR] Stage 2: Loading context');

    let mediaMemory: MediaMemoryNode | null = null;
    let relatedMedia: MediaMemoryNode[] = [];

    const effectiveAttachmentId = attachmentId || proposal.attachmentId;
    if (effectiveAttachmentId) {
      mediaMemory = await loadMediaMemory(projectId, effectiveAttachmentId);
      relatedMedia = await loadRelatedMedia(projectId, mediaMemory?.id);
    }

    // Neural context would be loaded here from Phase 166
    // For now, we'll pass undefined
    const neuralContext = undefined;

    // ===========================================
    // Stage 3: Build Generation Plan
    // ===========================================
    console.log('[167.4][ORCHESTRATOR] Stage 3: Building plan');

    const planParams: BuildUiPlanParams = {
      projectId,
      proposalId,
      proposal: proposal as BuildUiPlanParams['proposal'],
      mediaMemory: mediaMemory || undefined,
      relatedMedia,
      neuralContext,
      modeOverride,
    };

    plan = await buildUiGenerationPlan(planParams);

    // Save plan to Firestore
    await savePlan(plan);

    currentStage = 'CODEGEN';

    // ===========================================
    // Stage 4: Generate Code
    // ===========================================
    console.log('[167.4][ORCHESTRATOR] Stage 4: Generating code');

    await updatePlanStatus(plan.id, 'RUNNING');

    const codegenOptions: CodegenOptions = {
      useTypeScript: true,
      useTailwind: true,
      useClientDirective: true,
    };

    codegen = await generateUiCode(plan, codegenOptions);

    if (codegen.errors && codegen.errors.length > 0) {
      const fatalErrors = codegen.errors.filter(e => !e.recoverable);
      if (fatalErrors.length > 0) {
        throw new Error(`Code generation failed: ${fatalErrors[0].error}`);
      }
    }

    currentStage = 'APPLY';

    // ===========================================
    // Stage 5: Apply Changes
    // ===========================================
    console.log('[167.4][ORCHESTRATOR] Stage 5: Applying changes');

    applySummary = await applyUiCodegenResult(codegen, {
      createRollback: true,
      dryRun,
    });

    if (!applySummary.success && !dryRun) {
      throw new Error(`Apply failed: ${applySummary.failedFiles?.[0]?.error || 'Unknown error'}`);
    }

    // ===========================================
    // Stage 6: Finalize
    // ===========================================
    console.log('[167.4][ORCHESTRATOR] Stage 6: Finalizing');

    await updatePlanStatus(plan.id, dryRun ? 'PLANNED' : 'APPLIED', {
      executedAt: Date.now(),
      completedAt: Date.now(),
    });

    if (!dryRun) {
      await updateProposalStatus(proposalId, 'COMPLETED');
    }

    currentStage = 'COMPLETE';

    console.log('[167.4][ORCHESTRATOR] UI generation complete:', plan.id);

    return {
      plan,
      codegen,
      applySummary,
      success: true,
      stage: currentStage,
    };

  } catch (error) {
    console.error('[167.4][ORCHESTRATOR] Error at stage:', currentStage, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update plan status if we have one
    if (plan) {
      await updatePlanStatus(plan.id, 'FAILED', {
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
      });
    }

    return {
      plan: plan || createEmptyPlan(projectId, proposalId),
      codegen: codegen || createEmptyCodegen(projectId),
      applySummary: applySummary || createEmptyApplySummary(projectId),
      success: false,
      stage: currentStage,
      errorMessage,
    };
  }
}

// =============================================================================
// Step-by-Step Execution (for UI progress)
// =============================================================================

/**
 * Build plan only (without executing)
 */
export async function buildPlanOnly(
  params: {
    projectId: string;
    proposalId: string;
    attachmentId?: string;
    modeOverride?: UiGenerationMode;
    styleOverrides?: Partial<UiStyleHints>;
  },
): Promise<UiGenerationPlan> {
  console.log('[167.4][ORCHESTRATOR] Building plan only');

  const proposal = await loadProposal(params.proposalId);
  if (!proposal) {
    throw new Error(`Proposal not found: ${params.proposalId}`);
  }

  let mediaMemory: MediaMemoryNode | null = null;
  if (params.attachmentId || proposal.attachmentId) {
    mediaMemory = await loadMediaMemory(
      params.projectId,
      params.attachmentId || proposal.attachmentId!,
    );
  }

  const plan = await buildUiGenerationPlan({
    projectId: params.projectId,
    proposalId: params.proposalId,
    proposal: proposal as BuildUiPlanParams['proposal'],
    mediaMemory: mediaMemory || undefined,
    modeOverride: params.modeOverride,
    styleOverrides: params.styleOverrides,
  });

  await savePlan(plan);

  return plan;
}

/**
 * Execute codegen for an existing plan
 */
export async function executeCodegenOnly(planId: string): Promise<UiCodegenResult> {
  console.log('[167.4][ORCHESTRATOR] Executing codegen only:', planId);

  const doc = await getDb().collection(PLANS_COLLECTION).doc(planId).get();
  if (!doc.exists) {
    throw new Error(`Plan not found: ${planId}`);
  }

  const plan = doc.data() as UiGenerationPlan;
  const codegen = await generateUiCode(plan);

  return codegen;
}

/**
 * Apply codegen result
 */
export async function executeApplyOnly(
  codegen: UiCodegenResult,
  dryRun = false,
): Promise<UiApplyResult> {
  console.log('[167.4][ORCHESTRATOR] Executing apply only');

  const result = await applyUiCodegenResult(codegen, {
    createRollback: true,
    dryRun,
  });

  return result;
}

// =============================================================================
// Helper Functions
// =============================================================================

function createEmptyPlan(projectId: string, proposalId: string): UiGenerationPlan {
  return {
    id: `plan_failed_${Date.now()}`,
    projectId,
    proposalId,
    mode: 'create_page',
    routePath: '/error',
    pageName: 'ErrorPage',
    files: [],
    status: 'FAILED',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function createEmptyCodegen(projectId: string): UiCodegenResult {
  return {
    planId: '',
    projectId,
    files: [],
    totalFiles: 0,
    filesCreated: 0,
    filesModified: 0,
    generationTimeMs: 0,
  };
}

function createEmptyApplySummary(projectId: string): UiApplyResult {
  return {
    planId: '',
    projectId,
    success: false,
    appliedFiles: [],
    rollbackAvailable: false,
    summary: 'No changes applied',
    applyTimeMs: 0,
  };
}

// =============================================================================
// Plan Management
// =============================================================================

/**
 * Get plan by ID
 */
export async function getPlan(planId: string): Promise<UiGenerationPlan | null> {
  const doc = await getDb().collection(PLANS_COLLECTION).doc(planId).get();
  return doc.exists ? (doc.data() as UiGenerationPlan) : null;
}

/**
 * List plans for a project
 */
export async function listPlans(
  projectId: string,
  limit = 20,
): Promise<UiGenerationPlan[]> {
  const snap = await getDb()
    .collection(PLANS_COLLECTION)
    .where('projectId', '==', projectId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => doc.data() as UiGenerationPlan);
}

/**
 * Delete a plan
 */
export async function deletePlan(planId: string): Promise<void> {
  await getDb().collection(PLANS_COLLECTION).doc(planId).delete();
}

console.log('[167.4][UI_BUILDER] Orchestrator loaded');
