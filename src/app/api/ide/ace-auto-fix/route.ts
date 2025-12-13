// src/app/api/ide/ace-auto-fix/route.ts
// Phase 145.3.2 – ACE Auto-Fix Patch Generation API
// Phase 145.3.3 – Aggressive Prompts for Better Patch Generation
// Phase 145.3.4 – F0 ACE Expert Prompts with File Role Support
// This endpoint generates line-based patches for issues

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

// ============================================
// Types
// ============================================

type AceRiskLevel = 'conservative' | 'balanced' | 'aggressive';

interface AceAutoFixRequest {
  filePath: string;
  language: 'ts' | 'tsx' | 'js' | 'jsx' | 'json' | 'other';
  source: string;
  issues: Array<{
    id: string;
    ruleId?: string;
    message: string;
    line: number;
    column: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  /** Risk level from Quality Profile: conservative, balanced, aggressive */
  riskLevel?: AceRiskLevel;
  /** Phase 145.3.4: File role for context-aware fixes */
  fileRole?: string;
}

interface AceAutoFixPatch {
  id: string;           // issue id
  description: string;  // summary of what the patch fixes
  startLine: number;    // inclusive (1-indexed)
  endLine: number;      // inclusive (1-indexed)
  replacement: string;  // new code to replace the lines
}

interface AceAutoFixResponse {
  filePath: string;
  patches: AceAutoFixPatch[];
  notes?: string[];
}

// ============================================
// LLM Client (Lazy initialization to avoid build-time errors)
// ============================================

let _openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('[ACE AutoFix] OPENAI_API_KEY is not configured');
  }
  _openai = new OpenAI({ apiKey });
  return _openai;
}

// ============================================
// Phase 145.3.4: F0 ACE Expert Prompts
// ============================================

/**
 * F0 ACE System Prompt - Expert TypeScript/Electron architect
 */
const ACE_SYSTEM_PROMPT = `You are F0 ACE, a senior TypeScript/Electron architect and code quality expert.

Your job:
- Fix lint issues
- Improve code structure and readability
- Enforce TypeScript, security, and Electron best practices
- Keep the existing behavior identical (no breaking changes)

Important rules:
- NEVER change the public behavior or external API of the code.
- Prefer small, safe, incremental refactors over big rewrites.
- If something is ambiguous or risky to change, leave it and add a short comment instead.
- Prefer explicit types, clear names, and simple control flow.
- Keep comments that carry meaning, remove only useless noise comments.
- Do NOT introduce new external dependencies.
- Respect the project's existing style (formatting, naming, hooks patterns, etc.).
- Always return a list of patches instead of saying "no changes".
- If no lint issue is directly auto-fixable, still apply at least a few safe improvements (types, constants, log handling, etc.).

Security priorities:
- eval() MUST NOT be used. Replace with JSON.parse or add TODO comment.
- Avoid insecure file path or URL construction.
- In Electron: keep webPreferences secure (nodeIntegration: false, etc.).

Return ONLY valid JSON, no markdown.`;

/**
 * Phase 145.3.4: Infer file role from file path
 */
function inferFileRole(filePath: string): string {
  const path = filePath.toLowerCase();

  // Electron main process
  if (path.includes('electron/main') || path.includes('main.ts') && path.includes('electron')) {
    return 'Electron main process bootstrap file responsible for creating BrowserWindows, configuring webPreferences, wiring IPC, and loading the Desktop IDE front-end. Security and stability are critical.';
  }

  // Electron preload
  if (path.includes('preload')) {
    return 'Electron preload script that bridges main and renderer processes. Security is critical - must not expose dangerous APIs.';
  }

  // React components
  if (path.includes('/components/') || path.includes('.tsx')) {
    if (path.includes('panel')) return 'React UI panel component for the Desktop IDE interface.';
    if (path.includes('button')) return 'React button component.';
    if (path.includes('modal')) return 'React modal/dialog component.';
    return 'React UI component.';
  }

  // Hooks
  if (path.includes('/hooks/') || path.includes('use')) {
    return 'React custom hook providing reusable stateful logic.';
  }

  // State/Context
  if (path.includes('context') || path.includes('provider') || path.includes('/state/')) {
    return 'React context provider managing shared application state.';
  }

  // API routes
  if (path.includes('/api/')) {
    return 'Next.js API route handler.';
  }

  // Auto-fix related
  if (path.includes('autofix') || path.includes('auto-fix')) {
    return 'Auto-fix engine component responsible for code quality improvements.';
  }

  // Analysis/Quality
  if (path.includes('analysis') || path.includes('quality') || path.includes('lint')) {
    return 'Code quality analysis module.';
  }

  // Config files
  if (path.includes('config') || path.endsWith('.json')) {
    return 'Configuration file.';
  }

  // Default
  return 'TypeScript/JavaScript source file in the F0 Desktop IDE project.';
}

/**
 * Build user prompt with file context, issues, and detailed guidelines
 */
function buildAceUserPrompt(params: {
  filePath: string;
  language: string;
  numberedSource: string;
  issuesSummary: string;
  issuesJson: string;
  riskLevel: AceRiskLevel;
  fileRole: string;
}): string {
  const { filePath, language, numberedSource, issuesSummary, issuesJson, riskLevel, fileRole } = params;

  const riskInstructions = {
    conservative: 'Only fix issues that are 100% safe with no risk of changing behavior.',
    balanced: 'Fix issues that are clearly fixable. Skip ambiguous cases.',
    aggressive: 'Fix as many issues as possible. Take reasonable risks for better code.',
  };

  return `You are improving a single source file in a large TypeScript/Electron + React project.

**Project context:**
- Language: ${language}
- File path: ${filePath}
- File role: ${fileRole}

**Risk level:** ${riskLevel} - ${riskInstructions[riskLevel]}

We collected static analysis issues for this file from our code quality engine (ESLint + custom rules).

**SOURCE CODE WITH LINE NUMBERS:**
\`\`\`${language}
${numberedSource}
\`\`\`

**ISSUES TO FIX:**
${issuesSummary}

**Issues JSON:**
${issuesJson}

**Your goals:**
1. Fix as many issues as safely possible, especially:
   - security issues (like eval, insecure patterns, etc.)
   - best-practice issues (logging, error handling, etc.)
   - style issues that improve clarity & maintainability without changing behavior.

2. Keep behavior identical:
   - Do NOT change input/output types or function signatures in a breaking way.
   - Do NOT change logic branches or add new features.
   - You may only refactor in ways that preserve runtime behavior.

3. Apply these specific refactoring guidelines:
   - **Magic numbers**: Replace repeated magic numbers with named constants at the top of the file.
   - **TypeScript**: Add explicit return types for exported functions. Avoid using \`any\`.
   - **Logging**: Keep useful debug logs, guard noisy logs behind IS_DEV if pattern exists.
   - **Security**: eval() MUST NOT be used. Replace with JSON.parse or add TODO comment.

**RESPONSE FORMAT (JSON):**
{
  "patches": [
    {
      "id": "<issue_id>",
      "description": "Short description of what this patch fixes",
      "startLine": <number>,
      "endLine": <number>,
      "replacement": "<the replacement code for those lines>"
    }
  ],
  "notes": ["Short bullet notes of improvements made or why issues were skipped"]
}

**Guidelines for patches:**
- Prefer a small number of high-quality patches over many tiny ones.
- Each patch should fix ONE issue and be clearly described.
- If you truly cannot safely fix a specific issue, still provide at least one patch that improves the file.
- NEVER return an empty patches array when there are clear, fixable issues.`;
}

// ============================================
// ACE Auto-Fix Logic
// ============================================

async function generatePatches(input: AceAutoFixRequest): Promise<AceAutoFixResponse> {
  const { filePath, source, issues, language, riskLevel = 'balanced', fileRole } = input;

  if (issues.length === 0) {
    return {
      filePath,
      patches: [],
      notes: ['No issues provided'],
    };
  }

  // Add line numbers to source for reference
  const lines = source.split('\n');
  const numberedSource = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');

  // Build detailed issue summary (human readable)
  const issuesSummary = issues
    .map((i) => {
      const ruleInfo = i.ruleId ? ` [${i.ruleId}]` : '';
      return `- **${i.id}** (line ${i.line}, ${i.severity})${ruleInfo}: ${i.message}`;
    })
    .join('\n');

  // Build issues JSON for structured reference
  const issuesJson = JSON.stringify(issues, null, 2);

  // Determine file role (use provided or infer from path)
  const resolvedFileRole = fileRole || inferFileRole(filePath);

  // Map language code to readable name
  const languageMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript + React',
    js: 'JavaScript',
    jsx: 'JavaScript + React',
    json: 'JSON',
    other: 'TypeScript',
  };
  const readableLanguage = languageMap[language] || 'TypeScript';

  // Build the user prompt with all context
  const userPrompt = buildAceUserPrompt({
    filePath,
    language: readableLanguage,
    numberedSource,
    issuesSummary,
    issuesJson,
    riskLevel,
    fileRole: resolvedFileRole,
  });

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: ACE_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.1, // Slight creativity for better fixes
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content?.trim() ?? '{}';

    // Parse the JSON response
    let parsed: { patches?: AceAutoFixPatch[]; notes?: string[] };
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('[ACE AutoFix] Failed to parse JSON:', responseText);
      return {
        filePath,
        patches: [],
        notes: ['Failed to parse LLM response as JSON'],
      };
    }

    // Validate and clean patches
    const patches: AceAutoFixPatch[] = [];
    const notes: string[] = parsed.notes || [];

    if (Array.isArray(parsed.patches)) {
      for (const patch of parsed.patches) {
        // Validate required fields
        if (
          typeof patch.id !== 'string' ||
          typeof patch.startLine !== 'number' ||
          typeof patch.endLine !== 'number' ||
          typeof patch.replacement !== 'string'
        ) {
          notes.push(`Skipped invalid patch: ${JSON.stringify(patch).slice(0, 100)}`);
          continue;
        }

        // Validate line numbers
        if (patch.startLine < 1 || patch.endLine < patch.startLine || patch.endLine > lines.length) {
          notes.push(`Skipped patch with invalid line range: ${patch.startLine}-${patch.endLine}`);
          continue;
        }

        patches.push({
          id: patch.id,
          description: patch.description || `Fix issue ${patch.id}`,
          startLine: patch.startLine,
          endLine: patch.endLine,
          replacement: patch.replacement,
        });
      }
    }

    return {
      filePath,
      patches,
      notes: notes.length > 0 ? notes : undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown LLM error';
    console.error('[ACE AutoFix] LLM error:', message);
    return {
      filePath,
      patches: [],
      notes: [`LLM error: ${message}`],
    };
  }
}

// ============================================
// HTTP Handler
// ============================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as AceAutoFixRequest;

    // Validate required fields
    if (!body?.filePath) {
      return NextResponse.json(
        { filePath: '', patches: [], notes: ['Missing filePath'] },
        { status: 400 }
      );
    }

    if (!body?.source) {
      return NextResponse.json(
        { filePath: body.filePath, patches: [], notes: ['Missing source'] },
        { status: 400 }
      );
    }

    if (!body.issues?.length) {
      return NextResponse.json(
        { filePath: body.filePath, patches: [], notes: ['No issues to fix'] },
        { status: 200 }
      );
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { filePath: body.filePath, patches: [], notes: ['OpenAI API key not configured'] },
        { status: 500 }
      );
    }

    // Generate patches
    const result = await generatePatches(body);

    console.log(`[ACE AutoFix] Generated ${result.patches.length} patches for ${body.filePath}`);

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[ACE AutoFix HTTP] Error:', message);
    return NextResponse.json(
      { filePath: '', patches: [], notes: [message] },
      { status: 500 }
    );
  }
}
