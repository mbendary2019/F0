// desktop/src/autoFix/engines/desktopIssuesEngine.ts
// Phase 143.0 – Desktop Issue Engine using batchApplyIssueFix
// Phase 144.0 – Updated to send full issue objects + source to main process

import {
  AutoFixEngine,
  AutoFixEngineResult,
  AutoFixIssueError,
  AutoFixEngineType,
  IDEIssue,
  FilePatch,
  isOutOfScopeFile,
} from '../autoFixTypes';

/**
 * Phase 144.0: Full issue format expected by main process batchApplyIssueFix
 */
type F0IssueForFix = {
  id: string;
  severity: 'info' | 'warning' | 'error';
  category: 'logic' | 'security' | 'performance' | 'style' | 'best-practice';
  message: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  fixPrompt?: string;
  suggestedFix?: string | null;
};

type DesktopBatchResult = {
  success: boolean;
  filePath?: string;
  fixedSource?: string;
  appliedIssueIds?: string[];
  skippedIssueIds?: string[];
  summary?: string;
  error?: string;
};

/**
 * Helper: Read file content via f0Desktop bridge
 */
async function readFileContent(filePath: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyWindow = window as any;
  const api = anyWindow.f0Desktop || anyWindow.f0DesktopAPI || anyWindow.f0DesktopApp;

  if (!api || typeof api.readFile !== 'function') {
    console.warn('[DesktopIssuesEngine] readFile not available in preload');
    return null;
  }

  try {
    const content = await api.readFile(filePath);
    return content;
  } catch (err) {
    console.error('[DesktopIssuesEngine] Failed to read file:', filePath, err);
    return null;
  }
}

/**
 * Helper: Convert IDEIssue to F0IssueForFix format
 */
function convertToF0Issue(issue: IDEIssue): F0IssueForFix {
  // Map IssueKind to category
  const categoryMap: Record<string, F0IssueForFix['category']> = {
    typescript: 'logic',
    eslint: 'style',
    security: 'security',
    test: 'logic',
    performance: 'performance',
    style: 'style',
    unknown: 'best-practice',
  };

  return {
    id: issue.id,
    severity: issue.severity === 'critical' ? 'error' : issue.severity,
    category: categoryMap[issue.kind] || 'best-practice',
    message: issue.message,
    file: issue.filePath,
    lineStart: issue.line ?? 1,
    lineEnd: issue.line ?? 1,
    fixPrompt: undefined,
    suggestedFix: null,
  };
}

/**
 * Helper: يستدعي batchApplyIssueFix من f0DesktopAPI.
 * Phase 144.0: Updated to send full payload with source + issues objects.
 */
async function callDesktopBatchFix(
  filePath: string,
  source: string,
  issues: F0IssueForFix[]
): Promise<DesktopBatchResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyWindow = window as any;
  const api = anyWindow.f0Desktop || anyWindow.f0DesktopAPI || anyWindow.f0DesktopApp;

  if (!api || typeof api.batchApplyIssueFix !== 'function') {
    console.warn('[DesktopIssuesEngine] batchApplyIssueFix not available in preload');
    return {
      success: false,
      appliedIssueIds: [],
      skippedIssueIds: issues.map((i) => i.id),
      error: 'Desktop batchApplyIssueFix not available',
    };
  }

  const payload = {
    filePath,
    source,
    issues,
  };

  try {
    console.log('[DesktopIssuesEngine] Calling batchApplyIssueFix with', issues.length, 'issues for', filePath);
    const res = await api.batchApplyIssueFix(payload);
    console.log('[DesktopIssuesEngine] batchApplyIssueFix result:', res);
    return res as DesktopBatchResult;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[DesktopIssuesEngine] batchApplyIssueFix failed:', err);
    return {
      success: false,
      appliedIssueIds: [],
      skippedIssueIds: issues.map((i) => i.id),
      error: `batchApplyIssueFix failed: ${errorMessage}`,
    };
  }
}

/**
 * بيستخدم desktop batchApplyIssueFix لإصلاح issues بالـ IDs.
 * نستخدمه كـ Engine واحد تحت type 'ts' و 'eslint' (هنسجّل نفس الـ engine مرتين).
 * Phase 143.5: Updated to group issues by filePath and call batchApplyIssueFix per file.
 * Phase 144.0: Now reads source and converts issues to full F0Issue format.
 */
function createDesktopIssuesEngine(engineType: AutoFixEngineType): AutoFixEngine {
  const type = engineType;

  return {
    type,
    async run(opts: { issues: IDEIssue[]; dryRun?: boolean }): Promise<AutoFixEngineResult> {
      const issues = opts.issues;

      console.log(`[DesktopIssuesEngine:${type}] Running for`, issues.length, 'issues');

      if (issues.length === 0) {
        return { patches: [], fixedIssueIds: [], errors: [] };
      }

      if (opts.dryRun) {
        // Dry-run → لسه مش بنطلب أي حاجة من الـ backend
        console.log(`[DesktopIssuesEngine:${type}] Dry run, skipping actual fix`);
        return { patches: [], fixedIssueIds: [], errors: [] };
      }

      // 1) نجمع issues لكل filePath
      const byFile = new Map<string, IDEIssue[]>();

      for (const issue of issues) {
        if (!issue.filePath) continue;
        if (!byFile.has(issue.filePath)) {
          byFile.set(issue.filePath, []);
        }
        byFile.get(issue.filePath)!.push(issue);
      }

      const patches: FilePatch[] = [];
      const fixedIssueIds: string[] = [];
      const errors: AutoFixIssueError[] = [];

      // 2) نندي batchApplyIssueFix لكل ملف لوحده
      for (const [filePath, fileIssues] of byFile.entries()) {
        console.log(`[DesktopIssuesEngine:${type}] Processing file:`, filePath, 'with', fileIssues.length, 'issues');

        // Phase 144.3: Check if file is out of scope (compiled/backup)
        if (isOutOfScopeFile(filePath)) {
          console.log(`[DesktopIssuesEngine:${type}] Skipping out-of-scope file:`, filePath);
          errors.push(
            ...fileIssues.map((i) => ({
              issueId: i.id,
              filePath,
              ruleId: i.ruleId,
              reason: 'OUT_OF_SCOPE' as const,
              message: 'Compiled or backup file - auto-fix disabled',
            }))
          );
          continue;
        }

        // Read file content
        const source = await readFileContent(filePath);
        if (!source) {
          console.warn(`[DesktopIssuesEngine:${type}] Could not read file:`, filePath);
          errors.push(
            ...fileIssues.map((i) => ({
              issueId: i.id,
              filePath,
              ruleId: i.ruleId,
              reason: 'FILE_NOT_FOUND' as const,
              message: `Could not read file: ${filePath}`,
            }))
          );
          continue;
        }

        // Convert IDEIssue to F0IssueForFix format
        const f0Issues = fileIssues.map(convertToF0Issue);

        const res = await callDesktopBatchFix(filePath, source, f0Issues);

        if (res.appliedIssueIds?.length) {
          fixedIssueIds.push(...res.appliedIssueIds);
        }

        // Skipped issues become errors with enhanced reason
        if (res.skippedIssueIds?.length) {
          errors.push(
            ...res.skippedIssueIds.map((id) => {
              const issue = fileIssues.find((i) => i.id === id);
              return {
                issueId: id,
                filePath,
                ruleId: issue?.ruleId,
                reason: 'NO_FIXER' as const,
                message: res.error || 'No auto-fix pattern available for this rule',
              };
            })
          );
        }

        // لو رجع fixedSource → نعتبره patch للملف كله
        if (res.success && res.fixedSource != null && res.fixedSource !== source) {
          patches.push({
            filePath,
            before: source,
            after: res.fixedSource,
          });
        }
      }

      console.log(
        `[DesktopIssuesEngine:${type}] Completed:`,
        fixedIssueIds.length,
        'fixed,',
        patches.length,
        'patches,',
        errors.length,
        'errors'
      );

      return { patches, fixedIssueIds, errors };
    },
  };
}

/**
 * Helper للتسجيل: بنسجّل نفس الـ engine لاثنين:
 *  - 'ts'
 *  - 'eslint'
 * بحيث أي issue من النوعين دول يروح لنفس الباكند.
 */
export function registerDesktopIssueEngines(
  register: (engine: AutoFixEngine) => void
): void {
  console.log('[DesktopIssuesEngine] Registering desktop issue engines...');

  // Engine للـ TypeScript issues
  register(createDesktopIssuesEngine('ts'));

  // Engine للـ ESLint/style issues
  register(createDesktopIssuesEngine('eslint'));

  // Engine للـ generic issues (fallback)
  register(createDesktopIssuesEngine('generic'));

  console.log('[DesktopIssuesEngine] Registered ts, eslint, generic engines');
}

/**
 * Export individual engine creator for custom use
 */
export { createDesktopIssuesEngine };
