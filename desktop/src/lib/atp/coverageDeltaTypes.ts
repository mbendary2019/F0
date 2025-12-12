// desktop/src/lib/atp/coverageDeltaTypes.ts
// Phase 140.2: Coverage Delta Types for ATP
// Types for tracking coverage changes between test cycles

/**
 * Coverage info for a single file
 */
export interface FileCoverageInfo {
  filePath: string;
  coveragePct: number | null; // 0-100, or null if no data
  riskScore?: number;         // 1-5 from coverageEngine
}

/**
 * Coverage delta for a single file
 */
export interface FileCoverageDelta {
  filePath: string;
  before: number | null;
  after: number | null;
  delta: number | null;
  riskScore?: number;
  isRegression: boolean;
  isImprovement: boolean;
  isHighRiskUntested: boolean;
}

/**
 * Summary of coverage changes across the project
 */
export interface CoverageDeltaSummary {
  totalBefore: number | null;
  totalAfter: number | null;
  totalDelta: number | null;
  regressions: FileCoverageDelta[];
  improvements: FileCoverageDelta[];
  untestedHighRiskFiles: FileCoverageDelta[];
}

/**
 * Snapshot of coverage state at a point in time
 * Compatible with CoverageAnalysisResult from coverageEngine
 */
export interface CoverageSnapshot {
  totalPct: number | null;
  files: FileCoverageInfo[];
  analyzedAt?: string;
}

/**
 * Options for computing coverage delta
 */
export interface CoverageDeltaOptions {
  /** Risk score threshold (0-1) for high-risk files. Default: 0.7 (risk >= 4 out of 5) */
  highRiskThreshold?: number;
  /** Minimum percentage drop to count as regression. Default: 2% */
  significantRegressionPct?: number;
}
