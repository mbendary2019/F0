/**
 * Phase 87.2: Validate Code Agent response structure
 */

import type { CodeAgentResponse, CodeAgentPatch } from '@/types/codeAgent';

/**
 * Validates that the LLM response matches CodeAgentResponse schema
 *
 * @param data - Parsed JSON from LLM
 * @returns Validated CodeAgentResponse
 * @throws Error if validation fails
 */
export function validateCodeAgentResponse(data: any): CodeAgentResponse {
  // Check required fields
  if (!data || typeof data !== 'object') {
    throw new Error('Response must be an object');
  }

  if (typeof data.summary !== 'string' || !data.summary.trim()) {
    throw new Error('Response must have a non-empty "summary" string');
  }

  if (!Array.isArray(data.patches)) {
    throw new Error('Response must have a "patches" array');
  }

  // Validate each patch
  const validatedPatches: CodeAgentPatch[] = data.patches.map((patch: any, index: number) => {
    if (!patch || typeof patch !== 'object') {
      throw new Error(`Patch ${index} must be an object`);
    }

    if (typeof patch.path !== 'string' || !patch.path.trim()) {
      throw new Error(`Patch ${index} must have a non-empty "path" string`);
    }

    const validActions = ['create', 'modify', 'delete'];
    if (!validActions.includes(patch.action)) {
      throw new Error(`Patch ${index} must have action: "create", "modify", or "delete"`);
    }

    // For create/modify, content is required
    if ((patch.action === 'create' || patch.action === 'modify')) {
      if (typeof patch.content !== 'string') {
        throw new Error(`Patch ${index} with action "${patch.action}" must have "content" string`);
      }
    }

    return {
      path: patch.path,
      action: patch.action,
      content: patch.content,
    };
  });

  return {
    summary: data.summary,
    patches: validatedPatches,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
  };
}
