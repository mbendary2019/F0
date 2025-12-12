// orchestrator/core/llm/aceIntegration.ts
// Phase 170.2.2: ACE Auto-Fix Integration with Multi-Model Orchestrator
// Replaces direct OpenAI calls with smart model routing

import {
  instrumentedLLMCall,
  codeCall,
  type InstrumentedCallResult,
} from './instrumentedCall';
import {
  LLMRouter,
} from './router';
import {
  DEVSTRAL_SYSTEM_PROMPTS,
  type F0DevStralClient,
} from './clients/devstralClient';
import { LLMClientFactory } from './clientFactory';
import type { LLMTaskType, UserPlanTier, LLMMessage } from './types';

/**
 * ACE Issue format (from existing system)
 */
export interface AceIssue {
  id?: string;
  ruleId?: string;
  message: string;
  line: number;
  column?: number;
  severity: 'low' | 'medium' | 'high' | 'error' | 'warning' | 'info';
}

/**
 * ACE Patch format (from existing system)
 */
export interface AcePatch {
  filePath: string;
  start: { line: number; column: number };
  end: { line: number; column: number };
  replacement: string;
  reason: string;
}

/**
 * ACE Auto-Fix Request
 */
export interface AceAutoFixRequest {
  filePath: string;
  fileRole?: string;
  code: string;
  issues: AceIssue[];
  riskLevel?: 'strict' | 'balanced' | 'relaxed';
  language?: string;
  dryRun?: boolean;
}

/**
 * ACE Auto-Fix Response
 */
export interface AceAutoFixResponse {
  patches: AcePatch[];
  summary: string;
  success: boolean;
  notes?: string[];
  error?: string;
  /** Model that was used */
  model: string;
  /** Metrics from the call */
  metrics?: {
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    costUSD: number;
  };
}

/**
 * Build ACE system prompt with risk level
 */
function buildAceSystemPrompt(riskLevel: 'strict' | 'balanced' | 'relaxed'): string {
  const riskGuidance = {
    strict: `RISK LEVEL: STRICT (Conservative)
- Only apply extremely safe, mechanical fixes
- Fix: unused imports, unused variables, obvious typos, console.log removal
- Skip: any refactoring, type changes, logic changes
- When in doubt, do NOT make the change`,
    relaxed: `RISK LEVEL: RELAXED (Aggressive)
- Apply more aggressive refactors for code quality
- Fix: all lint issues, type improvements, code simplification
- You may rename local variables for clarity
- You may extract repeated code into constants
- Still avoid breaking public APIs`,
    balanced: `RISK LEVEL: BALANCED (Default)
- Apply safe, local fixes for obvious issues
- Fix: unused imports/vars, lint errors, obvious bugs, type narrowing
- Skip: large refactors, logic changes, public API changes
- If unsure about safety, add a TODO comment instead of changing`,
  };

  return `You are ACE, an automated code mechanic for the F0 Desktop IDE.

CRITICAL REQUIREMENT:
If the issue list is non-empty, you MUST return at least 1-3 patches.
Never return an empty patches array when there are fixable issues.
If you truly cannot safely fix ANY issue, explain why in the summary.

${riskGuidance[riskLevel]}

YOUR JOB:
1. Read the issues list carefully
2. For each issue, decide if it's safely fixable
3. Generate patches for the safest 3-7 issues (prioritize: security > lint > style)
4. Each patch replaces specific lines with fixed code

PATCH PRIORITIES (fix these first):
1. Security: eval(), dangerouslySetInnerHTML, insecure patterns
2. Unused code: imports, variables, parameters that are never used
3. Type issues: missing types, any usage, type assertions
4. Lint errors: ESLint rule violations
5. Style: console.log in production code, formatting issues

RULES:
- NEVER change public API, function signatures, or external behavior
- Prefer small, surgical fixes over large refactors
- Each patch should be self-contained and apply cleanly
- Use exact line numbers from the provided code
- Preserve existing code style and formatting

RESPONSE FORMAT (JSON only, no markdown):
{
  "summary": "Fixed X issues: brief description",
  "patches": [
    {
      "filePath": "path/to/file.ts",
      "start": { "line": 5, "column": 1 },
      "end": { "line": 5, "column": 30 },
      "replacement": "const value = 42;",
      "reason": "Removed unused variable 'x'"
    }
  ],
  "skippedReasons": ["Issue #3 skipped: would require logic change"]
}

Return ONLY valid JSON. No markdown code blocks. No explanatory text outside JSON.`;
}

/**
 * Build ACE user prompt with code and issues
 */
function buildAceUserPrompt(request: AceAutoFixRequest): string {
  const { filePath, fileRole, code, issues, language } = request;
  const MAX_ISSUES = 10;

  const limitedIssues = issues.slice(0, MAX_ISSUES);
  const wasLimited = issues.length > MAX_ISSUES;

  const issuesText =
    limitedIssues.length > 0
      ? limitedIssues
          .map(
            (i, idx) =>
              `#${idx + 1}: [${i.severity?.toUpperCase() || 'UNKNOWN'}] ${i.message} (line ${i.line}${i.ruleId ? `, rule: ${i.ruleId}` : ''})`
          )
          .join('\n')
      : 'No structured issues provided. Scan for common problems: unused imports, console.logs, type issues.';

  const lines = code.split('\n');
  const numberedCode = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');

  let context = `FILE: ${filePath}
ROLE: ${fileRole || 'TypeScript/React source file'}
LANGUAGE: ${language || 'ts'}

ISSUES TO FIX (${limitedIssues.length}${wasLimited ? ` of ${issues.length} total` : ''}):
${issuesText}`;

  if (wasLimited) {
    context += `\n\nNOTE: ${issues.length - MAX_ISSUES} additional issues were omitted. Focus on fixing the listed issues.`;
  }

  context += `

SOURCE CODE:
\`\`\`
${numberedCode}
\`\`\`

INSTRUCTIONS:
1. Generate patches to fix the listed issues
2. Each patch should target specific line numbers
3. Return at least 1 patch if any issue is fixable
4. If no issues can be safely fixed, explain why in summary`;

  return context;
}

/**
 * Parse ACE response JSON
 */
function parseAceResponse(content: string, filePath: string): {
  patches: AcePatch[];
  summary: string;
  skippedReasons?: string[];
} {
  try {
    const parsed = JSON.parse(content);

    const patches: AcePatch[] = (parsed.patches || []).map((p: any) => ({
      filePath: p.filePath || filePath,
      start: p.start,
      end: p.end,
      replacement: p.replacement,
      reason: p.reason,
    }));

    return {
      patches,
      summary: parsed.summary || `Generated ${patches.length} patches.`,
      skippedReasons: parsed.skippedReasons,
    };
  } catch {
    return {
      patches: [],
      summary: 'Failed to parse response',
    };
  }
}

/**
 * ACE Auto-Fix using Multi-Model Orchestrator
 * Routes to DevStral for code tasks, falls back to other models
 */
export async function aceAutoFix(
  request: AceAutoFixRequest,
  userTier: UserPlanTier = 'pro',
  userId: string = 'system'
): Promise<AceAutoFixResponse> {
  const {
    filePath,
    code,
    issues,
    riskLevel = 'balanced',
    dryRun = false,
  } = request;

  // Dry run mode
  if (dryRun) {
    return {
      patches: [],
      summary: 'Dry run only - analysis generated but no patches applied.',
      success: true,
      model: 'none',
    };
  }

  // Build prompts
  const systemPrompt = buildAceSystemPrompt(riskLevel);
  const userPrompt = buildAceUserPrompt(request);

  // Make instrumented call with AUTO_FIX task type
  // This will route to DevStral for pro/ultimate users
  const result = await instrumentedLLMCall({
    taskType: 'AUTO_FIX',
    userTier,
    userId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2, // Low temp for code
    responseFormat: 'json',
    criticality: 'high',
  });

  if (!result.success) {
    return {
      patches: [],
      summary: result.error || 'LLM call failed',
      success: false,
      error: result.error,
      model: result.model,
    };
  }

  // Parse the response
  const parsed = parseAceResponse(result.content, filePath);

  // Check if we got patches
  const hadIssues = issues.length > 0;
  const gotNoPatches = parsed.patches.length === 0;

  return {
    patches: parsed.patches,
    summary: parsed.summary,
    success: !hadIssues || !gotNoPatches,
    notes: parsed.skippedReasons,
    error: hadIssues && gotNoPatches ? 'NO_PATCHES_GENERATED' : undefined,
    model: result.model,
    metrics: {
      latencyMs: result.metrics.latencyMs,
      inputTokens: result.metrics.inputTokens,
      outputTokens: result.metrics.outputTokens,
      costUSD: result.metrics.estimatedCostUSD || 0,
    },
  };
}

/**
 * Direct DevStral call for code tasks (bypasses routing)
 * Use when you specifically want DevStral's code-specialized behavior
 */
export async function devstralCodeFix(
  taskType: 'AUTO_FIX' | 'REFACTOR' | 'CODE_REVIEW' | 'TEST_GENERATION',
  codeContext: string,
  userMessage: string,
  options?: {
    errorContext?: string;
    model?: string;
    temperature?: number;
  }
): Promise<{ content: string; success: boolean; error?: string }> {
  try {
    const client = LLMClientFactory.getDevStral();
    const response = await client.codeChat({
      taskType,
      model: options?.model || 'devstral-small-2505',
      userMessage,
      codeContext,
      errorContext: options?.errorContext,
      temperature: options?.temperature,
    });

    return {
      content: response.content,
      success: true,
    };
  } catch (err: any) {
    return {
      content: '',
      success: false,
      error: err.message || 'DevStral call failed',
    };
  }
}

/**
 * Get the best model for a code task based on user tier
 */
export function getRecommendedCodeModel(
  taskType: 'AUTO_FIX' | 'CODE_REVIEW' | 'REFACTOR' | 'CODE_GENERATION' | 'TEST_GENERATION',
  userTier: UserPlanTier
): string {
  return LLMRouter.routeCodeTask(taskType, userTier).preferredModel;
}

/**
 * Quick ACE fix for a single issue
 */
export async function quickFix(
  filePath: string,
  code: string,
  issue: AceIssue,
  userTier: UserPlanTier = 'pro'
): Promise<AcePatch | null> {
  const result = await aceAutoFix(
    {
      filePath,
      code,
      issues: [issue],
      riskLevel: 'strict', // Conservative for quick fixes
    },
    userTier
  );

  return result.patches[0] || null;
}

export default aceAutoFix;
