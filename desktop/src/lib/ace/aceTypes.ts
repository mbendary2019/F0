// desktop/src/lib/ace/aceTypes.ts
// Phase 128.0: Core ACE (Auto Code Evolution) Types

/**
 * File-level technical debt score
 */
export type AceFileScore = {
  /** Full file path */
  filePath: string;
  /** Relative path for display */
  relativePath: string;
  /** Number of issues from ProjectIssues */
  healthIssues: number;
  /** Health score 0-100 (higher is better) */
  healthScore: number;
  /** File size in lines */
  sizeLines: number;
  /** Complexity estimate (proxy: issues + size) */
  complexity: number;
  /** Issue counts by category */
  categoryWeights: {
    logging: number;
    types: number;
    style: number;
    deadCode: number;
    security: number;
    performance: number;
    other: number;
  };
  /** Risk level based on health score */
  riskLevel: 'low' | 'medium' | 'high';
};

/**
 * Suggestion type identifiers
 */
export type AceSuggestionId =
  | 'split_large_file'
  | 'convert_js_to_ts'
  | 'cleanup_logging_heavy_file'
  | 'reduce_any_types'
  | 'extract_shared_utils'
  | 'tighten_tsconfig'
  | 'remove_legacy_backups'
  | 'improve_security_rules'
  | 'reduce_file_complexity'
  | 'cleanup_dead_code'
  | 'improve_test_coverage';

/**
 * A single evolution suggestion
 */
export type AceSuggestion = {
  /** Unique suggestion ID */
  id: string;
  /** Suggestion type */
  type: AceSuggestionId;
  /** Display title */
  title: string;
  /** Arabic title */
  titleAr: string;
  /** Detailed description */
  description: string;
  /** Arabic description */
  descriptionAr: string;
  /** Files affected by this suggestion */
  targetFiles: string[];
  /** Estimated impact level */
  estimatedImpact: 'low' | 'medium' | 'high';
  /** Estimated effort (S=Small, M=Medium, L=Large) */
  estimatedEffort: 'S' | 'M' | 'L';
  /** When this suggestion was created */
  createdAt: string;
  /** Icon for UI */
  icon: string;
};

/**
 * A phase in the evolution plan
 */
export type AcePlanPhase = {
  /** Phase ID */
  id: string;
  /** Phase title */
  title: string;
  /** Arabic title */
  titleAr: string;
  /** Phase description */
  description: string;
  /** Arabic description */
  descriptionAr: string;
  /** Display order */
  order: number;
  /** Suggestion IDs in this phase */
  suggestionIds: string[];
  /** Estimated total effort */
  estimatedEffort: 'S' | 'M' | 'L';
  /** Phase status */
  status: 'pending' | 'in_progress' | 'completed';
};

/**
 * The full evolution plan
 */
export type AcePlan = {
  /** Plan ID */
  id: string;
  /** Plan name */
  name: string;
  /** Arabic name */
  nameAr: string;
  /** When created */
  createdAt: string;
  /** Plan summary */
  summary: string;
  /** Arabic summary */
  summaryAr: string;
  /** Plan phases */
  phases: AcePlanPhase[];
  /** Overall progress percentage */
  progress: number;
};

/**
 * Impact analysis result
 */
export type AceImpactResult = {
  /** Files being changed */
  targetFiles: string[];
  /** Files that import target files */
  directlyImpacted: string[];
  /** Files that transitively depend on targets */
  transitivelyImpacted: string[];
  /** Total impact count */
  totalImpact: number;
};

/**
 * Full ACE state
 */
export type AceState = {
  /** File-level scores (sorted by worst first) */
  fileScores: AceFileScore[];
  /** Generated suggestions */
  suggestions: AceSuggestion[];
  /** Active evolution plan */
  activePlan: AcePlan | null;
  /** Is ACE currently computing? */
  isComputing: boolean;
  /** Last computation time */
  lastComputedAt: string | null;
  /** Project-wide debt score (0-100) */
  overallDebtScore: number;
};

/**
 * Initial ACE state
 */
export const initialAceState: AceState = {
  fileScores: [],
  suggestions: [],
  activePlan: null,
  isComputing: false,
  lastComputedAt: null,
  overallDebtScore: 100,
};

export default {
  initialAceState,
};
