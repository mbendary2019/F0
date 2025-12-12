// desktop/src/lib/atp/amtgBridge.ts
// Phase 140.3: Bridge between AMTG and ITG/Test Discovery
// Provides source-to-test path mapping and test framework detection

import type { CoverageDeltaSummary, FileCoverageDelta } from './coverageDeltaTypes';
import type { TestFramework } from './amtgTypes';

/**
 * Candidate file for test generation
 */
export interface AMTGCandidate {
  /** Source file path */
  filePath: string;
  /** Risk score (1-5) */
  riskScore: number;
  /** Current coverage percentage */
  coveragePct: number;
  /** Suggested test file path */
  testFilePath: string;
  /** Detected test framework */
  framework: TestFramework;
}

/**
 * Detect the test framework used in the project
 * In future, this should scan package.json or config files
 */
export function detectTestFramework(): TestFramework {
  // TODO: Actually scan project for test framework
  // Check for:
  // - jest.config.js → jest
  // - vitest.config.ts → vitest
  // - mocha in package.json → mocha

  // Default to vitest for now (modern default)
  return 'vitest';
}

/**
 * Generate a test file path from a source file path
 * Uses common conventions for test file placement
 */
export function sourceToTestPath(
  srcPath: string,
  framework: TestFramework,
): string {
  // Remove leading slashes for consistency
  const cleanPath = srcPath.replace(/^\/+/, '');

  // Determine extension based on framework
  const testExt = framework === 'vitest' || framework === 'jest'
    ? '.test.ts'
    : '.spec.ts';

  // Common patterns:
  // src/foo/bar.ts → __tests__/foo/bar.test.ts
  // src/foo/bar.tsx → __tests__/foo/bar.test.tsx

  // Extract directory and filename
  const parts = cleanPath.split('/');
  const fileName = parts.pop() || '';
  const dirPath = parts.join('/');

  // Remove extension from filename
  const baseName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');

  // Check if it's a React component (tsx)
  const isReact = fileName.endsWith('.tsx') || fileName.endsWith('.jsx');
  const finalExt = isReact ? testExt.replace('.ts', '.tsx') : testExt;

  // Generate test path - put in __tests__ folder parallel to src
  const testDir = dirPath.replace(/^src/, '__tests__');
  return `${testDir}/${baseName}${finalExt}`;
}

/**
 * Check if a file already has tests
 * In future, this should check the actual filesystem
 */
export async function hasExistingTests(srcPath: string): Promise<boolean> {
  // TODO: Actually check if test file exists
  // For now, return false (assume no tests exist)
  return false;
}

/**
 * Convert untested high-risk files to AMTG candidates
 */
export function untestedFilesToCandidates(
  untestedFiles: FileCoverageDelta[],
): AMTGCandidate[] {
  const framework = detectTestFramework();

  return untestedFiles.map((file) => ({
    filePath: file.filePath,
    riskScore: file.riskScore ?? 0,
    coveragePct: file.after ?? 0,
    testFilePath: sourceToTestPath(file.filePath, framework),
    framework,
  }));
}

/**
 * Get AMTG candidates from coverage delta summary
 * Filters to high-risk untested files
 */
export function getCandidatesFromDelta(
  deltaSummary: CoverageDeltaSummary | undefined,
): AMTGCandidate[] {
  if (!deltaSummary) return [];

  return untestedFilesToCandidates(deltaSummary.untestedHighRiskFiles);
}

/**
 * Filter candidates by policy
 */
export function filterCandidatesByPolicy(
  candidates: AMTGCandidate[],
  options: {
    maxFiles?: number;
    minRiskScore?: number;
    respectExistingTests?: boolean;
  },
): AMTGCandidate[] {
  let filtered = [...candidates];

  // Filter by risk score
  if (options.minRiskScore !== undefined) {
    filtered = filtered.filter((c) => c.riskScore >= options.minRiskScore!);
  }

  // Sort by risk score (highest first)
  filtered.sort((a, b) => b.riskScore - a.riskScore);

  // Limit to maxFiles
  if (options.maxFiles !== undefined && options.maxFiles > 0) {
    filtered = filtered.slice(0, options.maxFiles);
  }

  return filtered;
}
