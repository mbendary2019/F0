// desktop/src/lib/tests/coverageTypes.ts
// Phase 137.4.0: Coverage Analysis Types
// Types for test coverage analysis and risk assessment

export type CoverageLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export type FileKind =
  | 'page'
  | 'api'
  | 'component'
  | 'logic'
  | 'config'
  | 'hook'
  | 'model'
  | 'other';

export interface FileCoverageHint {
  filePath: string;
  displayName: string;
  kind: FileKind;

  hasDirectTests: boolean;
  hasInferredTests: boolean;

  directTestFiles: string[];
  inferredTestFiles: string[];

  coverageLevel: CoverageLevel; // تقدير تقريبي
  riskScore: number;            // من 1 إلى 5
  reasons: string[];            // ليه الملف ده مهم أو ناقصه tests
}

export interface CoverageSummary {
  totalSourceFiles: number;
  totalTestFiles: number;

  filesWithAnyTests: number;
  filesWithoutTests: number;

  estimatedCoveragePercent: number; // تقريبية (0–100)
  highRiskUntestedCount: number;
  mediumRiskUntestedCount: number;

  lastAnalyzedAt: string; // ISO string
}

export interface CoverageAnalysisResult {
  summary: CoverageSummary;
  hints: FileCoverageHint[]; // sorted by riskScore desc
}

// input generic عشان تربطها بسهولة مع testDiscovery
export interface ProjectIndexEntry {
  path: string;
  language?: string | null;
  size?: number;
}

export interface TestMappings {
  sourceToTests: Record<string, string[]>;
  testsToSource: Record<string, string[]>;
}
