// desktop/src/lib/quality/diagnosticsTypes.ts
// Phase 146.0 – Agent Diagnostics Engine: Types & Data Model
// Core types for file-level diagnostics aggregation

// ============================================
// Risk & Status Types
// ============================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type TestStatus = 'not_run' | 'passed' | 'failed' | 'error' | 'partial';

// ============================================
// File-Level Summary Types
// ============================================

export interface FileIssueSummary {
  total: number;
  bySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export interface FileSecuritySummary {
  total: number;
  blocking: number;
}

export interface FileCoverageSummary {
  hasTests: boolean;
  coveragePercent: number | null; // null if unknown
}

export interface FileAceSummary {
  lastRunAt: string | null; // ISO timestamp
  runsCount: number;
  totalApplied: number;
  totalErrors: number;
  lastResult: 'none' | 'success' | 'partial' | 'no_changes' | 'failed';
}

export interface FileTestSummary {
  status: TestStatus;
  lastRunAt: string | null;
  lastSuiteName?: string;
}

// ============================================
// Aggregated File Diagnostics
// ============================================

export interface FileDiagnostics {
  /** Relative path within the project */
  path: string;
  /** Risk score from 0-100 (higher = more risk) */
  riskScore: number;
  /** Risk level derived from riskScore */
  riskLevel: RiskLevel;
  /** Issue summary for this file */
  issues: FileIssueSummary;
  /** Security summary for this file */
  security: FileSecuritySummary;
  /** Coverage summary for this file */
  coverage: FileCoverageSummary;
  /** ACE activity summary for this file */
  ace: FileAceSummary;
  /** Test summary for this file */
  tests: FileTestSummary;
}

// ============================================
// Project-Level Diagnostics
// ============================================

export interface ProjectDiagnostics {
  /** ISO timestamp when diagnostics were generated */
  generatedAt: string;
  /** Project root path */
  projectRoot: string;
  /** Files sorted by riskScore (worst first) */
  files: FileDiagnostics[];
}

// ============================================
// Summary Stats (for UI display)
// ============================================

export interface DiagnosticsSummaryStats {
  totalFiles: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  averageRiskScore: number;
  worstFile: FileDiagnostics | null;
}

/**
 * Compute summary stats from project diagnostics
 */
export function computeDiagnosticsSummary(
  diagnostics: ProjectDiagnostics
): DiagnosticsSummaryStats {
  const files = diagnostics.files;

  if (files.length === 0) {
    return {
      totalFiles: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      averageRiskScore: 0,
      worstFile: null,
    };
  }

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let totalScore = 0;

  for (const file of files) {
    totalScore += file.riskScore;
    switch (file.riskLevel) {
      case 'critical':
        criticalCount++;
        break;
      case 'high':
        highCount++;
        break;
      case 'medium':
        mediumCount++;
        break;
      case 'low':
        lowCount++;
        break;
    }
  }

  return {
    totalFiles: files.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    averageRiskScore: Math.round(totalScore / files.length),
    worstFile: files[0] || null,
  };
}
