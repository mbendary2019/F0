// desktop/src/lib/atp/coverageSnapshotBridge.ts
// Phase 140.2: Bridge between ATP and Coverage Engine
// Converts CoverageAnalysisResult to CoverageSnapshot format

import type { CoverageSnapshot, FileCoverageInfo } from './coverageDeltaTypes';
import type {
  CoverageAnalysisResult,
  FileCoverageHint,
} from '../tests/coverageTypes';

/**
 * Convert a FileCoverageHint to FileCoverageInfo
 * Maps coverage level to estimated percentage
 */
function hintToInfo(hint: FileCoverageHint): FileCoverageInfo {
  // Map coverage level to estimated percentage
  let coveragePct: number | null = null;
  switch (hint.coverageLevel) {
    case 'HIGH':
      coveragePct = 80;
      break;
    case 'MEDIUM':
      coveragePct = 50;
      break;
    case 'LOW':
      coveragePct = 20;
      break;
    case 'NONE':
      coveragePct = 0;
      break;
  }

  return {
    filePath: hint.filePath,
    coveragePct,
    riskScore: hint.riskScore,
  };
}

/**
 * Convert CoverageAnalysisResult from coverageEngine to CoverageSnapshot
 * for use with the delta engine
 */
export function analysisResultToSnapshot(
  result: CoverageAnalysisResult | null,
): CoverageSnapshot | null {
  if (!result) return null;

  return {
    totalPct: result.summary.estimatedCoveragePercent,
    files: result.hints.map(hintToInfo),
    analyzedAt: result.summary.lastAnalyzedAt,
  };
}

// ===== Snapshot Storage for ATP Cycles =====

// In-memory storage for the current cycle's baseline
let currentCycleBaselineSnapshot: CoverageSnapshot | null = null;

/**
 * Store a baseline snapshot at the start of a test cycle
 */
export function setBaselineSnapshot(snapshot: CoverageSnapshot | null): void {
  currentCycleBaselineSnapshot = snapshot;
}

/**
 * Get the baseline snapshot for the current cycle
 */
export function getBaselineSnapshot(): CoverageSnapshot | null {
  return currentCycleBaselineSnapshot;
}

/**
 * Clear the baseline snapshot (called at end of cycle)
 */
export function clearBaselineSnapshot(): void {
  currentCycleBaselineSnapshot = null;
}

// ===== Mock Snapshots for Testing =====

/**
 * Generate a mock coverage snapshot for testing
 * In production, this should be replaced with actual coverage data
 */
export function generateMockSnapshot(): CoverageSnapshot {
  const mockFiles: FileCoverageInfo[] = [
    { filePath: 'src/api/auth.ts', coveragePct: 45, riskScore: 5 },
    { filePath: 'src/api/payments.ts', coveragePct: 30, riskScore: 5 },
    { filePath: 'src/components/Button.tsx', coveragePct: 80, riskScore: 2 },
    { filePath: 'src/hooks/useAuth.ts', coveragePct: 60, riskScore: 4 },
    { filePath: 'src/lib/utils.ts', coveragePct: 70, riskScore: 1 },
    { filePath: 'src/features/deploy/deploy.ts', coveragePct: 0, riskScore: 5 },
  ];

  const totalPct =
    mockFiles.reduce((sum, f) => sum + (f.coveragePct ?? 0), 0) /
    mockFiles.length;

  return {
    totalPct: Number(totalPct.toFixed(2)),
    files: mockFiles,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Generate a mock "after" snapshot with some changes
 * Simulates running tests and getting new coverage data
 */
export function generateMockAfterSnapshot(
  before: CoverageSnapshot | null,
): CoverageSnapshot {
  if (!before) return generateMockSnapshot();

  // Simulate some coverage changes
  const afterFiles = before.files.map((f) => {
    // Randomly improve or regress some files
    const change = Math.random();
    let newCoverage = f.coveragePct ?? 0;

    if (change < 0.2) {
      // 20% chance of regression
      newCoverage = Math.max(0, newCoverage - Math.floor(Math.random() * 10));
    } else if (change < 0.5) {
      // 30% chance of improvement
      newCoverage = Math.min(100, newCoverage + Math.floor(Math.random() * 15));
    }
    // 50% stay the same

    return {
      ...f,
      coveragePct: newCoverage,
    };
  });

  const totalPct =
    afterFiles.reduce((sum, f) => sum + (f.coveragePct ?? 0), 0) /
    afterFiles.length;

  return {
    totalPct: Number(totalPct.toFixed(2)),
    files: afterFiles,
    analyzedAt: new Date().toISOString(),
  };
}

// ===== Async Getters (for future integration with real coverage tools) =====

/**
 * Get the current coverage snapshot
 * TODO: Connect to actual coverage engine / test runner
 */
export async function getCurrentCoverageSnapshot(): Promise<CoverageSnapshot> {
  // For now, return mock data
  // In the future, this should:
  // 1. Read from coverage JSON files (lcov, istanbul, etc.)
  // 2. Or query the coverage engine directly
  return generateMockSnapshot();
}

/**
 * Get baseline coverage snapshot at the start of a test cycle
 */
export async function getBaselineCoverageSnapshotForCycle(): Promise<CoverageSnapshot | null> {
  // Use stored baseline if available
  if (currentCycleBaselineSnapshot) {
    return currentCycleBaselineSnapshot;
  }
  // Otherwise get current state
  return getCurrentCoverageSnapshot();
}

/**
 * Get coverage snapshot after running tests
 */
export async function getPostRunCoverageSnapshotForCycle(): Promise<CoverageSnapshot | null> {
  // For now, generate mock "after" data
  // In production, this should:
  // 1. Parse coverage reports generated by the test run
  // 2. Return actual coverage data
  const baseline = getBaselineSnapshot();
  return generateMockAfterSnapshot(baseline);
}
