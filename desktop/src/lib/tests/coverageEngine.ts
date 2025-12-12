// desktop/src/lib/tests/coverageEngine.ts
// Phase 137.4.0: Coverage Analysis Engine
// Heuristic-based coverage estimation and risk assessment

import type {
  CoverageAnalysisResult,
  CoverageLevel,
  CoverageSummary,
  FileCoverageHint,
  FileKind,
  ProjectIndexEntry,
  TestMappings,
} from './coverageTypes';

/**
 * Detect the kind of file based on path patterns
 */
function detectKind(path: string): FileKind {
  const lower = path.toLowerCase();

  if (/\/pages?\/|\/app\/.*page\.(tsx?|jsx?)$/.test(lower)) return 'page';
  if (/\/api\/|\/routes\//.test(lower)) return 'api';
  if (/\/components?\//.test(lower)) return 'component';
  if (/\/hooks?\/|use[A-Z]/.test(path)) return 'hook';
  if (/\/models?\/|\/schemas?\/|\.model\.(ts|js)$/.test(lower)) return 'model';
  if (/config|\.config\.(ts|js|mjs)$/.test(lower)) return 'config';
  if (/\/lib\/|\/utils?\/|\/helpers?\/|\/services?\//.test(lower)) return 'logic';

  return 'other';
}

/**
 * Check if a file is a source file (not test, not config)
 */
function isSourceFile(path: string): boolean {
  const lower = path.toLowerCase();
  // Exclude test files
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(lower)) return false;
  if (/__tests__\//.test(lower)) return false;
  // Exclude common non-source files
  if (/node_modules|\.d\.ts$|\.json$|\.md$|\.css$|\.scss$/.test(lower)) return false;
  // Include TypeScript/JavaScript files
  return /\.(ts|tsx|js|jsx)$/.test(lower);
}

/**
 * Check if a file is a test file
 */
function isTestFile(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(lower) ||
    /__tests__\/.*\.(ts|tsx|js|jsx)$/.test(lower)
  );
}

/**
 * Extract base name from path for matching
 */
function baseName(path: string): string {
  const parts = path.split('/');
  const file = parts[parts.length - 1] || '';
  return file.replace(/\.(test|spec)?\.(ts|tsx|js|jsx)$/, '');
}

/**
 * Estimate coverage level based on test associations
 */
function estimateCoverageLevel(
  hasDirectTests: boolean,
  hasInferredTests: boolean,
  directCount: number,
  inferredCount: number
): CoverageLevel {
  if (hasDirectTests && directCount >= 2) return 'HIGH';
  if (hasDirectTests) return 'MEDIUM';
  if (hasInferredTests && inferredCount >= 1) return 'LOW';
  return 'NONE';
}

/**
 * High-risk keywords for priority scoring
 */
const HIGH_RISK_KEYWORDS = [
  'auth',
  'login',
  'signup',
  'password',
  'payment',
  'checkout',
  'billing',
  'stripe',
  'deploy',
  'publish',
  'release',
  'security',
  'token',
  'session',
  'admin',
  'permission',
  'role',
];

/**
 * Compute risk score (1-5) based on file path and kind
 */
function computeRiskScore(path: string, kind: FileKind): number {
  const lower = path.toLowerCase();
  let score = 1;

  // Kind-based base score
  if (kind === 'api') score = Math.max(score, 3);
  if (kind === 'page') score = Math.max(score, 2);
  if (kind === 'hook') score = Math.max(score, 2);
  if (kind === 'model') score = Math.max(score, 2);

  // High-risk keyword boost
  for (const keyword of HIGH_RISK_KEYWORDS) {
    if (lower.includes(keyword)) {
      score = Math.max(score, 4);
      break;
    }
  }

  // Critical paths get max score
  if (/auth|payment|deploy|security/.test(lower)) {
    score = 5;
  }

  return score;
}

/**
 * Generate reasons for why a file needs tests
 */
function generateReasons(
  path: string,
  kind: FileKind,
  coverageLevel: CoverageLevel,
  riskScore: number
): string[] {
  const reasons: string[] = [];
  const lower = path.toLowerCase();

  if (coverageLevel === 'NONE') {
    reasons.push('No tests found for this file');
  } else if (coverageLevel === 'LOW') {
    reasons.push('Only indirect test coverage detected');
  }

  if (riskScore >= 4) {
    if (/auth/.test(lower)) reasons.push('Authentication logic requires thorough testing');
    if (/payment|billing|stripe/.test(lower)) reasons.push('Payment handling is critical');
    if (/deploy/.test(lower)) reasons.push('Deployment code affects production');
    if (/security/.test(lower)) reasons.push('Security code needs comprehensive tests');
  }

  if (kind === 'api') {
    reasons.push('API endpoints should have integration tests');
  }

  if (kind === 'hook' && coverageLevel !== 'HIGH') {
    reasons.push('Custom hooks benefit from unit tests');
  }

  return reasons.length > 0 ? reasons : ['Consider adding tests for better coverage'];
}

/**
 * Analyze test coverage for a project
 *
 * @param projectIndex - Array of file entries from project indexing
 * @param mappings - Test mappings from testDiscovery
 * @returns Coverage analysis result with summary and file hints
 */
export function analyzeTestCoverage(
  projectIndex: ProjectIndexEntry[],
  mappings: TestMappings
): CoverageAnalysisResult {
  const sourceFiles = projectIndex.filter((f) => isSourceFile(f.path));
  const testFiles = projectIndex.filter((f) => isTestFile(f.path));

  const hints: FileCoverageHint[] = [];
  let filesWithAnyTests = 0;
  let highRiskUntestedCount = 0;
  let mediumRiskUntestedCount = 0;

  for (const file of sourceFiles) {
    const path = file.path;
    const kind = detectKind(path);
    const base = baseName(path);

    // Direct tests from mappings
    const directTestFiles = mappings.sourceToTests[path] || [];
    const hasDirectTests = directTestFiles.length > 0;

    // Inferred tests - look for test files with similar names
    const inferredTestFiles: string[] = [];
    for (const testFile of testFiles) {
      const testBase = baseName(testFile.path);
      if (testBase === base && !directTestFiles.includes(testFile.path)) {
        inferredTestFiles.push(testFile.path);
      }
    }
    const hasInferredTests = inferredTestFiles.length > 0;

    const coverageLevel = estimateCoverageLevel(
      hasDirectTests,
      hasInferredTests,
      directTestFiles.length,
      inferredTestFiles.length
    );

    const riskScore = computeRiskScore(path, kind);
    const reasons = generateReasons(path, kind, coverageLevel, riskScore);

    // Track stats
    if (hasDirectTests || hasInferredTests) {
      filesWithAnyTests++;
    } else {
      if (riskScore >= 4) highRiskUntestedCount++;
      else if (riskScore >= 2) mediumRiskUntestedCount++;
    }

    // Get display name (last part of path)
    const displayName = path.split('/').pop() || path;

    hints.push({
      filePath: path,
      displayName,
      kind,
      hasDirectTests,
      hasInferredTests,
      directTestFiles,
      inferredTestFiles,
      coverageLevel,
      riskScore,
      reasons,
    });
  }

  // Sort by risk score descending
  hints.sort((a, b) => b.riskScore - a.riskScore);

  // Calculate estimated coverage percentage
  const estimatedCoveragePercent =
    sourceFiles.length > 0
      ? Math.round((filesWithAnyTests / sourceFiles.length) * 100)
      : 0;

  const summary: CoverageSummary = {
    totalSourceFiles: sourceFiles.length,
    totalTestFiles: testFiles.length,
    filesWithAnyTests,
    filesWithoutTests: sourceFiles.length - filesWithAnyTests,
    estimatedCoveragePercent,
    highRiskUntestedCount,
    mediumRiskUntestedCount,
    lastAnalyzedAt: new Date().toISOString(),
  };

  return { summary, hints };
}

export default analyzeTestCoverage;
