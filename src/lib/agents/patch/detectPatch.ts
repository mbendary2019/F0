// src/lib/agents/patch/detectPatch.ts
// Phase 80: Patch Pipeline Integration - Patch Detection from LLM Response

export interface DetectedPatch {
  hasPatch: boolean;
  patchText?: string;
  explanation?: string; // Text before/after the patch
  confidence: number; // 0-1 confidence this is a valid patch
}

/**
 * Detect and extract patch from LLM response
 * Looks for ```diff or ```patch code blocks
 */
export function detectPatchFromResponse(rawOutput: string): DetectedPatch {
  if (!rawOutput || rawOutput.trim().length === 0) {
    return {
      hasPatch: false,
      confidence: 0,
    };
  }

  // Try to find ```diff block
  const diffMatch = rawOutput.match(/```diff\s*\n([\s\S]*?)```/);
  if (diffMatch) {
    const patchText = diffMatch[1].trim();

    // Extract explanation (text before the code block)
    const beforeBlock = rawOutput.substring(0, diffMatch.index).trim();
    const afterBlock = rawOutput.substring(diffMatch.index! + diffMatch[0].length).trim();
    const explanation = [beforeBlock, afterBlock].filter(Boolean).join('\n\n');

    return {
      hasPatch: true,
      patchText,
      explanation: explanation || undefined,
      confidence: 0.95, // High confidence for explicit diff blocks
    };
  }

  // Try to find ```patch block
  const patchMatch = rawOutput.match(/```patch\s*\n([\s\S]*?)```/);
  if (patchMatch) {
    const patchText = patchMatch[1].trim();

    const beforeBlock = rawOutput.substring(0, patchMatch.index).trim();
    const afterBlock = rawOutput.substring(patchMatch.index! + patchMatch[0].length).trim();
    const explanation = [beforeBlock, afterBlock].filter(Boolean).join('\n\n');

    return {
      hasPatch: true,
      patchText,
      explanation: explanation || undefined,
      confidence: 0.9,
    };
  }

  // Try to find any code block that starts with 'diff --git'
  const genericMatch = rawOutput.match(/```[\w]*\s*\n(diff --git[\s\S]*?)```/);
  if (genericMatch) {
    const patchText = genericMatch[1].trim();

    const beforeBlock = rawOutput.substring(0, genericMatch.index).trim();
    const afterBlock = rawOutput.substring(genericMatch.index! + genericMatch[0].length).trim();
    const explanation = [beforeBlock, afterBlock].filter(Boolean).join('\n\n');

    return {
      hasPatch: true,
      patchText,
      explanation: explanation || undefined,
      confidence: 0.8, // Lower confidence for generic blocks
    };
  }

  // Check if the raw output itself looks like a diff (no code blocks)
  if (rawOutput.includes('diff --git') && rawOutput.includes('@@')) {
    // Might be a raw diff without markdown
    return {
      hasPatch: true,
      patchText: rawOutput.trim(),
      confidence: 0.7, // Lower confidence for raw diffs
    };
  }

  return {
    hasPatch: false,
    confidence: 0,
  };
}

/**
 * Extract multiple patches from response (if LLM generated a bundle)
 */
export function detectMultiplePatches(rawOutput: string): DetectedPatch[] {
  const patches: DetectedPatch[] = [];

  // Find all diff blocks
  const diffRegex = /```diff\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = diffRegex.exec(rawOutput)) !== null) {
    patches.push({
      hasPatch: true,
      patchText: match[1].trim(),
      confidence: 0.95,
    });
  }

  // If no explicit diff blocks, try patch blocks
  if (patches.length === 0) {
    const patchRegex = /```patch\s*\n([\s\S]*?)```/g;
    while ((match = patchRegex.exec(rawOutput)) !== null) {
      patches.push({
        hasPatch: true,
        patchText: match[1].trim(),
        confidence: 0.9,
      });
    }
  }

  return patches;
}

/**
 * Validate that detected patch text is well-formed
 */
export function validatePatchText(patchText: string): { valid: boolean; reason?: string } {
  if (!patchText || patchText.trim().length === 0) {
    return { valid: false, reason: 'Empty patch text' };
  }

  // Must contain diff header
  if (!patchText.includes('diff --git')) {
    return { valid: false, reason: 'Missing diff --git header' };
  }

  // Must contain at least one hunk header
  if (!patchText.includes('@@')) {
    return { valid: false, reason: 'Missing hunk header (@@)' };
  }

  // Should have at least one change line (+ or -)
  const lines = patchText.split('\n');
  const hasChanges = lines.some((line) => line.startsWith('+') || line.startsWith('-'));
  if (!hasChanges) {
    return { valid: false, reason: 'No changes found (no + or - lines)' };
  }

  return { valid: true };
}
