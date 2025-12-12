// desktop/src/autoFix/autoFixOrchestrator.ts
// Phase 141.1 – Issue Classifier & Plan Builder
// Phase 142.2 – Engine Registry & executeAutoFixPlan with real engine calls
// Phase 144.3 – Added backup creation and stats tracking
// Phase 145.3.4 – F0 ACE Expert Prompts with File Role Support
// Phase 147 – ACE Auto-Fix Cloud Function Integration

import {
  AutoFixEngine,
  AutoFixEngineType,
  AutoFixIssueError,
  AutoFixPlan,
  AutoFixRequest,
  AutoFixResult,
  AutoFixBackupSession,
  FilePatch,
  IDEIssue,
} from './autoFixTypes';

/**
 * يحاول يستنتج نوع الـ issue لو مش متحدد.
 * ممكن نطوّرها لاحقًا بنماذج ML أو patterns أدق.
 */
export function inferIssueKind(
  issue: IDEIssue['message'] | IDEIssue
): IDEIssue['kind'] {
  const message = typeof issue === 'string' ? issue : issue.message;

  const msg = message.toLowerCase();

  if (
    msg.includes('ts') ||
    msg.includes('typescript') ||
    msg.includes('type') ||
    msg.includes('cannot assign') ||
    (msg.includes('property') && msg.includes('does not exist'))
  ) {
    return 'typescript';
  }

  if (
    msg.includes('eslint') ||
    msg.includes('lint') ||
    msg.includes('unused') ||
    msg.includes('no-') // like no-unused-vars, no-console...
  ) {
    return 'eslint';
  }

  if (
    msg.includes('xss') ||
    msg.includes('sql injection') ||
    msg.includes('csrf') ||
    msg.includes('security') ||
    msg.includes('vulnerability') ||
    msg.includes('secret') ||
    msg.includes('token exposed') ||
    msg.includes('sensitive')
  ) {
    return 'security';
  }

  if (
    msg.includes('test') ||
    msg.includes('failing test') ||
    msg.includes('jest') ||
    msg.includes('coverage')
  ) {
    return 'test';
  }

  if (
    msg.includes('slow') ||
    msg.includes('performance') ||
    msg.includes('optimize') ||
    msg.includes('expensive')
  ) {
    return 'performance';
  }

  if (
    msg.includes('style') ||
    msg.includes('prettier') ||
    msg.includes('format') ||
    msg.includes('spacing')
  ) {
    return 'style';
  }

  return 'unknown';
}

/**
 * يحدد أنهى Engine هيهاندل نوع الـ issue.
 */
export function getEngineForIssueKind(
  kind: IDEIssue['kind']
): AutoFixEngineType {
  switch (kind) {
    case 'typescript':
      return 'ts';
    case 'eslint':
    case 'style':
      return 'eslint';
    case 'security':
      return 'security';
    case 'test':
      return 'tests';
    default:
      return 'generic';
  }
}

/**
 * يبني Auto-Fix Plan من لستة issues.
 * هنا مفيش أي Calls للـ Agents. ده بس Planning.
 */
export function buildAutoFixPlan(req: AutoFixRequest): AutoFixPlan {
  const routesByEngine = new Map<AutoFixEngineType, Set<string>>();
  const unsupported: string[] = [];

  for (const issue of req.issues) {
    // 1) تأكد إن عندنا kind
    const kind =
      issue.kind && issue.kind !== 'unknown'
        ? issue.kind
        : inferIssueKind(issue);

    // 2) لو مش fixable → اعتبره unsupported
    if (issue.fixable === false) {
      unsupported.push(issue.id);
      continue;
    }

    const engine = getEngineForIssueKind(kind);

    if (!routesByEngine.has(engine)) {
      routesByEngine.set(engine, new Set<string>());
    }

    routesByEngine.get(engine)!.add(issue.id);
  }

  const routes = Array.from(routesByEngine.entries())
    .map(([engine, ids]) => ({
      engine,
      issueIds: Array.from(ids),
    }))
    // رتب حسب نوع الـ engine عشان الـ logs تبقى ثابتة
    .sort((a, b) => a.engine.localeCompare(b.engine));

  return {
    routes,
    unsupportedIssueIds: unsupported,
  };
}

// ============================================================================
// Phase 142.2: Engine Registry
// ============================================================================

/** Registry بسيط للـ Engines */
const enginesRegistry = new Map<AutoFixEngineType, AutoFixEngine>();

/**
 * تسجيل Engine جديد في الـ registry
 */
export function registerAutoFixEngine(engine: AutoFixEngine): void {
  console.log('[AutoFixOrchestrator] Registering engine:', engine.type);
  enginesRegistry.set(engine.type, engine);
}

/**
 * إلغاء تسجيل Engine
 */
export function unregisterAutoFixEngine(type: AutoFixEngineType): void {
  enginesRegistry.delete(type);
}

/**
 * الحصول على Engine من الـ registry
 */
export function getEngine(type: AutoFixEngineType): AutoFixEngine | undefined {
  return enginesRegistry.get(type);
}

/**
 * عرض كل الـ engines المسجّلة
 */
export function getRegisteredEngines(): AutoFixEngineType[] {
  return Array.from(enginesRegistry.keys());
}

// ============================================================================
// Phase 142.2: Execute Plan with Engine calls
// ============================================================================

/**
 * Phase 144.3: Create backup helper
 * Phase 144.4.4: Soft fallback - try multiple API paths
 */
async function createBackup(patches: FilePatch[]): Promise<AutoFixBackupSession | null> {
  if (patches.length === 0) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = (typeof window !== 'undefined' ? (window as any).f0Desktop || (window as any).f0DesktopAPI : null);

  // Phase 144.4.4: Try nested autoFix.createBackup first, then flat createAutoFixBackup
  const createFn = api?.autoFix?.createBackup || api?.createAutoFixBackup;

  if (!createFn) {
    // Phase 144.4.4: Soft fallback - warn but don't fail the auto-fix
    console.warn('[AutoFixOrchestrator] Backup API not available - proceeding without backup');
    console.warn('[AutoFixOrchestrator] Auto-fix will continue, but rollback will not be available');
    return null;
  }

  try {
    const result = await createFn({ patches });
    if (result.success && result.session) {
      console.log('[AutoFixOrchestrator] Backup created:', result.session.timestamp);
      return result.session;
    }
    if (!result.success) {
      console.warn('[AutoFixOrchestrator] Backup creation failed:', result.error || 'Unknown error');
    }
  } catch (err) {
    console.error('[AutoFixOrchestrator] Failed to create backup:', err);
  }

  return null;
}

/**
 * ينفّذ الـ Plan باستخدام الـ engines المسجّلة في الـ registry.
 * يجمع الـ patches من كل engine ويرجّعها للـ caller.
 * Phase 144.3: Added backup creation and stats tracking
 */
export async function executeAutoFixPlan(
  req: AutoFixRequest,
  plan: AutoFixPlan
): Promise<AutoFixResult> {
  const startTime = Date.now();
  const fixedIssueIds: string[] = [];
  const skippedIssueIds: string[] = [...plan.unsupportedIssueIds];
  const errors: AutoFixIssueError[] = [];
  const allPatches: FilePatch[] = [];
  let outOfScopeCount = 0;
  let noFixerCount = 0;

  // Build a map of issues by ID for quick lookup
  const issuesById = new Map<string, IDEIssue>();
  for (const issue of req.issues) {
    issuesById.set(issue.id, issue);
  }

  // Process each route
  for (const route of plan.routes) {
    const engine = getEngine(route.engine);

    if (!engine) {
      console.warn(
        '[AutoFixOrchestrator] No engine registered for',
        route.engine,
        '- skipping issues:',
        route.issueIds.length
      );
      skippedIssueIds.push(...route.issueIds);
      continue;
    }

    // Gather issues for this route
    const routeIssues = route.issueIds
      .map((id) => issuesById.get(id))
      .filter((i): i is IDEIssue => !!i);

    if (routeIssues.length === 0) {
      continue;
    }

    console.log(
      '[AutoFixOrchestrator] Running engine',
      route.engine,
      'on',
      routeIssues.length,
      'issues'
    );

    try {
      const result = await engine.run({
        issues: routeIssues,
        dryRun: !!req.dryRun,
      });

      // Collect results
      allPatches.push(...result.patches);
      fixedIssueIds.push(...result.fixedIssueIds);
      errors.push(...result.errors);

      // Any issue in the route not in fixedIssueIds or errors → skipped
      const fixedSet = new Set(result.fixedIssueIds);
      const errorSet = new Set(result.errors.map((e) => e.issueId));

      for (const id of route.issueIds) {
        if (!fixedSet.has(id) && !errorSet.has(id)) {
          skippedIssueIds.push(id);
        }
      }

      console.log(
        '[AutoFixOrchestrator] Engine',
        route.engine,
        'completed:',
        result.fixedIssueIds.length,
        'fixed,',
        result.patches.length,
        'patches'
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        '[AutoFixOrchestrator] Engine run failed for',
        route.engine,
        errorMessage
      );

      // If engine crashes, mark all issues in route as errors
      for (const id of route.issueIds) {
        const issue = issuesById.get(id);
        errors.push({
          issueId: id,
          filePath: issue?.filePath ?? '',
          ruleId: issue?.ruleId,
          reason: 'FIXER_ERROR' as const,
          message: `Engine ${route.engine} crashed: ${errorMessage}`,
        });
      }
    }
  }

  console.log(
    '[AutoFixOrchestrator] Plan execution complete:',
    fixedIssueIds.length,
    'fixed,',
    skippedIssueIds.length,
    'skipped,',
    errors.length,
    'errors,',
    allPatches.length,
    'patches'
  );

  // Phase 144.3: Create backup before returning results
  let backupSession: AutoFixBackupSession | null = null;
  if (allPatches.length > 0 && !req.dryRun) {
    backupSession = await createBackup(allPatches);
  }

  // Phase 144.3: Count error reasons for stats
  for (const err of errors) {
    if (err.reason === 'OUT_OF_SCOPE') outOfScopeCount++;
    if (err.reason === 'NO_FIXER') noFixerCount++;
  }

  const durationMs = Date.now() - startTime;

  return {
    fixedIssueIds,
    skippedIssueIds,
    errors,
    patches: allPatches,
    backupSession,
    stats: {
      totalIssues: req.issues.length,
      fixedCount: fixedIssueIds.length,
      skippedCount: skippedIssueIds.length,
      errorCount: errors.length,
      outOfScopeCount,
      noFixerCount,
      durationMs,
    },
  };
}

// ============================================================================
// Phase 145.1: ACE Auto-Fix Orchestrator
// ============================================================================

import type {
  AceAutoFixRequest,
  AceAutoFixResponse,
  AceAutoFixResult,
  AceRiskLevel,
} from './aceAutoFixTypes';

/**
 * Phase 145.1.4: Guess language from file path
 */
export function guessLanguageFromPath(filePath: string): AceAutoFixRequest['language'] {
  if (filePath.endsWith('.tsx')) return 'tsx';
  if (filePath.endsWith('.ts')) return 'ts';
  if (filePath.endsWith('.jsx')) return 'jsx';
  if (filePath.endsWith('.js')) return 'js';
  if (filePath.endsWith('.json')) return 'json';
  return 'other';
}

/**
 * Phase 145.1.4: Map severity to ACE format
 */
export function mapSeverityToAce(
  sev: number | string | 'info' | 'warning' | 'error'
): 'low' | 'medium' | 'high' {
  if (sev === 2 || sev === 'error' || sev === 'high') return 'high';
  if (sev === 1 || sev === 'warning' || sev === 'warn' || sev === 'medium') return 'medium';
  return 'low';
}

/**
 * Phase 145.3.2: Map context severity to ACE format (for IssueData)
 */
function mapContextSeverityToAce(sev: 'info' | 'warning' | 'error'): 'low' | 'medium' | 'high' {
  if (sev === 'error') return 'high';
  if (sev === 'warning') return 'medium';
  return 'low';
}

// ============================================================================
// Phase 145.3.4: F0 ACE Expert Prompts for Orchestrator
// ============================================================================

/**
 * Phase 145.3.4: Infer file role from file path
 * Used to provide context-aware fix suggestions
 */
export function inferFileRole(filePath: string): string {
  const path = filePath.toLowerCase();

  // Electron main process
  if (path.includes('electron/main') || (path.includes('main.ts') && path.includes('electron'))) {
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
 * Phase 145.3.4: Issue type for prompt building
 */
type ProjectIssue = {
  id: string;
  message: string;
  line: number;
  column?: number;
  severity: 'low' | 'medium' | 'high';
  ruleId?: string;
};

/**
 * Phase 145.3.4: Build ACE Auto-Fix Prompt
 * Generates rich prompts with file context for better patch generation
 */
export function buildAceAutoFixPrompt(params: {
  filePath: string;
  language: string;
  fileRole: string;
  source: string;
  issues: ProjectIssue[];
  riskLevel?: AceRiskLevel;
}): { systemPrompt: string; userPrompt: string } {
  const { filePath, language, fileRole, source, issues, riskLevel = 'balanced' } = params;

  // Add line numbers to source for reference
  const lines = source.split('\n');
  const numberedSource = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');

  // Build issue summary (human readable)
  const issuesSummary = issues
    .map((i) => {
      const ruleInfo = i.ruleId ? ` [${i.ruleId}]` : '';
      return `- **${i.id}** (line ${i.line}, ${i.severity})${ruleInfo}: ${i.message}`;
    })
    .join('\n');

  // Build issues JSON for structured reference
  const issuesJson = JSON.stringify(issues, null, 2);

  // Map language code to readable name
  const languageMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript + React',
    js: 'JavaScript',
    jsx: 'JavaScript + React',
    json: 'JSON',
    other: 'TypeScript',
  };
  const readableLanguage = languageMap[language] || language;

  // Risk level instructions
  const riskInstructions = {
    conservative: 'Only fix issues that are 100% safe with no risk of changing behavior.',
    balanced: 'Fix issues that are clearly fixable. Skip ambiguous cases.',
    aggressive: 'Fix as many issues as possible. Take reasonable risks for better code.',
  };

  // System prompt - F0 ACE expert
  const systemPrompt = `You are F0 ACE, a senior TypeScript/Electron architect and code quality expert.

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

  // User prompt with full context
  const userPrompt = `You are improving a single source file in a large TypeScript/Electron + React project.

**Project context:**
- Language: ${readableLanguage}
- File path: ${filePath}
- File role: ${fileRole}

**Risk level:** ${riskLevel} - ${riskInstructions[riskLevel]}

We collected static analysis issues for this file from our code quality engine (ESLint + custom rules).

**SOURCE CODE WITH LINE NUMBERS:**
\`\`\`${readableLanguage}
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

  return { systemPrompt, userPrompt };
}

/**
 * Phase 145.1.3: Run ACE Auto-Fix on a single file
 * This is the main entry point for ACE-powered auto-fix
 * Phase 145.3.3: Added riskLevel support
 */
export async function runAceAutoFixOnFile(
  filePath: string,
  source: string,
  issues: Array<{
    id: string;
    ruleId?: string;
    message: string;
    line: number;
    column?: number;
    severity: number | string | 'info' | 'warning' | 'error';
  }>,
  options?: {
    projectRoot?: string;
    createBackup?: boolean;
    riskLevel?: AceRiskLevel;
  }
): Promise<AceAutoFixResult> {
  const startTime = Date.now();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = typeof window !== 'undefined' ? (window as any).f0Desktop : null;

  if (!api) {
    return {
      success: false,
      filePath,
      appliedPatches: 0,
      skippedPatches: 0,
      errors: ['Desktop API not available'],
    };
  }

  // Phase 145.3.4: Infer file role for context-aware fixes
  const fileRole = inferFileRole(filePath);
  const language = guessLanguageFromPath(filePath);
  const riskLevel = options?.riskLevel || 'balanced';

  // Phase 145.3.4: Build rich prompts using the helper
  const aceIssues = issues.map((i) => ({
    id: i.id,
    ruleId: i.ruleId,
    message: i.message,
    line: i.line,
    column: i.column ?? 1,
    severity: mapSeverityToAce(i.severity),
  }));

  const { systemPrompt, userPrompt } = buildAceAutoFixPrompt({
    filePath,
    language,
    fileRole,
    source,
    issues: aceIssues,
    riskLevel,
  });

  // Build the ACE request (Phase 145.3.3: with riskLevel, Phase 145.3.4: with fileRole)
  const payload: AceAutoFixRequest = {
    filePath,
    language,
    source,
    issues: aceIssues,
    riskLevel,
  };

  console.log('[ACE Orchestrator] Running ACE Auto-Fix on:', filePath);
  console.log('[ACE Orchestrator] File role:', fileRole);
  console.log('[ACE Orchestrator] Issues:', issues.length);
  console.log('[ACE Orchestrator] Risk level:', riskLevel);
  console.log('[ACE Orchestrator] Prompt length:', systemPrompt.length + userPrompt.length, 'chars');

  try {
    // Step 1: Create backup if requested
    if (options?.createBackup !== false && api.autoFix?.createBackup) {
      try {
        await api.autoFix.createBackup({
          patches: [{ filePath, before: source, after: source }],
          projectRoot: options?.projectRoot,
        });
        console.log('[ACE Orchestrator] Backup created');
      } catch (backupErr) {
        console.warn('[ACE Orchestrator] Backup failed (continuing):', backupErr);
      }
    }

    // Step 2: Call ACE backend
    const callFn = api.callAceAutoFix;
    if (!callFn) {
      return {
        success: false,
        filePath,
        appliedPatches: 0,
        skippedPatches: 0,
        errors: ['callAceAutoFix API not available'],
      };
    }

    const result: AceAutoFixResponse = await callFn(payload);
    console.log('[ACE Orchestrator] ACE returned:', result.patches.length, 'patches');

    if (result.patches.length === 0) {
      return {
        success: true,
        filePath,
        appliedPatches: 0,
        skippedPatches: 0,
        errors: [],
        notes: result.notes || ['No patches generated'],
      };
    }

    // Step 3: Apply patches to file - Phase 184: Actually write patches to disk
    let appliedCount = 0;
    let skippedCount = 0;
    const patchErrors: string[] = [];
    let currentSource = source;

    // Phase 184.4: Apply patches using LINE-BASED replacement
    // ACE patches have: startLine, endLine, replacement (NOT before/after)
    // Sort patches by startLine descending so we apply from bottom to top
    // This prevents line number shifting issues
    const sortedPatches = [...result.patches].sort((a, b) => b.startLine - a.startLine);

    let lines = currentSource.split('\n');

    for (const patch of sortedPatches) {
      try {
        // ACE patch format: { id, description, startLine, endLine, replacement }
        const { startLine, endLine, replacement, id: issueId, description } = patch;

        // Validate line numbers (1-based from ACE, convert to 0-based for array)
        if (startLine < 1 || endLine < startLine || startLine > lines.length) {
          skippedCount++;
          console.log('[ACE Orchestrator] Patch skipped - invalid line range:', {
            issueId,
            startLine,
            endLine,
            totalLines: lines.length,
          });
          continue;
        }

        // Check if replacement is valid
        if (typeof replacement !== 'string') {
          skippedCount++;
          console.log('[ACE Orchestrator] Patch skipped - no replacement:', { issueId });
          continue;
        }

        // Convert to 0-based indices
        const startIdx = startLine - 1;
        const endIdx = Math.min(endLine, lines.length); // endLine is inclusive, but slice end is exclusive

        // Get the old lines for logging
        const oldLines = lines.slice(startIdx, endIdx).join('\n');

        // Replace lines: remove old lines and insert replacement
        const replacementLines = replacement.split('\n');
        lines.splice(startIdx, endIdx - startIdx, ...replacementLines);

        appliedCount++;
        console.log('[ACE Orchestrator] Patch applied:', {
          issueId,
          description: description?.substring(0, 50),
          startLine,
          endLine,
          oldLinesCount: endIdx - startIdx,
          newLinesCount: replacementLines.length,
        });
      } catch (patchErr) {
        const msg = patchErr instanceof Error ? patchErr.message : String(patchErr);
        patchErrors.push(msg);
        console.warn('[ACE Orchestrator] Patch error:', msg);
      }
    }

    // Reconstruct source from lines
    currentSource = lines.join('\n');

    // Phase 184: Write the modified content back to file if any patches were applied
    if (appliedCount > 0 && currentSource !== source) {
      try {
        // Use writeFile API to save the changes
        if (api.writeFile && typeof api.writeFile === 'function') {
          // Resolve the full path for writing
          const fullPath = options?.projectRoot
            ? resolveProjectPath(options.projectRoot, filePath)
            : filePath;

          const writeResult = await api.writeFile(fullPath, currentSource);
          if (writeResult) {
            console.log('[ACE Orchestrator] Successfully wrote', appliedCount, 'patches to:', fullPath);
          } else {
            patchErrors.push(`Failed to write file: ${fullPath}`);
            console.error('[ACE Orchestrator] Failed to write file:', fullPath);
          }
        } else {
          patchErrors.push('writeFile API not available');
          console.error('[ACE Orchestrator] writeFile API not available');
        }
      } catch (writeErr) {
        const msg = writeErr instanceof Error ? writeErr.message : String(writeErr);
        patchErrors.push(`Write error: ${msg}`);
        console.error('[ACE Orchestrator] Write error:', msg);
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      success: patchErrors.length === 0,
      filePath,
      appliedPatches: appliedCount,
      skippedPatches: skippedCount,
      errors: patchErrors,
      notes: [
        ...(result.notes || []),
        `ACE applied ${appliedCount} patches, skipped ${skippedCount} in ${durationMs}ms`,
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ACE Orchestrator] Error:', message);

    return {
      success: false,
      filePath,
      appliedPatches: 0,
      skippedPatches: 0,
      errors: [message],
    };
  }
}

// ============================================================================
// Phase 145.3: ACE-Guided Project Auto-Fix
// ============================================================================

import type {
  AceGuidedAutoFixPlan,
  AceGuidedProjectAutoFixOptions,
  AceGuidedProjectAutoFixResult,
} from './aceAutoFixTypes';

/**
 * Phase 145.3: Issue with metadata for plan building
 * Phase 183.1: Added relativePath for proper Diagnostics -> Scanner path matching
 */
export type IssueWithMeta = {
  id: string;
  filePath: string;                                     // Absolute path from Scanner
  relativePath?: string;                                // Phase 183.1: Relative path for matching with Diagnostics
  message: string;
  line: number;
  severity: 'info' | 'warning' | 'error' | number | string;
  category?: string;
  ruleId?: string;
};

/**
 * Phase 146.7.2: Resolve project path for file operations
 * Ensures proper path joining between projectRoot and filePath
 */
function resolveProjectPath(projectRoot: string, filePath: string): string {
  // Remove trailing slashes from root
  const root = projectRoot.replace(/\/+$/, '');
  // Remove leading slashes from file (unless it's absolute)
  const file = filePath.replace(/^\/+/, '');

  // If filePath is already absolute (starts with / or drive letter), return as-is
  if (filePath.startsWith('/') || /^[A-Za-z]:/.test(filePath)) {
    return filePath;
  }

  return `${root}/${file}`;
}

/**
 * Phase 146.7.1: Smart path matching for Diagnostics -> Issues mapping
 * Handles different path formats:
 * - Diagnostics uses relative paths: "desktop/src/components/..."
 * - Issues may use full paths: "/Users/.../desktop/src/components/..."
 */
function filePathMatchesTarget(issuePath: string, targetFiles: string[]): string | null {
  // 1) Direct match
  if (targetFiles.includes(issuePath)) {
    return issuePath;
  }

  // 2) Suffix match - check if any target is a suffix of the issue path
  for (const target of targetFiles) {
    if (issuePath.endsWith(target) || issuePath.endsWith('/' + target)) {
      return target;
    }
  }

  // 3) Reverse suffix match - check if issue path is a suffix of any target
  for (const target of targetFiles) {
    if (target.endsWith(issuePath) || target.endsWith('/' + issuePath)) {
      return target;
    }
  }

  return null;
}

/**
 * Phase 145.3: Build ACE-Guided Auto-Fix Plan
 * Phase 146.7: Added diagnosticsWorstFiles parameter for Diagnostics-based prioritization
 * Phase 146.7.1: Added smart path matching for different path formats
 * Prioritizes files based on: 1) Diagnostics, 2) ACE Code Evolution, 3) issue count fallback
 */
export function buildAceGuidedAutoFixPlan(
  allIssues: IssueWithMeta[],
  aceWorstFiles?: string[],
  maxFiles: number = 10,
  diagnosticsWorstFiles?: string[]
): AceGuidedAutoFixPlan {
  let targetFiles: string[] = [];
  let source: AceGuidedAutoFixPlan['source'] = 'issue_count_fallback';

  // Phase 146.7: 1) Diagnostics worst files have highest priority (aggregated risk)
  if (diagnosticsWorstFiles && diagnosticsWorstFiles.length > 0) {
    targetFiles = diagnosticsWorstFiles.slice(0, maxFiles);
    source = 'diagnostics';
    console.log('[ACE Plan] Using Diagnostics worst files:', targetFiles.length);
    console.log('[ACE Plan] Diagnostics files sample:', targetFiles.slice(0, 3));
  }

  // 2) If no diagnostics, use ACE Evolution worst files
  if (targetFiles.length === 0 && aceWorstFiles && aceWorstFiles.length > 0) {
    targetFiles = aceWorstFiles.slice(0, maxFiles);
    source = 'ace_evolution';
    console.log('[ACE Plan] Using ACE Evolution worst files:', targetFiles.length);
  }

  // 3) Fallback: Sort files by issue count (highest first)
  // Phase 183.2: Use relativePath for consistency with Diagnostics paths
  if (targetFiles.length === 0) {
    const counts: Record<string, number> = {};
    for (const issue of allIssues) {
      // Phase 183.2: Prefer relativePath over filePath for fallback to maintain consistency
      const file = issue.relativePath || issue.filePath;
      counts[file] = (counts[file] || 0) + 1;
    }

    targetFiles = Object.entries(counts)
      .sort((a, b) => b[1] - a[1]) // descending by count
      .slice(0, maxFiles)
      .map(([file]) => file);

    console.log('[ACE Plan] Using issue count fallback:', targetFiles.length, 'files');
    console.log('[ACE Plan] Fallback files sample:', targetFiles.slice(0, 3));
  }

  // Phase 146.7.1: Debug log for path matching
  // Phase 181: Enhanced debug logging for path matching issues
  if (allIssues.length > 0) {
    console.log('[ACE Plan Debug] Issue paths sample:', allIssues.slice(0, 5).map(i => i.filePath));
    console.log('[ACE Plan Debug] Target files sample:', targetFiles.slice(0, 5));
  }

  // Phase 183.3: Enhanced path normalization helper - extract relative path for matching
  // Problem: targetFiles from Diagnostics = "desktop/src/file.ts"
  //          issue.relativePath from Scanner = "src/file.ts" (relative to /Users/abdo/.../desktop)
  //          issue.filePath from Scanner = "/Users/abdo/.../desktop/src/file.ts" (absolute)
  // Solution: Generate multiple path variants for matching
  const normalizePath = (p: string): string => {
    // First, normalize path separators
    let normalized = p.replace(/\\/g, '/');

    // Find the project-relative portion by looking for known directory markers
    // Try to find "desktop/src" first (most specific), then "desktop/", then "src/", then "functions/"
    const markers = ['desktop/src/', 'desktop/', 'functions/src/', 'functions/', 'src/'];

    for (const marker of markers) {
      const idx = normalized.lastIndexOf(marker);
      if (idx !== -1) {
        // Return from the marker onwards
        normalized = normalized.substring(idx);
        break;
      }
    }

    // Strip any remaining leading slashes
    return normalized.replace(/^\/+/, '');
  };

  // Phase 183.5: Generate path variants for flexible matching
  // Scanner relativePath: "src/file.ts" (relative to desktop/)
  // Diagnostics path: "desktop/src/file.ts" (relative to workspace)
  // Phase 183.5: Also handle functions/src/ paths
  const getPathVariants = (p: string): string[] => {
    const normalized = p.replace(/\\/g, '/').replace(/^\/+/, '');
    const variants: string[] = [normalized];

    // Add "desktop/" prefix variant if path starts with "src/"
    if (normalized.startsWith('src/')) {
      variants.push('desktop/' + normalized);
    }

    // Remove "desktop/" prefix variant if present
    if (normalized.startsWith('desktop/')) {
      variants.push(normalized.substring('desktop/'.length));
    }

    // Add "functions/" prefix variant if path starts with "src/"
    if (normalized.startsWith('src/')) {
      variants.push('functions/' + normalized);
    }

    // Remove "functions/" prefix variant if present
    if (normalized.startsWith('functions/')) {
      variants.push(normalized.substring('functions/'.length));
    }

    // Add variant from normalizePath
    const normalizedVariant = normalizePath(p);
    if (!variants.includes(normalizedVariant)) {
      variants.push(normalizedVariant);
    }

    // Phase 183.5: Add basename for last-resort matching
    const basename = normalized.split('/').pop();
    if (basename && !variants.includes(basename)) {
      variants.push(basename);
    }

    return variants;
  };

  // 4) Build issuesByFile map with smart path matching
  const issuesByFile: Record<string, string[]> = {};
  let totalIssues = 0;
  let matchedFiles = 0;

  // Phase 183.3: Pre-compute normalized targets AND all their variants for efficient matching
  const normalizedTargetMap = new Map<string, string>();
  const targetVariantsMap = new Map<string, string>(); // Maps any variant to original target
  for (const target of targetFiles) {
    normalizedTargetMap.set(normalizePath(target), target);
    // Add all variants of this target
    for (const variant of getPathVariants(target)) {
      targetVariantsMap.set(variant, target);
    }
  }

  // Phase 183.4: Enhanced debug logging for path matching diagnosis
  if (allIssues.length > 0 && targetFiles.length > 0) {
    const sampleIssue = allIssues[0];
    const sampleTarget = targetFiles[0];
    console.log('[ACE Plan Debug] Phase 183.4 - Path matching diagnosis:');
    console.log('  Issue filePath:', sampleIssue.filePath);
    console.log('  Issue relativePath:', sampleIssue.relativePath);
    console.log('  Target path:', sampleTarget);
    // Show all variants that would be generated for the issue
    const issueRelativeVariants = sampleIssue.relativePath ? getPathVariants(sampleIssue.relativePath) : [];
    const issueFilePathVariants = getPathVariants(sampleIssue.filePath);
    console.log('  Issue relativePath variants:', issueRelativeVariants);
    console.log('  Issue filePath variants:', issueFilePathVariants);
    // Show all variants in targetVariantsMap for this target
    const targetVariants = getPathVariants(sampleTarget);
    console.log('  Target variants:', targetVariants);
    console.log('  targetVariantsMap size:', targetVariantsMap.size);
    console.log('  targetVariantsMap sample keys:', Array.from(targetVariantsMap.keys()).slice(0, 10));
    // Check if any of the issue variants exist in targetVariantsMap
    const matchingVariant = issueRelativeVariants.find(v => targetVariantsMap.has(v));
    console.log('  Matching variant from relativePath?:', matchingVariant || 'NONE');
    const matchingFilePathVariant = issueFilePathVariants.find(v => targetVariantsMap.has(v));
    console.log('  Matching variant from filePath?:', matchingFilePathVariant || 'NONE');
  }

  for (const issue of allIssues) {
    // Phase 183.5: Use path variants for flexible matching
    const issueRelativePath = issue.relativePath;
    let finalMatch: string | null = null;

    // Phase 183.5: Priority 0 - Direct exact match with relativePath (most common case)
    if (issueRelativePath && targetVariantsMap.has(issueRelativePath)) {
      finalMatch = targetVariantsMap.get(issueRelativePath) || null;
    }

    // Phase 183.5: Priority 1 - Use relativePath variants for matching
    if (!finalMatch && issueRelativePath) {
      const relativeVariants = getPathVariants(issueRelativePath);
      for (const variant of relativeVariants) {
        const matchedTarget = targetVariantsMap.get(variant);
        if (matchedTarget) {
          finalMatch = matchedTarget;
          break;
        }
      }
    }

    // Phase 183.3: Priority 2 - Use filePath variants for matching
    if (!finalMatch) {
      const filePathVariants = getPathVariants(issue.filePath);
      for (const variant of filePathVariants) {
        const matchedTarget = targetVariantsMap.get(variant);
        if (matchedTarget) {
          finalMatch = matchedTarget;
          break;
        }
      }
    }

    // Phase 183.3: Priority 3 - Fall back to existing smart path matching
    if (!finalMatch) {
      // Phase 146.7.1: Use smart path matching
      const matchedTarget = filePathMatchesTarget(issue.filePath, targetFiles);
      if (matchedTarget) {
        finalMatch = matchedTarget;
      } else {
        // Phase 183: Enhanced fallback - use normalized path matching
        const normalizedIssuePath = normalizePath(issue.filePath);

        // Direct lookup in normalized map (exact match after normalization)
        const directMatch = normalizedTargetMap.get(normalizedIssuePath);
        if (directMatch) {
          finalMatch = directMatch;
        } else {
          // Suffix matching on normalized paths
          for (const [normalizedTarget, originalTarget] of normalizedTargetMap.entries()) {
            if (normalizedIssuePath === normalizedTarget ||
                normalizedIssuePath.endsWith('/' + normalizedTarget) ||
                normalizedTarget.endsWith('/' + normalizedIssuePath)) {
              finalMatch = originalTarget;
              break;
            }
          }
        }
      }
    }

    if (!finalMatch) continue;

    // Use the matched target path as the key (keeps consistent with targetFiles)
    if (!issuesByFile[finalMatch]) {
      issuesByFile[finalMatch] = [];
      matchedFiles++;
    }
    issuesByFile[finalMatch].push(issue.id);
    totalIssues++;
  }

  // Phase 183.2: Enhanced debug logging with unmatched issue samples
  console.log('[ACE Plan Debug] issuesByFile keys:', Object.keys(issuesByFile).slice(0, 10));
  console.log('[ACE Plan] Path matching result:', { matchedFiles, totalIssues, targetFilesCount: targetFiles.length, totalIssuesInInput: allIssues.length });

  // Phase 183.2: Log unmatched issues for debugging if issuesByFile is empty
  if (totalIssues === 0 && allIssues.length > 0) {
    console.warn('[ACE Plan] WARNING: No issues matched! Sample unmatched issues:');
    const unmatchedSamples = allIssues.slice(0, 3).map(i => ({
      filePath: i.filePath,
      relativePath: i.relativePath,
      normalizedFilePath: normalizePath(i.filePath),
      normalizedRelativePath: i.relativePath ? normalizePath(i.relativePath) : null,
    }));
    console.warn('[ACE Plan] Unmatched samples:', JSON.stringify(unmatchedSamples, null, 2));
    console.warn('[ACE Plan] Target files:', targetFiles.slice(0, 5));
  }

  console.log('[ACE Plan] Plan built:', {
    files: targetFiles.length,
    totalIssues,
    source,
  });

  return {
    targetFiles,
    issuesByFile,
    source,
    totalIssues,
  };
}

/**
 * Phase 145.3: Run ACE-Guided Auto-Fix for entire project
 * Iterates through prioritized files and applies ACE fixes
 */
export async function runAceGuidedAutoFixForProject(
  options: AceGuidedProjectAutoFixOptions
): Promise<AceGuidedProjectAutoFixResult> {
  const { projectRoot, plan, quiet = false, createBackup = true, riskLevel = 'balanced' } = options;
  const startTime = Date.now();

  const fileResults: Record<string, AceAutoFixResult> = {};
  let totalApplied = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const notes: string[] = [];

  console.log('[ACE Project] Starting ACE-guided auto-fix for project...', {
    projectRoot,
    files: plan.targetFiles.length,
    totalIssues: plan.totalIssues,
    source: plan.source,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = typeof window !== 'undefined' ? (window as any).f0Desktop : null;

  if (!api) {
    return {
      fileResults: {},
      totalApplied: 0,
      totalSkipped: 0,
      totalErrors: 1,
      filesProcessed: 0,
      durationMs: Date.now() - startTime,
      notes: ['Desktop API not available'],
    };
  }

  // Process each file
  for (const filePath of plan.targetFiles) {
    const issueIds = plan.issuesByFile[filePath] || [];

    if (issueIds.length === 0) {
      if (!quiet) {
        console.log('[ACE Project] Skipping file with no issues:', filePath);
      }
      continue;
    }

    // Phase 146.7.2: Resolve full path for file operations
    const fullPath = resolveProjectPath(projectRoot, filePath);

    if (!quiet) {
      console.log('[ACE Project] Processing file:', filePath, '- Issues:', issueIds.length);
      console.log('[ACE Project] Resolved full path:', fullPath);
    }

    try {
      // Read file content
      let source = '';
      if (api.readFileText && typeof api.readFileText === 'function') {
        // Phase 146.7.2: Use resolved full path for reading
        const readResult = await api.readFileText(fullPath);
        if (readResult.success && readResult.content) {
          source = readResult.content;
        } else {
          console.warn('[ACE Project] Failed to read file:', fullPath, 'Result:', readResult);
          fileResults[filePath] = {
            success: false,
            filePath,
            appliedPatches: 0,
            skippedPatches: 0,
            errors: [`Failed to read file content: ${fullPath}`],
          };
          totalErrors++;
          continue;
        }
      } else {
        console.warn('[ACE Project] readFileText API not available');
        totalErrors++;
        continue;
      }

      // Build issues array for ACE using issuesData if available
      const { issuesData } = options;
      const issues = issueIds.map((id) => {
        const data = issuesData?.get(id);
        if (data) {
          return {
            id,
            message: data.message,
            line: data.line,
            column: data.column ?? 1,
            ruleId: data.ruleId,
            severity: mapContextSeverityToAce(data.severity),
          };
        }
        // Fallback if no data
        return {
          id,
          message: `Issue ${id}`,
          line: 1,
          ruleId: undefined,
          severity: 'medium' as const,
        };
      });

      // Run ACE auto-fix on file (Phase 145.3.3: pass riskLevel)
      const result = await runAceAutoFixOnFile(filePath, source, issues, {
        projectRoot,
        createBackup,
        riskLevel,
      });

      fileResults[filePath] = result;
      totalApplied += result.appliedPatches;
      totalSkipped += result.skippedPatches;

      if (!result.success) {
        totalErrors++;
      }

      if (!quiet) {
        console.log('[ACE Project] File result:', {
          filePath,
          success: result.success,
          applied: result.appliedPatches,
          skipped: result.skippedPatches,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ACE Project] Error processing file:', filePath, message);
      totalErrors++;
      fileResults[filePath] = {
        success: false,
        filePath,
        appliedPatches: 0,
        skippedPatches: 0,
        errors: [message],
      };
    }
  }

  const durationMs = Date.now() - startTime;

  // Build summary note
  notes.push(
    `ACE-guided auto-fix completed: ${plan.targetFiles.length} files processed, ` +
    `${totalApplied} patches applied, ${totalSkipped} skipped, ${totalErrors} errors ` +
    `in ${durationMs}ms`
  );

  // Phase 147.2: Include targetedIssues from plan
  console.log('[ACE Project] Auto-fix complete:', {
    filesProcessed: plan.targetFiles.length,
    totalApplied,
    totalSkipped,
    totalErrors,
    targetedIssues: plan.totalIssues,
    durationMs,
  });

  return {
    fileResults,
    totalApplied,
    totalSkipped,
    totalErrors,
    filesProcessed: plan.targetFiles.length,
    durationMs,
    notes,
    targetedIssues: plan.totalIssues,
  };
}

// ============================================================================
// Phase 147: ACE Auto-Fix Cloud Function Client
// ============================================================================

/**
 * Production ACE Auto-Fix Cloud Function endpoint
 * Deployed via Firebase Functions v2
 */
const ACE_AUTOFIX_CLOUD_ENDPOINT = 'https://aceautofix-vpxyxgcfbq-uc.a.run.app';

/**
 * Phase 147.1: Maximum issues to send per request
 * Keeps prompts focused and improves patch generation quality
 */
const MAX_ISSUES_PER_CLOUD_REQUEST = 10;

/**
 * Request payload for the Cloud Function
 * Maps to functions/src/ace/types.ts AceAutoFixRequest
 */
interface CloudFunctionRequest {
  filePath: string;
  fileRole?: string;
  code: string;
  issues?: Array<{
    id: string;
    message: string;
    line: number;
    column?: number;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    ruleId?: string;
  }>;
  riskLevel?: 'strict' | 'balanced' | 'relaxed';
  language?: 'ts' | 'tsx' | 'js' | 'jsx' | 'json' | 'other';
  dryRun?: boolean;
}

/**
 * Response from the Cloud Function
 * Maps to functions/src/ace/types.ts AceAutoFixResult
 */
interface CloudFunctionResponse {
  patches: Array<{
    filePath: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
    replacement: string;
    reason?: string;
  }>;
  summary?: string;
  notes?: string[];
  success: boolean;
  error?: string;
}

/**
 * Phase 147: Map desktop risk level to cloud function risk level
 */
function mapRiskLevelToCloud(
  riskLevel?: AceRiskLevel
): 'strict' | 'balanced' | 'relaxed' {
  switch (riskLevel) {
    case 'conservative':
      return 'strict';
    case 'aggressive':
      return 'relaxed';
    case 'balanced':
    default:
      return 'balanced';
  }
}

/**
 * Phase 147: Call the ACE Auto-Fix Cloud Function backend
 *
 * This function calls the deployed Firebase Cloud Function directly,
 * which uses OpenAI to generate real patches for code issues.
 *
 * @param request - The auto-fix request with file content and issues
 * @returns Promise<AceAutoFixResponse> - Patches to apply
 * @throws Error if the request fails
 *
 * @example
 * ```ts
 * const response = await callAceAutoFixCloudBackend({
 *   filePath: 'src/utils/helpers.ts',
 *   language: 'ts',
 *   source: fileContent,
 *   issues: diagnosticIssues,
 *   riskLevel: 'balanced'
 * });
 *
 * if (response.patches.length > 0) {
 *   // Apply patches to the file
 * }
 * ```
 */
export async function callAceAutoFixCloudBackend(
  request: AceAutoFixRequest
): Promise<AceAutoFixResponse> {
  // Phase 147.1: Limit issues to prevent prompt overflow
  const allIssues = request.issues || [];
  const limitedIssues = allIssues.slice(0, MAX_ISSUES_PER_CLOUD_REQUEST);
  const wasLimited = allIssues.length > MAX_ISSUES_PER_CLOUD_REQUEST;

  console.log('[ACE Cloud] Calling backend', {
    filePath: request.filePath,
    issuesReceived: allIssues.length,
    issuesSent: limitedIssues.length,
    wasLimited,
    riskLevel: request.riskLevel,
  });

  // Build cloud function request with limited issues
  const cloudRequest: CloudFunctionRequest = {
    filePath: request.filePath,
    code: request.source,
    language: request.language,
    riskLevel: mapRiskLevelToCloud(request.riskLevel),
    issues: limitedIssues.map((issue) => ({
      id: issue.id,
      message: issue.message,
      line: issue.line,
      column: issue.column,
      severity: issue.severity,
      ruleId: issue.ruleId,
    })),
  };

  try {
    const response = await fetch(ACE_AUTOFIX_CLOUD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cloudRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ACE Cloud] Backend error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(
        `ACE Auto-Fix backend error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as CloudFunctionResponse;

    console.log('[ACE Cloud] Backend response', {
      success: data.success,
      patchesCount: data.patches?.length ?? 0,
      summary: data.summary,
    });

    if (!data.success) {
      throw new Error(data.error || 'ACE Auto-Fix backend returned failure');
    }

    // Convert cloud function patches to desktop format
    const patches = (data.patches || []).map(
      (patch, index) => ({
        id: `patch-${index}-${Date.now()}`,
        description: patch.reason || 'Auto-fix patch',
        startLine: patch.start.line,
        endLine: patch.end.line,
        replacement: patch.replacement,
      })
    );

    return {
      filePath: request.filePath,
      patches,
      notes: data.notes,
    };
  } catch (error) {
    console.error('[ACE Cloud] Request failed', {
      filePath: request.filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Phase 147: Check if the ACE Auto-Fix Cloud backend is available
 * Makes a lightweight OPTIONS request to verify connectivity
 */
export async function checkAceCloudBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(ACE_AUTOFIX_CLOUD_ENDPOINT, {
      method: 'OPTIONS',
    });
    return response.ok || response.status === 204;
  } catch {
    return false;
  }
}

/**
 * Phase 147: Dry run - Analyze file without generating patches
 * Useful for previewing what changes would be made
 */
export async function analyzeFileForCloudFixes(
  filePath: string,
  source: string,
  language: AceAutoFixRequest['language']
): Promise<{ issueCount: number; canFix: boolean }> {
  try {
    const response = await fetch(ACE_AUTOFIX_CLOUD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath,
        code: source,
        language,
        dryRun: true,
      } as CloudFunctionRequest),
    });

    if (!response.ok) {
      return { issueCount: 0, canFix: false };
    }

    const data = (await response.json()) as CloudFunctionResponse;
    return {
      issueCount: data.patches?.length ?? 0,
      canFix: data.success,
    };
  } catch {
    return { issueCount: 0, canFix: false };
  }
}
