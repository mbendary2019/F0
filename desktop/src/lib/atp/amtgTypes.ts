// desktop/src/lib/atp/amtgTypes.ts
// Phase 140.3: Autonomous Missing Test Generator (AMTG) - Types
// Types and policy for auto-generating tests for high-risk untested files

/**
 * Source of the generated test suggestion
 */
export type AMTGSource = 'autonomous' | 'manual' | 'bulk';

/**
 * Test framework type
 */
export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'other';

/**
 * Policy configuration for AMTG behavior
 */
export interface AMTGPolicy {
  /** Enable/disable AMTG */
  enabled: boolean;
  /** Maximum files to generate tests for per cycle */
  maxFilesPerCycle: number;
  /** Skip files that already have tests */
  respectExistingTests: boolean;
  /** Only generate low-impact smoke tests (safer) */
  lowImpactOnly: boolean;
  /** Minimum risk score to consider (1-5) */
  minRiskScore?: number;
}

/**
 * Default AMTG policy - conservative settings
 */
export const DEFAULT_AMTG_POLICY: AMTGPolicy = {
  enabled: true,
  maxFilesPerCycle: 1,
  respectExistingTests: true,
  lowImpactOnly: true,
  minRiskScore: 4, // Only high-risk files (4-5)
};

/**
 * A generated test suggestion from AMTG
 */
export interface GeneratedTestSuggestion {
  /** Unique ID for the suggestion */
  id: string;
  /** Path to the source file being tested */
  filePath: string;
  /** Path where the test file should be created */
  testFilePath: string;
  /** Test framework to use */
  framework: TestFramework;
  /** Human-readable title */
  title: string;
  /** Description of why this test was generated */
  description?: string;
  /** Full test file content */
  content: string;
  /** How this test was generated */
  source: AMTGSource;
  /** Timestamp of generation */
  createdAt: number;
  /** Risk score of the source file (if available) */
  riskScore?: number;
}

/**
 * Result of an AMTG generation run
 */
export interface AMTGResult {
  /** Generated test suggestions */
  suggestions: GeneratedTestSuggestion[];
  /** Files that were skipped and why */
  skipped: Array<{
    filePath: string;
    reason: 'has_tests' | 'user_ignored' | 'low_risk' | 'policy_limit';
  }>;
  /** Total candidates considered */
  candidatesCount: number;
}
