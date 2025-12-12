// desktop/src/lib/testing/itg/itgConstants.ts
// Phase 139.0: Intelligent Test Generator Constants

export const ITG_DEFAULT_MAX_FILES = 50;
export const ITG_DEFAULT_MAX_SUGGESTIONS = 30;

// Risk weights for scoring (Phase 139.1)
export const ITG_RISK_WEIGHTS = {
  lowCoverage: 0.4,
  highIssueCount: 0.3,
  recentChanges: 0.2,
  fileSize: 0.1,
} as const;

// Priority thresholds
export const ITG_PRIORITY_THRESHOLDS = {
  P0_MIN_IMPACT: 80,  // Impact score >= 80 → P0
  P1_MIN_IMPACT: 50,  // Impact score >= 50 → P1
  P2_MIN_IMPACT: 0,   // Impact score < 50 → P2
} as const;

// File patterns to analyze
export const ITG_ANALYZABLE_PATTERNS = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
] as const;

// Patterns to exclude
export const ITG_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
] as const;
