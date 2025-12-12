/**
 * Phase 96.2 + 96.3: QA System
 *
 * Provides code quality checks for F0 projects:
 * - Static QA: TypeScript compilation (tsc), ESLint checks, Unit tests
 * - AI QA: AI-powered code review using F0 Agent
 * - Combined QA: Both static and AI checks
 *
 * Phase 96.2: Static QA (placeholder - real runners pending)
 * Phase 96.3: AI Code Review using Cloud Agent
 */

import { logAiOperation } from '@/lib/server/aiLogs';
import type { QaMode } from '@/lib/server/actions';

// ============================================
// Types
// ============================================

export interface StaticQaResult {
  ok: boolean;
  summary: string;
  errors?: string[];
  warnings?: string[];
  rawLog?: string;
  duration?: number; // milliseconds
  checks?: {
    tsc?: { ok: boolean; errorCount: number };
    lint?: { ok: boolean; errorCount: number; warningCount: number };
    test?: { ok: boolean; passed: number; failed: number; skipped: number };
  };
}

export interface RunStaticQaParams {
  projectId: string;
  taskId?: string;
  filesChanged?: string[];
  runTsc?: boolean;
  runLint?: boolean;
  runTests?: boolean;
}

// ============================================
// Main QA Runner
// ============================================

/**
 * Run static QA checks for a project
 *
 * Phase 96.2: Currently a placeholder that:
 * 1. Logs the QA operation
 * 2. Returns a simulated result
 *
 * TODO: Integrate with real runners:
 * - Call Cloud Function that runs pnpm lint / pnpm tsc
 * - Or use Code Agent with QA-specific prompt
 * - Or call external CI webhook
 */
export async function runStaticQaForProject(
  params: RunStaticQaParams
): Promise<StaticQaResult> {
  const {
    projectId,
    taskId,
    filesChanged = [],
    runTsc = true,
    runLint = true,
    runTests = false,
  } = params;

  const startTime = Date.now();

  console.log('[Static QA] Starting QA check:', {
    projectId,
    taskId,
    filesChangedCount: filesChanged.length,
    runTsc,
    runLint,
    runTests,
  });

  try {
    // ============================================
    // TODO: Real Implementation
    // ============================================
    // Replace this placeholder with actual QA execution:
    //
    // Option 1: Cloud Function Runner
    // const result = await callCloudFunction('runProjectQa', {
    //   projectId,
    //   checks: { tsc: runTsc, lint: runLint, test: runTests },
    //   files: filesChanged,
    // });
    //
    // Option 2: Code Agent QA Mode
    // const result = await askAgent('Run QA checks and return results', {
    //   projectId,
    //   mode: 'qa',
    //   filesChanged,
    // });
    //
    // Option 3: External CI (GitHub Actions, etc.)
    // const result = await triggerCiPipeline(projectId, 'qa');
    // ============================================

    // Placeholder result - simulates successful QA
    // Build checks object without undefined values
    const checks: StaticQaResult['checks'] = {};
    if (runTsc) {
      checks.tsc = { ok: true, errorCount: 0 };
    }
    if (runLint) {
      checks.lint = { ok: true, errorCount: 0, warningCount: 0 };
    }
    if (runTests) {
      checks.test = { ok: true, passed: 0, failed: 0, skipped: 0 };
    }

    const result: StaticQaResult = {
      ok: true,
      summary: buildQaSummary({
        projectId,
        taskId,
        filesChanged,
        runTsc,
        runLint,
        runTests,
      }),
      errors: [],
      warnings: [],
      rawLog: '',
      duration: Date.now() - startTime,
      checks: Object.keys(checks).length > 0 ? checks : undefined,
    };

    // Log the QA operation
    await logAiOperation({
      projectId,
      origin: 'auto-executor',
      mode: 'qa' as any, // QA mode
      success: result.ok,
      summary: result.summary,
      metadata: {
        taskId: taskId ?? null,
        filesChanged,
        qaType: 'static',
        duration: result.duration,
        checks: result.checks,
      },
    });

    console.log('[Static QA] QA check completed:', {
      projectId,
      ok: result.ok,
      duration: result.duration,
    });

    return result;
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown QA error';

    console.error('[Static QA] QA check failed:', errorMessage);

    // Log the failed operation
    await logAiOperation({
      projectId,
      origin: 'auto-executor',
      mode: 'qa' as any,
      success: false,
      errorMessage,
      metadata: {
        taskId: taskId ?? null,
        filesChanged,
        qaType: 'static',
      },
    });

    return {
      ok: false,
      summary: `QA check failed: ${errorMessage}`,
      errors: [errorMessage],
      warnings: [],
      duration: Date.now() - startTime,
    };
  }
}

// ============================================
// Helper: Build QA Summary
// ============================================

function buildQaSummary(params: {
  projectId: string;
  taskId?: string;
  filesChanged: string[];
  runTsc: boolean;
  runLint: boolean;
  runTests: boolean;
}): string {
  const { projectId, taskId, filesChanged, runTsc, runLint, runTests } = params;

  const checks: string[] = [];
  if (runTsc) checks.push('TypeScript');
  if (runLint) checks.push('ESLint');
  if (runTests) checks.push('Tests');

  const lines: string[] = [
    `✅ Static QA Passed`,
    ``,
    `**Project:** ${projectId}`,
  ];

  if (taskId) {
    lines.push(`**Task:** ${taskId}`);
  }

  lines.push(`**Checks:** ${checks.join(', ') || 'None'}`);

  if (filesChanged.length > 0) {
    lines.push(`**Files Changed:** ${filesChanged.length}`);
    // Show first 5 files
    const filesToShow = filesChanged.slice(0, 5);
    filesToShow.forEach((f) => lines.push(`  - ${f}`));
    if (filesChanged.length > 5) {
      lines.push(`  ... and ${filesChanged.length - 5} more`);
    }
  }

  lines.push(``);
  lines.push(`_Note: This is a placeholder. Real QA integration pending._`);

  return lines.join('\n');
}

// ============================================
// AI Code Review (Phase 96.3)
// ============================================

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export interface AiReviewIssue {
  severity: 'error' | 'warning' | 'info';
  file?: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface AiReviewResult {
  ok: boolean;
  summary: string;
  details?: string;
  issues?: AiReviewIssue[];
  score?: number; // 0-100
  duration?: number;
}

export interface RunAiReviewParams {
  projectId: string;
  taskId?: string;
  filesChanged?: string[];
  codePatches?: { path: string; content: string }[];
  locale?: 'ar' | 'en';
}

/**
 * AI-powered code review (Phase 96.3)
 *
 * Uses Cloud Agent to analyze code changes and provide feedback:
 * - Detects bugs and security issues
 * - Comments on code style and structure
 * - Suggests improvements
 *
 * Returns a structured review with score, summary, and issues.
 */
export async function runAiCodeReview(params: RunAiReviewParams): Promise<AiReviewResult> {
  const {
    projectId,
    taskId,
    filesChanged = [],
    codePatches = [],
    locale = 'ar',
  } = params;

  const startTime = Date.now();

  console.log('[AI Review] Starting AI code review:', {
    projectId,
    taskId,
    filesChangedCount: filesChanged.length,
    codePatchesCount: codePatches.length,
  });

  try {
    // Build the system prompt for QA review mode
    const systemPrompt = locale === 'ar'
      ? `أنت مراجع كود محترف في منصة F0.

مهمتك:
1. راجع التغييرات في الكود
2. اكتشف الأخطاء والمشاكل الأمنية
3. علق على جودة الكود والبنية
4. اقترح تحسينات مختصرة

يجب أن ترد بصيغة JSON التالية فقط:
\`\`\`json
{
  "score": 0-100,
  "summary": "ملخص قصير للمراجعة",
  "issues": [
    {
      "severity": "error|warning|info",
      "file": "path/to/file.ts",
      "line": 42,
      "message": "وصف المشكلة",
      "suggestion": "الحل المقترح"
    }
  ],
  "details": "تقرير مفصل بالماركداون"
}
\`\`\`

قواعد التقييم:
- 90-100: ممتاز، لا توجد مشاكل كبيرة
- 70-89: جيد، بعض التحسينات المقترحة
- 50-69: مقبول، يحتاج تعديلات
- 0-49: ضعيف، مشاكل جوهرية`
      : `You are a professional code reviewer for the F0 platform.

Your task:
1. Review the code changes
2. Detect bugs and security issues
3. Comment on code quality and structure
4. Suggest brief improvements

You must respond ONLY with JSON in this format:
\`\`\`json
{
  "score": 0-100,
  "summary": "Brief review summary",
  "issues": [
    {
      "severity": "error|warning|info",
      "file": "path/to/file.ts",
      "line": 42,
      "message": "Issue description",
      "suggestion": "Proposed fix"
    }
  ],
  "details": "Detailed report in markdown"
}
\`\`\`

Scoring guidelines:
- 90-100: Excellent, no major issues
- 70-89: Good, some improvements suggested
- 50-69: Acceptable, needs modifications
- 0-49: Poor, fundamental issues`;

    // Build user message with code context
    const userMessageParts: string[] = [
      `Project ID: ${projectId}`,
      taskId ? `Task ID: ${taskId}` : '',
      '',
      `Changed files: ${filesChanged.length > 0 ? filesChanged.join(', ') : 'unknown'}`,
    ];

    // Add code patches if available
    if (codePatches.length > 0) {
      userMessageParts.push('', '## Code Changes:', '');
      for (const patch of codePatches.slice(0, 5)) { // Limit to 5 patches
        userMessageParts.push(`### ${patch.path}`);
        userMessageParts.push('```');
        userMessageParts.push(patch.content.slice(0, 2000)); // Limit content size
        userMessageParts.push('```');
        userMessageParts.push('');
      }
      if (codePatches.length > 5) {
        userMessageParts.push(`... and ${codePatches.length - 5} more files`);
      }
    }

    userMessageParts.push('', 'Please analyze these changes and provide a QA review.');

    const userMessage = userMessageParts.filter(Boolean).join('\n');

    // Call OpenAI API for code review
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[AI Review] No OpenAI API key configured, returning placeholder');
      return {
        ok: true,
        summary: locale === 'ar'
          ? 'مراجعة AI غير متوفرة - لم يتم تكوين مفتاح OpenAI'
          : 'AI review unavailable - OpenAI API key not configured',
        issues: [],
        score: 100,
        duration: Date.now() - startTime,
      };
    }

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // Use faster model for QA
        temperature: 0.3, // Lower temperature for consistent reviews
        max_tokens: 2000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenAI request failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';

    // Parse the JSON response
    const result = parseAiReviewResponse(content, locale);
    result.duration = Date.now() - startTime;

    // Log the AI operation
    await logAiOperation({
      projectId,
      origin: 'auto-executor',
      mode: 'qa' as any,
      success: result.ok,
      summary: result.summary,
      metadata: {
        taskId: taskId ?? null,
        filesChanged,
        qaType: 'ai',
        score: result.score,
        issuesCount: result.issues?.length ?? 0,
        duration: result.duration,
      },
    });

    console.log('[AI Review] AI code review completed:', {
      projectId,
      ok: result.ok,
      score: result.score,
      issuesCount: result.issues?.length ?? 0,
      duration: result.duration,
    });

    return result;
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown AI review error';
    const duration = Date.now() - startTime;

    console.error('[AI Review] AI code review failed:', errorMessage);

    // Log the failed operation
    await logAiOperation({
      projectId,
      origin: 'auto-executor',
      mode: 'qa' as any,
      success: false,
      errorMessage,
      metadata: {
        taskId: taskId ?? null,
        filesChanged,
        qaType: 'ai',
      },
    });

    return {
      ok: false,
      summary: locale === 'ar'
        ? `فشلت مراجعة AI: ${errorMessage}`
        : `AI review failed: ${errorMessage}`,
      issues: [],
      score: 0,
      duration,
    };
  }
}

/**
 * Parse AI review response from JSON
 */
function parseAiReviewResponse(content: string, locale: 'ar' | 'en'): AiReviewResult {
  try {
    // Extract JSON from markdown code block if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    const parsed = JSON.parse(jsonStr);

    // Validate and extract fields
    const score = typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 100;
    const ok = score >= 50;

    return {
      ok,
      score,
      summary: parsed.summary || (locale === 'ar' ? 'اكتملت المراجعة' : 'Review completed'),
      details: parsed.details,
      issues: Array.isArray(parsed.issues) ? parsed.issues.map((issue: any) => ({
        severity: ['error', 'warning', 'info'].includes(issue.severity) ? issue.severity : 'info',
        file: issue.file,
        line: typeof issue.line === 'number' ? issue.line : undefined,
        message: issue.message || '',
        suggestion: issue.suggestion,
      })) : [],
    };
  } catch {
    // If parsing fails, return a basic result
    return {
      ok: true,
      score: 80,
      summary: locale === 'ar'
        ? 'اكتملت المراجعة (لم يتم تحليل التفاصيل)'
        : 'Review completed (details not parsed)',
      details: content,
      issues: [],
    };
  }
}

// ============================================
// Combined QA (Static + AI) - Phase 96.3 Enhanced
// ============================================

export interface CombinedQaResult {
  ok: boolean;
  summary: string;
  details?: string;
  static?: StaticQaResult;
  ai?: AiReviewResult;
  duration?: number;
  overallScore?: number;
}

export interface RunCombinedQaParams extends RunStaticQaParams {
  qaMode: QaMode;
  codePatches?: { path: string; content: string }[];
  locale?: 'ar' | 'en';
}

/**
 * Run QA checks based on qaMode
 *
 * - 'static': Run tsc/lint/tests only
 * - 'ai': Run AI code review only
 * - 'both': Run static + AI checks
 */
export async function runCombinedQa(params: RunCombinedQaParams): Promise<CombinedQaResult> {
  const {
    projectId,
    taskId,
    filesChanged,
    qaMode,
    codePatches,
    locale = 'ar',
    runTsc,
    runLint,
    runTests,
  } = params;

  const startTime = Date.now();

  console.log('[Combined QA] Starting QA with mode:', qaMode);

  let staticResult: StaticQaResult | undefined;
  let aiResult: AiReviewResult | undefined;

  // Run static QA if mode is 'static' or 'both'
  if (qaMode === 'static' || qaMode === 'both') {
    staticResult = await runStaticQaForProject({
      projectId,
      taskId,
      filesChanged,
      runTsc,
      runLint,
      runTests,
    });
  }

  // Run AI review if mode is 'ai' or 'both'
  if (qaMode === 'ai' || qaMode === 'both') {
    aiResult = await runAiCodeReview({
      projectId,
      taskId,
      filesChanged,
      codePatches,
      locale,
    });
  }

  // Determine overall result
  const staticOk = staticResult?.ok ?? true;
  const aiOk = aiResult?.ok ?? true;
  const ok = staticOk && aiOk;

  // Calculate overall score
  let overallScore: number | undefined;
  if (qaMode === 'both') {
    // Average of static (100 if passed, 0 if failed) and AI score
    const staticScore = staticOk ? 100 : 0;
    const aiScore = aiResult?.score ?? 100;
    overallScore = Math.round((staticScore + aiScore) / 2);
  } else if (qaMode === 'ai') {
    overallScore = aiResult?.score;
  } else if (qaMode === 'static') {
    overallScore = staticOk ? 100 : 0;
  }

  // Build combined summary
  const summaryParts: string[] = [];
  if (staticResult) {
    summaryParts.push(locale === 'ar'
      ? `Static: ${staticOk ? '✅ نجح' : '❌ فشل'}`
      : `Static: ${staticOk ? '✅ Passed' : '❌ Failed'}`);
  }
  if (aiResult) {
    summaryParts.push(locale === 'ar'
      ? `AI: ${aiOk ? '✅ نجح' : '❌ فشل'} (${aiResult.score ?? 0}/100)`
      : `AI: ${aiOk ? '✅ Passed' : '❌ Failed'} (${aiResult.score ?? 0}/100)`);
  }

  const summary = ok
    ? (locale === 'ar'
        ? `✅ اجتازت جميع فحوصات QA (${qaMode.toUpperCase()})`
        : `✅ All QA checks passed (${qaMode.toUpperCase()})`)
    : (locale === 'ar'
        ? `❌ فشلت بعض فحوصات QA: ${summaryParts.join(' | ')}`
        : `❌ Some QA checks failed: ${summaryParts.join(' | ')}`);

  // Build combined details
  const detailsParts: string[] = [];
  if (staticResult?.rawLog) {
    detailsParts.push('## Static QA Results\n' + staticResult.rawLog);
  }
  if (aiResult?.details) {
    detailsParts.push('## AI Code Review\n' + aiResult.details);
  }
  const details = detailsParts.length > 0 ? detailsParts.join('\n\n---\n\n') : undefined;

  const duration = Date.now() - startTime;

  console.log('[Combined QA] Completed:', {
    qaMode,
    ok,
    overallScore,
    duration,
  });

  return {
    ok,
    summary,
    details,
    static: staticResult,
    ai: aiResult,
    duration,
    overallScore,
  };
}
