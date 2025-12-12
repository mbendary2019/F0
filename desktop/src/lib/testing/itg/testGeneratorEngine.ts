// desktop/src/lib/testing/itg/testGeneratorEngine.ts
// Phase 139.2: Test Generator Engine v1
// Phase 139.4: Updated to use coverage helpers
// Phase 139.6: Added debug snapshot generation
// Phase 139.7: Bootstrap Mode - uses scoreFileRisksWithNotes for better debug info
// Core ITG engine that combines risk scoring with template generation

import {
  ITGFileRisk,
  ITGTestKind,
  ITGTestPriority,
  ITGTestSuggestion,
  ITGGenerateResult,
  ITGDebugSnapshot,
} from './itgTypes';

import {
  ITG_DEFAULT_MAX_FILES,
  ITG_DEFAULT_MAX_SUGGESTIONS,
  ITG_PRIORITY_THRESHOLDS,
} from './itgConstants';

// Phase 139.7: Use extended version that returns scoring notes
// Phase 139.7.1: Also import isAnalyzableFilePath for accurate debug counts
import { scoreFileRisksWithNotes, isAnalyzableFilePath } from './riskScorer';

import {
  buildFunctionUnitTestTemplate,
  buildReactComponentTestTemplate,
  buildApiRouteTestTemplate,
} from './testTemplateLibrary';

// Phase 139.4: Import coverage helpers
import { computeCoverageProjection } from './itgCoverageHelpers';

// Phase 139.5: Import AI enhancer
import {
  enhanceSuggestionsWithAI,
  ITGAiConfig,
} from './itgAiEnhancer';

/**
 * Input shape for the ITG engine.
 * Each snapshot is optional – the engine gracefully degrades.
 */
export interface ITGEngineInputs {
  projectIndexSnapshot?: any;
  codeHealthSnapshot?: any;
  coverageSnapshot?: any;
  maxSuggestions?: number;
}

/**
 * Phase 139.5: Options for AI enhancement
 */
export interface ITGEngineOptions {
  aiConfig?: ITGAiConfig;
}

/**
 * Main entry point for the ITG Engine.
 * 1. Scores files by risk using riskScorer.
 * 2. Builds test suggestions using templates.
 * 3. Optionally enhances with AI (Phase 139.5).
 * 4. Returns a structured result.
 */
export async function generateTestsForProject(
  inputs: ITGEngineInputs,
  options?: ITGEngineOptions
): Promise<ITGGenerateResult> {
  const {
    projectIndexSnapshot,
    codeHealthSnapshot,
    coverageSnapshot,
    maxSuggestions = ITG_DEFAULT_MAX_SUGGESTIONS,
  } = inputs;

  // Step 1: Score file risks (Phase 139.7: use extended version with notes)
  const scoringResult = scoreFileRisksWithNotes(
    projectIndexSnapshot,
    codeHealthSnapshot,
    coverageSnapshot
  );
  const risks = scoringResult.risks;
  const scoringNotes = scoringResult.notes;

  // Step 2: Build suggestions for each risk file
  const allSuggestions: ITGTestSuggestion[] = [];

  for (const risk of risks) {
    const fileSuggestions = buildSuggestionsForFile(
      risk,
      projectIndexSnapshot
    );
    allSuggestions.push(...fileSuggestions);
  }

  // Step 3: Sort by priority (P0 first) then by estimatedCoverageGain desc
  allSuggestions.sort((a, b) => {
    const priorityOrder = { P0: 0, P1: 1, P2: 2 };
    const pa = priorityOrder[a.priority] ?? 99;
    const pb = priorityOrder[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return (b.estimatedCoverageGain ?? 0) - (a.estimatedCoverageGain ?? 0);
  });

  // Step 4: Trim to maxSuggestions
  let suggestions = allSuggestions.slice(0, maxSuggestions);

  // Phase 139.5: Tag all static suggestions with source='static'
  suggestions = suggestions.map((s) => ({
    ...s,
    source: 'static' as const,
  }));

  // Phase 139.5: AI Enhancement Step (Hybrid Mode)
  const aiConfig = options?.aiConfig;
  if (aiConfig?.enabled) {
    try {
      suggestions = await enhanceSuggestionsWithAI({
        projectId: 'current-project',
        suggestions,
        aiConfig,
      });
    } catch (err) {
      // Log but don't fail - gracefully degrade to static-only
      console.warn('[ITG] AI enhancement failed, using static suggestions:', err);
    }
  }

  // Step 5: Compute baseline and projected coverage using helpers
  const { baseline, projected } = computeCoverageProjection(
    coverageSnapshot,
    suggestions
  );

  // Phase 139.6: Build debug snapshot
  // Phase 139.7: Include scoring notes from risk scorer (Bootstrap Mode info)
  // Phase 139.7.1: Correctly count analyzable files (not just risks returned)
  const indexedFiles = getIndexedFiles(projectIndexSnapshot);
  // Phase 139.7.1: Include relativePath for desktop indexer compatibility
  const analyzableFiles = indexedFiles.filter((f: any) => isAnalyzableFilePath(f?.path || f?.filePath || f?.relativePath));
  const debugNotes: string[] = [...scoringNotes]; // Include Bootstrap Mode notes

  if (!projectIndexSnapshot) {
    debugNotes.push('No project index snapshot provided');
  }
  if (!codeHealthSnapshot) {
    debugNotes.push('No code health snapshot provided');
  }
  if (!coverageSnapshot) {
    debugNotes.push('No coverage snapshot provided');
  }
  if (aiConfig?.enabled) {
    debugNotes.push(`AI enhancement enabled (mode: ${aiConfig.mode ?? 'hybrid'})`);
  }

  const debug: ITGDebugSnapshot = {
    indexFileCount: indexedFiles.length,
    analyzableFileCount: analyzableFiles.length, // Fixed: count all analyzable, not just risks
    excludedFileCount: Math.max(0, indexedFiles.length - analyzableFiles.length),
    maxFilesConfigured: ITG_DEFAULT_MAX_FILES,
    maxSuggestionsConfigured: maxSuggestions,
    riskEntriesCount: risks.length,
    suggestionsCount: suggestions.length,
    baselineCoverage: baseline,
    projectedCoverage: projected,
    notes: debugNotes.length > 0 ? debugNotes : undefined,
  };

  return {
    risks,
    suggestions,
    baselineCoverage: baseline,
    projectedCoverage: projected,
    debug,
  };
}

/**
 * Returns all indexed files from the project snapshot.
 */
function getIndexedFiles(snapshot: any): any[] {
  if (!snapshot) return [];
  if (Array.isArray(snapshot.files)) return snapshot.files;
  if (Array.isArray(snapshot.indexedFiles)) return snapshot.indexedFiles;
  if (Array.isArray(snapshot)) return snapshot;
  return [];
}

/**
 * Finds file metadata from snapshot by path.
 * Phase 139.7.1: Also accepts relativePath from IndexedFile (desktop indexer format)
 */
function findFileForPath(snapshot: any, path: string): any | null {
  const files = getIndexedFiles(snapshot);
  return files.find(
    (f: any) => f && (f.path === path || f.filePath === path || f.relativePath === path)
  ) || null;
}

/**
 * Detects the kind of test appropriate for the file.
 * Maps to ITGTestKind which is 'unit' | 'integration'
 */
function detectFileKind(filePath: string, _fileMeta: any): { kind: ITGTestKind; isApi: boolean; isComponent: boolean } {
  const lowerPath = filePath.toLowerCase();

  // API routes → integration tests
  if (
    lowerPath.includes('/api/') ||
    lowerPath.includes('/routes/') ||
    lowerPath.endsWith('/route.ts') ||
    lowerPath.endsWith('/route.tsx')
  ) {
    return { kind: 'integration', isApi: true, isComponent: false };
  }

  // React components (pages, layouts, components) → unit tests
  if (
    lowerPath.endsWith('.tsx') ||
    lowerPath.includes('/components/') ||
    lowerPath.includes('/pages/') ||
    lowerPath.includes('/app/')
  ) {
    return { kind: 'unit', isApi: false, isComponent: true };
  }

  // Hooks, services, utilities → unit tests
  return { kind: 'unit', isApi: false, isComponent: false };
}

/**
 * Maps risk level to priority.
 */
function riskToPriority(risk: ITGFileRisk): ITGTestPriority {
  const score = risk.estimatedImpactScore ?? 0;

  if (score >= ITG_PRIORITY_THRESHOLDS.P0_MIN_IMPACT) return 'P0';
  if (score >= ITG_PRIORITY_THRESHOLDS.P1_MIN_IMPACT) return 'P1';
  return 'P2';
}

/**
 * Extracts a plausible symbol name from the file path.
 * Examples:
 *   src/lib/foo.ts → foo
 *   src/components/Button.tsx → Button
 *   src/app/api/users/route.ts → GET (or POST, etc.)
 */
function inferSymbolName(filePath: string, isApi: boolean, isComponent: boolean): string {
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1] || 'module';
  const baseName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');

  // API routes typically export GET, POST, etc.
  if (isApi) {
    return 'GET'; // Default to GET, user can adjust
  }

  // Components are usually PascalCase
  if (isComponent) {
    // Capitalize first letter
    return baseName.charAt(0).toUpperCase() + baseName.slice(1);
  }

  // For unit tests, use camelCase
  return baseName.charAt(0).toLowerCase() + baseName.slice(1);
}

/**
 * Builds test suggestions for a single file based on its risk.
 */
function buildSuggestionsForFile(
  risk: ITGFileRisk,
  projectSnapshot: any
): ITGTestSuggestion[] {
  const suggestions: ITGTestSuggestion[] = [];
  const fileMeta = findFileForPath(projectSnapshot, risk.path);
  const { kind, isApi, isComponent } = detectFileKind(risk.path, fileMeta);
  const priority = riskToPriority(risk);
  const symbolName = inferSymbolName(risk.path, isApi, isComponent);

  // Generate the appropriate template
  let templateCode: string;

  if (isApi) {
    templateCode = buildApiRouteTestTemplate(symbolName, risk.path);
  } else if (isComponent) {
    templateCode = buildReactComponentTestTemplate(symbolName, risk.path);
  } else {
    templateCode = buildFunctionUnitTestTemplate(symbolName, risk.path);
  }

  // Build description from reasons
  const description = risk.reasons.length > 0
    ? risk.reasons.join('; ')
    : 'Increase test coverage';

  // Estimate coverage gain based on priority
  const estimatedCoverageGain = priority === 'P0' ? 5 : priority === 'P1' ? 3 : 1;

  // Build the suggestion
  const suggestion: ITGTestSuggestion = {
    id: `itg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filePath: risk.path,
    symbolName,
    kind,
    description,
    priority,
    estimatedCoverageGain,
    snippet: templateCode,
  };

  suggestions.push(suggestion);

  return suggestions;
}

// Phase 139.4: Old coverage functions removed - now using itgCoverageHelpers.ts
