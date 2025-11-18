// src/lib/agents/patch/orchestrator.ts
// Phase 81: Full Patch Pipeline Orchestrator with Recovery

import { detectPatchFromResponse, validatePatchText } from './detectPatch';
import { parsePatch, extractPatchFromMarkdown } from './parsePatch';
import { applyPatch } from './applyPatch';
import { AgentError, AgentErrorType, toAgentError } from '../errors';
import { recoveryEngine, RecoveryContext, RecoveryResult } from '../recovery';
import { Patch, PatchResult } from './types';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const MAX_RETRY_ATTEMPTS = 3;

export interface PatchApplyInput {
  projectId: string;
  modelOutput: string;
  originalRequest: string;
  locale?: 'ar' | 'en';
  taskKind?: string;
  maxRetries?: number;
  fileContents?: Record<string, string>; // filePath -> content (for testing)
}

export interface PatchApplyResult {
  success: boolean;
  patches?: Patch[];
  patchResults?: PatchResult[];
  error?: AgentError;
  attempts: number;
  strategy?: string;
  patchId?: string;
}

/**
 * Main orchestrator function: Detect → Parse → Apply → Recover
 */
export async function runPatchApply(input: PatchApplyInput): Promise<PatchApplyResult> {
  const maxRetries = input.maxRetries ?? MAX_RETRY_ATTEMPTS;
  const locale = input.locale ?? 'en';

  console.log(`[Orchestrator] Starting patch application for project ${input.projectId}`);

  // Step 1: Detect patch from model output
  const detected = detectPatchFromResponse(input.modelOutput);

  if (!detected.hasPatch || !detected.patchText) {
    console.log('[Orchestrator] No patch detected in model output');
    return {
      success: false,
      error: new AgentError(
        AgentErrorType.INVALID_FORMAT,
        locale === 'ar'
          ? 'لم يتم اكتشاف أي patch في استجابة الذكاء الاصطناعي'
          : 'No patch detected in AI response'
      ),
      attempts: 0,
    };
  }

  if (detected.confidence < 0.7) {
    console.warn(`[Orchestrator] Low confidence patch detection: ${detected.confidence}`);
  }

  // Step 2: Validate patch text
  const validation = validatePatchText(detected.patchText);
  if (!validation.valid) {
    console.error(`[Orchestrator] Invalid patch: ${validation.reason}`);
    return {
      success: false,
      error: new AgentError(
        AgentErrorType.INVALID_FORMAT,
        locale === 'ar'
          ? `صيغة الـ patch غير صحيحة: ${validation.reason}`
          : `Invalid patch format: ${validation.reason}`
      ),
      attempts: 0,
    };
  }

  // Step 3: Parse patch
  let patches: Patch[];
  try {
    patches = parsePatch(detected.patchText);
    if (patches.length === 0) {
      throw new Error('No patches parsed');
    }
  } catch (error: any) {
    console.error('[Orchestrator] Parse error:', error);
    return {
      success: false,
      error: toAgentError(error),
      attempts: 0,
    };
  }

  console.log(`[Orchestrator] Parsed ${patches.length} patch(es)`);

  // Step 4: Apply patches with recovery
  const result = await applyPatchesWithRecovery({
    projectId: input.projectId,
    patches,
    originalRequest: input.originalRequest,
    originalResponse: input.modelOutput,
    locale,
    maxRetries,
    fileContents: input.fileContents,
  });

  // Step 5: Save to Firestore (if success or partial success)
  if (result.success || result.patchResults?.some((r) => r.success)) {
    try {
      const patchId = await savePatchToFirestore({
        projectId: input.projectId,
        patches,
        patchResults: result.patchResults,
        success: result.success,
        error: result.error,
        attempts: result.attempts,
        strategy: result.strategy,
        taskKind: input.taskKind,
      });
      result.patchId = patchId;
      console.log(`[Orchestrator] Saved patch to Firestore: ${patchId}`);
    } catch (error: any) {
      console.error('[Orchestrator] Failed to save to Firestore:', error);
      // Don't fail the entire operation if Firestore save fails
    }
  }

  return result;
}

/**
 * Apply patches with automatic recovery on failure
 */
async function applyPatchesWithRecovery(params: {
  projectId: string;
  patches: Patch[];
  originalRequest: string;
  originalResponse: string;
  locale: 'ar' | 'en';
  maxRetries: number;
  fileContents?: Record<string, string>;
}): Promise<PatchApplyResult> {
  const { patches, originalRequest, originalResponse, locale, maxRetries, fileContents } = params;

  let attempt = 0;
  let currentPatches = patches;

  while (attempt < maxRetries) {
    attempt++;
    console.log(`[Orchestrator] Attempt ${attempt}/${maxRetries}`);

    // Apply all patches
    const patchResults: PatchResult[] = [];
    let allSuccess = true;
    let firstError: AgentError | undefined;

    for (const patch of currentPatches) {
      try {
        // Get file content (from provided map or fetch from storage)
        const fileContent = fileContents?.[patch.filePath] ?? '';

        // For now, we simulate apply (actual file writes would go here)
        const result = applyPatch(patch, fileContent);

        patchResults.push(result);

        if (!result.success) {
          allSuccess = false;
          if (!firstError) {
            firstError = toAgentError(
              new Error(result.error || 'Patch application failed')
            );
          }
        }
      } catch (error: any) {
        allSuccess = false;
        const agentError = toAgentError(error);
        patchResults.push({
          success: false,
          filePath: patch.filePath,
          error: agentError.message,
        });
        if (!firstError) {
          firstError = agentError;
        }
      }
    }

    // If all patches succeeded, we're done
    if (allSuccess) {
      console.log('[Orchestrator] All patches applied successfully');
      return {
        success: true,
        patches: currentPatches,
        patchResults,
        attempts: attempt,
        strategy: attempt === 1 ? 'direct' : 'retry',
      };
    }

    // If we have attempts left, try recovery
    if (attempt < maxRetries && firstError) {
      console.log(`[Orchestrator] Attempting recovery for error: ${firstError.type}`);

      const recoveryContext: RecoveryContext = {
        originalRequest,
        originalResponse,
        error: firstError,
        attempt,
        maxAttempts: maxRetries,
        locale,
        projectId: params.projectId,
      };

      const recoveryResult: RecoveryResult = await recoveryEngine.recover(recoveryContext);

      if (recoveryResult.success && recoveryResult.patch) {
        console.log(`[Orchestrator] Recovery successful with strategy: ${recoveryResult.strategy}`);
        currentPatches = [recoveryResult.patch];
        // Loop will retry with recovered patch
      } else {
        console.log('[Orchestrator] Recovery failed, stopping');
        return {
          success: false,
          patches: currentPatches,
          patchResults,
          error: firstError,
          attempts: attempt,
          strategy: recoveryResult.strategy,
        };
      }
    } else {
      // Out of attempts
      console.log('[Orchestrator] Max retries reached, stopping');
      return {
        success: false,
        patches: currentPatches,
        patchResults,
        error: firstError,
        attempts: attempt,
      };
    }
  }

  // Should never reach here
  return {
    success: false,
    patches: currentPatches,
    patchResults: [],
    error: new AgentError(AgentErrorType.UNKNOWN, 'Max retries exceeded'),
    attempts: maxRetries,
  };
}

/**
 * Save patch result to Firestore
 */
async function savePatchToFirestore(params: {
  projectId: string;
  patches: Patch[];
  patchResults?: PatchResult[];
  success: boolean;
  error?: AgentError;
  attempts: number;
  strategy?: string;
  taskKind?: string;
}): Promise<string> {
  const { projectId, patches, patchResults, success, error, attempts, strategy, taskKind } =
    params;

  const patchesCollection = collection(db, 'projects', projectId, 'patches');
  const patchDoc = doc(patchesCollection);

  const patchData = {
    patches: patches.map((p) => ({
      filePath: p.filePath,
      isNew: p.isNew ?? false,
      isDeleted: p.isDeleted ?? false,
      hunksCount: p.hunks.length,
    })),
    results: patchResults?.map((r) => ({
      filePath: r.filePath,
      success: r.success,
      error: r.error,
      linesChanged: r.modifiedContent ? r.modifiedContent.split('\n').length : 0,
    })),
    status: success ? 'applied' : 'failed',
    errorType: error?.type,
    errorMessage: error?.message,
    attempts,
    strategy,
    taskKind,
    source: 'agent',
    createdAt: serverTimestamp(),
  };

  await setDoc(patchDoc, patchData);

  return patchDoc.id;
}

/**
 * Preview patches without applying (for UI)
 */
export async function previewPatch(input: PatchApplyInput): Promise<{
  success: boolean;
  patches?: Patch[];
  error?: AgentError;
}> {
  const detected = detectPatchFromResponse(input.modelOutput);

  if (!detected.hasPatch || !detected.patchText) {
    return {
      success: false,
      error: new AgentError(AgentErrorType.INVALID_FORMAT, 'No patch detected'),
    };
  }

  const validation = validatePatchText(detected.patchText);
  if (!validation.valid) {
    return {
      success: false,
      error: new AgentError(AgentErrorType.INVALID_FORMAT, validation.reason || 'Invalid patch'),
    };
  }

  try {
    const patches = parsePatch(detected.patchText);
    return {
      success: true,
      patches,
    };
  } catch (error: any) {
    return {
      success: false,
      error: toAgentError(error),
    };
  }
}
