// desktop/src/lib/quality/diagnosticsEngine.ts
// Phase 146.1 – Agent Diagnostics Engine: Worst Files Analyzer
// Aggregates quality signals per file and ranks them by risk

import type {
  FileDiagnostics,
  ProjectDiagnostics,
  RiskLevel,
  FileIssueSummary,
  FileSecuritySummary,
  FileCoverageSummary,
  FileAceSummary,
  FileTestSummary,
  TestStatus,
} from './diagnosticsTypes';

// ============================================
// Input Types
// ============================================

export interface IssueRecord {
  filePath: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityAlert {
  filePath: string;
  blocking: boolean;
}

export interface CoverageEntry {
  filePath: string;
  coveragePercent: number;
}

export interface AceRunRecord {
  filePath: string;
  runAt: string; // ISO timestamp
  applied: number;
  errors: number;
  result: 'success' | 'partial' | 'no_changes' | 'failed';
}

export interface TestRecord {
  filePath: string;
  status: TestStatus;
  runAt: string;
  suiteName?: string;
}

export interface DiagnosticsEngineInput {
  projectRoot: string;
  allFiles: string[]; // All file paths in the project
  issues: IssueRecord[];
  securityAlerts: SecurityAlert[];
  coverage: CoverageEntry[];
  aceRuns: AceRunRecord[];
  testRecords: TestRecord[];
  /** Patterns to ignore (defaults to common build/node_modules) */
  ignorePatterns?: string[];
}

// ============================================
// Default Ignore Patterns
// ============================================

const DEFAULT_IGNORE_PATTERNS = [
  'desktop/dist-electron/',
  '.next/',
  'build/',
  'out/',
  'node_modules/',
  '.git/',
  'dist/',
  'coverage/',
];

// ============================================
// Risk Score Calculation
// ============================================

/**
 * Calculate risk score for a file (0-100, higher = more risk)
 */
function calculateRiskScore(
  issues: FileIssueSummary,
  security: FileSecuritySummary,
  coverage: FileCoverageSummary,
  ace: FileAceSummary,
  tests: FileTestSummary
): number {
  let score = 0;

  // Issues contribution (max 40 points)
  score += issues.bySeverity.critical * 15;
  score += issues.bySeverity.high * 8;
  score += issues.bySeverity.medium * 3;
  score += issues.bySeverity.low * 1;
  score = Math.min(score, 40);

  // Security contribution (max 30 points)
  score += security.blocking * 20;
  score += (security.total - security.blocking) * 5;
  score = Math.min(score, 70); // Cap cumulative at 70

  // Coverage contribution (max 15 points)
  if (!coverage.hasTests) {
    score += 15;
  } else if (coverage.coveragePercent !== null) {
    // Low coverage adds risk
    if (coverage.coveragePercent < 30) {
      score += 10;
    } else if (coverage.coveragePercent < 60) {
      score += 5;
    }
  }

  // Test status contribution (max 10 points)
  if (tests.status === 'failed' || tests.status === 'error') {
    score += 10;
  } else if (tests.status === 'partial') {
    score += 5;
  } else if (tests.status === 'not_run') {
    score += 3;
  }

  // ACE activity contribution (max 5 points)
  if (ace.lastResult === 'failed') {
    score += 5;
  } else if (ace.lastResult === 'partial') {
    score += 2;
  }

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Convert risk score to risk level
 */
function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

// ============================================
// Main Engine Function
// ============================================

/**
 * Build project diagnostics from various quality signals
 * Returns files sorted by risk score (worst first)
 */
export function buildProjectDiagnostics(
  input: DiagnosticsEngineInput
): ProjectDiagnostics {
  const {
    projectRoot,
    allFiles,
    issues,
    securityAlerts,
    coverage,
    aceRuns,
    testRecords,
    ignorePatterns = DEFAULT_IGNORE_PATTERNS,
  } = input;

  // Filter out ignored files
  const filteredFiles = allFiles.filter((filePath) => {
    return !ignorePatterns.some((pattern) => filePath.includes(pattern));
  });

  // Build maps for quick lookup
  const issuesByFile = new Map<string, IssueRecord[]>();
  for (const issue of issues) {
    const existing = issuesByFile.get(issue.filePath) || [];
    existing.push(issue);
    issuesByFile.set(issue.filePath, existing);
  }

  const securityByFile = new Map<string, SecurityAlert[]>();
  for (const alert of securityAlerts) {
    const existing = securityByFile.get(alert.filePath) || [];
    existing.push(alert);
    securityByFile.set(alert.filePath, existing);
  }

  const coverageByFile = new Map<string, CoverageEntry>();
  for (const entry of coverage) {
    coverageByFile.set(entry.filePath, entry);
  }

  const aceByFile = new Map<string, AceRunRecord[]>();
  for (const run of aceRuns) {
    const existing = aceByFile.get(run.filePath) || [];
    existing.push(run);
    aceByFile.set(run.filePath, existing);
  }

  const testsByFile = new Map<string, TestRecord[]>();
  for (const record of testRecords) {
    const existing = testsByFile.get(record.filePath) || [];
    existing.push(record);
    testsByFile.set(record.filePath, existing);
  }

  // Build diagnostics for each file
  const fileDiagnostics: FileDiagnostics[] = [];

  for (const filePath of filteredFiles) {
    // Aggregate issues
    const fileIssues = issuesByFile.get(filePath) || [];
    const issueSummary: FileIssueSummary = {
      total: fileIssues.length,
      bySeverity: {
        low: fileIssues.filter((i) => i.severity === 'low').length,
        medium: fileIssues.filter((i) => i.severity === 'medium').length,
        high: fileIssues.filter((i) => i.severity === 'high').length,
        critical: fileIssues.filter((i) => i.severity === 'critical').length,
      },
    };

    // Aggregate security
    const fileSecurityAlerts = securityByFile.get(filePath) || [];
    const securitySummary: FileSecuritySummary = {
      total: fileSecurityAlerts.length,
      blocking: fileSecurityAlerts.filter((a) => a.blocking).length,
    };

    // Aggregate coverage
    const fileCoverage = coverageByFile.get(filePath);
    const coverageSummary: FileCoverageSummary = {
      hasTests: fileCoverage !== undefined,
      coveragePercent: fileCoverage?.coveragePercent ?? null,
    };

    // Aggregate ACE runs
    const fileAceRuns = aceByFile.get(filePath) || [];
    const sortedAceRuns = [...fileAceRuns].sort(
      (a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime()
    );
    const latestAce = sortedAceRuns[0];
    const aceSummary: FileAceSummary = {
      lastRunAt: latestAce?.runAt ?? null,
      runsCount: fileAceRuns.length,
      totalApplied: fileAceRuns.reduce((sum, r) => sum + r.applied, 0),
      totalErrors: fileAceRuns.reduce((sum, r) => sum + r.errors, 0),
      lastResult: latestAce?.result ?? 'none',
    };

    // Aggregate tests
    const fileTests = testsByFile.get(filePath) || [];
    const sortedTests = [...fileTests].sort(
      (a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime()
    );
    const latestTest = sortedTests[0];
    const testSummary: FileTestSummary = {
      status: latestTest?.status ?? 'not_run',
      lastRunAt: latestTest?.runAt ?? null,
      lastSuiteName: latestTest?.suiteName,
    };

    // Calculate risk score
    const riskScore = calculateRiskScore(
      issueSummary,
      securitySummary,
      coverageSummary,
      aceSummary,
      testSummary
    );

    fileDiagnostics.push({
      path: filePath,
      riskScore,
      riskLevel: scoreToRiskLevel(riskScore),
      issues: issueSummary,
      security: securitySummary,
      coverage: coverageSummary,
      ace: aceSummary,
      tests: testSummary,
    });
  }

  // Sort by risk score (worst first)
  fileDiagnostics.sort((a, b) => b.riskScore - a.riskScore);

  return {
    generatedAt: new Date().toISOString(),
    projectRoot,
    files: fileDiagnostics,
  };
}

/**
 * Get only files above a certain risk threshold
 */
export function getHighRiskFiles(
  diagnostics: ProjectDiagnostics,
  minRiskLevel: RiskLevel = 'high'
): FileDiagnostics[] {
  const thresholds: Record<RiskLevel, number> = {
    low: 0,
    medium: 20,
    high: 45,
    critical: 70,
  };

  const minScore = thresholds[minRiskLevel];
  return diagnostics.files.filter((f) => f.riskScore >= minScore);
}

/**
 * Get top N worst files
 */
export function getWorstFiles(
  diagnostics: ProjectDiagnostics,
  count: number = 10
): FileDiagnostics[] {
  return diagnostics.files.slice(0, count);
}

/**
 * Filter diagnostics to only include files matching a pattern
 */
export function filterDiagnosticsByPattern(
  diagnostics: ProjectDiagnostics,
  pattern: string
): ProjectDiagnostics {
  const regex = new RegExp(pattern, 'i');
  return {
    ...diagnostics,
    files: diagnostics.files.filter((f) => regex.test(f.path)),
  };
}
