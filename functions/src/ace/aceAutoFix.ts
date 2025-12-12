// functions/src/ace/aceAutoFix.ts
// Phase 147: ACE Auto-Fix Backend Cloud Function
// Phase 147.1: ACE Patch Yield Tuning - Enforce patch generation
// Uses OpenAI to generate real patches for code issues

import * as logger from 'firebase-functions/logger';
import { onRequest } from 'firebase-functions/v2/https';
import OpenAI from 'openai';
import type {
  AceAutoFixRequest,
  AceAutoFixResult,
  AcePatch,
  AceIssue,
  OpenAIPatchResponse,
} from './types';

// ============================================
// Constants
// ============================================

/** Maximum issues to process per request to keep prompts focused */
const MAX_ISSUES_PER_REQUEST = 10;

// ============================================
// OpenAI Client Setup
// ============================================

const getOpenAIClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey });
};

// ============================================
// Risk Level Guidance
// ============================================

type RiskLevel = 'strict' | 'balanced' | 'relaxed';

function getRiskGuidance(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case 'strict':
      return `RISK LEVEL: STRICT (Conservative)
- Only apply extremely safe, mechanical fixes
- Fix: unused imports, unused variables, obvious typos, console.log removal
- Skip: any refactoring, type changes, logic changes
- When in doubt, do NOT make the change`;
    case 'relaxed':
      return `RISK LEVEL: RELAXED (Aggressive)
- Apply more aggressive refactors for code quality
- Fix: all lint issues, type improvements, code simplification
- You may rename local variables for clarity
- You may extract repeated code into constants
- Still avoid breaking public APIs`;
    case 'balanced':
    default:
      return `RISK LEVEL: BALANCED (Default)
- Apply safe, local fixes for obvious issues
- Fix: unused imports/vars, lint errors, obvious bugs, type narrowing
- Skip: large refactors, logic changes, public API changes
- If unsure about safety, add a TODO comment instead of changing`;
  }
}

// ============================================
// System & User Prompts
// ============================================

function buildSystemPrompt(riskLevel: RiskLevel): string {
  const riskGuidance = getRiskGuidance(riskLevel);

  return `You are ACE, an automated code mechanic for the F0 Desktop IDE.

CRITICAL REQUIREMENT:
If the issue list is non-empty, you MUST return at least 1-3 patches.
Never return an empty patches array when there are fixable issues.
If you truly cannot safely fix ANY issue, explain why in the summary.

${riskGuidance}

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

function buildUserPrompt(request: AceAutoFixRequest): string {
  const { filePath, fileRole, code, issues, riskLevel, language } = request;

  // Limit issues to prevent prompt overflow
  const limitedIssues = issues?.slice(0, MAX_ISSUES_PER_REQUEST) || [];
  const totalIssues = issues?.length || 0;
  const wasLimited = totalIssues > MAX_ISSUES_PER_REQUEST;

  // Format issues for display
  const issuesText =
    limitedIssues.length > 0
      ? limitedIssues
          .map(
            (i, idx) =>
              `#${idx + 1}: [${i.severity?.toUpperCase() || 'UNKNOWN'}] ${i.message} (line ${i.line}${i.ruleId ? `, rule: ${i.ruleId}` : ''})`
          )
          .join('\n')
      : 'No structured issues provided. Scan for common problems: unused imports, console.logs, type issues.';

  // Add line numbers to code
  const lines = code.split('\n');
  const numberedCode = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');

  // Build context
  let context = `FILE: ${filePath}
ROLE: ${fileRole || 'TypeScript/React source file'}
LANGUAGE: ${language || 'ts'}

ISSUES TO FIX (${limitedIssues.length}${wasLimited ? ` of ${totalIssues} total` : ''}):
${issuesText}`;

  if (wasLimited) {
    context += `\n\nNOTE: ${totalIssues - MAX_ISSUES_PER_REQUEST} additional issues were omitted. Focus on fixing the listed issues.`;
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

// ============================================
// JSON Schema for OpenAI Response
// ============================================

const PATCH_RESPONSE_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    summary: { type: 'string' as const },
    patches: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          filePath: { type: 'string' as const },
          start: {
            type: 'object' as const,
            additionalProperties: false,
            properties: {
              line: { type: 'integer' as const },
              column: { type: 'integer' as const },
            },
            required: ['line', 'column'] as const,
          },
          end: {
            type: 'object' as const,
            additionalProperties: false,
            properties: {
              line: { type: 'integer' as const },
              column: { type: 'integer' as const },
            },
            required: ['line', 'column'] as const,
          },
          replacement: { type: 'string' as const },
          reason: { type: 'string' as const },
        },
        required: ['filePath', 'start', 'end', 'replacement', 'reason'] as const,
      },
    },
  },
  required: ['summary', 'patches'] as const,
};

// ============================================
// Main Cloud Function
// ============================================

export const aceAutoFix = onRequest(
  {
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: ['OPENAI_API_KEY'],
  },
  async (req, res) => {
    try {
      // Only accept POST requests
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed', patches: [], success: false });
        return;
      }

      // Parse request body
      const body = req.body as AceAutoFixRequest;
      const { filePath, code, issues, riskLevel = 'balanced', dryRun = false } = body;

      // Validate required fields
      if (!filePath || !code) {
        res.status(400).json({
          error: 'filePath and code are required',
          patches: [],
          success: false,
        });
        return;
      }

      logger.info('[ACE Backend] Auto-fix request received', {
        filePath,
        riskLevel,
        issuesCount: issues?.length ?? 0,
        codeLength: code.length,
        dryRun,
      });

      // Dry run: return analysis only, no patches
      if (dryRun) {
        const result: AceAutoFixResult = {
          patches: [],
          summary: 'Dry run only - analysis generated but no patches applied.',
          success: true,
        };
        res.json(result);
        return;
      }

      // Get OpenAI client
      const openai = getOpenAIClient();

      // Build prompts with risk level awareness
      const effectiveRiskLevel = (riskLevel as RiskLevel) || 'balanced';
      const systemPrompt = buildSystemPrompt(effectiveRiskLevel);
      const userPrompt = buildUserPrompt(body);

      // Log request details for debugging
      const issueCount = issues?.length ?? 0;
      const limitedIssueCount = Math.min(issueCount, MAX_ISSUES_PER_REQUEST);

      logger.info('[ACE Backend] Calling OpenAI', {
        filePath,
        riskLevel: effectiveRiskLevel,
        issuesReceived: issueCount,
        issuesProcessed: limitedIssueCount,
        codeLength: code.length,
        promptLength: systemPrompt.length + userPrompt.length,
      });

      // Call OpenAI with JSON response format
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4096,
        temperature: 0.3, // Slightly higher for more creative fixes
      });

      // Parse response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        logger.warn('[ACE Backend] No content in OpenAI response', { filePath });
        res.json({
          patches: [],
          summary: 'Model returned no content.',
          success: true,
        } as AceAutoFixResult);
        return;
      }

      let parsed: OpenAIPatchResponse;
      try {
        parsed = JSON.parse(content);
      } catch (parseErr) {
        logger.error('[ACE Backend] Failed to parse OpenAI response', {
          filePath,
          content: content.substring(0, 500),
          error: parseErr,
        });
        res.json({
          patches: [],
          summary: 'Model returned invalid JSON.',
          success: false,
          error: 'Failed to parse model response',
        } as AceAutoFixResult);
        return;
      }

      // Validate patches array
      if (!parsed.patches || !Array.isArray(parsed.patches)) {
        logger.warn('[ACE Backend] No patches array in response', { filePath, parsed });
        res.json({
          patches: [],
          summary: parsed.summary || 'No patches generated.',
          success: true,
        } as AceAutoFixResult);
        return;
      }

      // Map to AcePatch format
      const patches: AcePatch[] = parsed.patches.map((p) => ({
        filePath: p.filePath || filePath,
        start: p.start,
        end: p.end,
        replacement: p.replacement,
        reason: p.reason,
      }));

      // Phase 147.1: Validate patch generation
      // If we had issues but got 0 patches, mark as failure so client can react
      const hadIssues = (issues?.length ?? 0) > 0;
      const gotNoPatches = patches.length === 0;

      if (hadIssues && gotNoPatches) {
        logger.warn('[ACE Backend] Zero patches for non-empty issues', {
          filePath,
          issuesCount: issues?.length ?? 0,
          summary: parsed.summary,
          skippedReasons: (parsed as { skippedReasons?: string[] }).skippedReasons,
        });

        // Return success=false so client knows to possibly retry with different settings
        const result: AceAutoFixResult = {
          patches: [],
          summary: parsed.summary || 'Model could not generate any safe patches for the provided issues.',
          notes: (parsed as { skippedReasons?: string[] }).skippedReasons,
          success: false,
          error: 'NO_PATCHES_GENERATED',
        };
        res.json(result);
        return;
      }

      logger.info('[ACE Backend] Patches generated', {
        filePath,
        patchesCount: patches.length,
        summary: parsed.summary,
      });

      const result: AceAutoFixResult = {
        patches,
        summary: parsed.summary || `Generated ${patches.length} patches.`,
        notes: (parsed as { skippedReasons?: string[] }).skippedReasons,
        success: true,
      };

      res.json(result);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('[ACE Backend] Error in aceAutoFix', { error: err });

      res.status(500).json({
        error: 'ACE auto-fix failed',
        details: errorMessage,
        patches: [],
        success: false,
      } as AceAutoFixResult);
    }
  }
);

// ============================================
// Export Types
// ============================================

export type { AceAutoFixRequest, AceAutoFixResult, AcePatch, AceIssue };
