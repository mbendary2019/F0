// desktop/src/autoFix/aceAutoFixTypes.ts
// Phase 145.0 — ACE Auto-Fix Types & Contracts
// Phase 145.3.3 — Added riskLevel support

/**
 * Phase 145.3.3: Risk level for ACE Auto-Fix
 * Based on Quality Profile settings
 */
export type AceRiskLevel = 'conservative' | 'balanced' | 'aggressive';

/**
 * Request payload for ACE Auto-Fix
 */
export type AceAutoFixRequest = {
  filePath: string;
  language: 'ts' | 'tsx' | 'js' | 'jsx' | 'json' | 'other';
  source: string;
  issues: {
    id: string;
    ruleId?: string;
    message: string;
    line: number;
    column: number;
    severity: 'low' | 'medium' | 'high';
  }[];
  /** Phase 145.3.3: Risk level from Quality Profile */
  riskLevel?: AceRiskLevel;
};

/**
 * Single patch from ACE Auto-Fix
 */
export type AceAutoFixPatch = {
  id: string;                 // issue id
  description: string;        // summary of what the patch fixes
  startLine: number;          // inclusive
  endLine: number;            // inclusive
  replacement: string;        // new code block
};

/**
 * Response from ACE Auto-Fix backend
 */
export type AceAutoFixResponse = {
  filePath: string;
  patches: AceAutoFixPatch[];
  notes?: string[];
};

/**
 * Result after applying ACE patches
 */
export type AceAutoFixResult = {
  success: boolean;
  filePath: string;
  appliedPatches: number;
  skippedPatches: number;
  errors: string[];
  notes?: string[];
};

// ============================================
// Phase 145.3: ACE-Guided Project Auto-Fix Types
// ============================================

/**
 * Phase 145.3: ACE-Guided Auto-Fix Plan
 * Prioritizes files based on ACE Code Evolution analysis
 */
export type AceGuidedAutoFixPlan = {
  /** Target files to fix (prioritized) */
  targetFiles: string[];
  /** Issue IDs grouped by file */
  issuesByFile: Record<string, string[]>;
  /** Source of prioritization */
  // Phase 146.7: Added 'diagnostics' source for Diagnostics-based prioritization
  source: 'diagnostics' | 'ace_evolution' | 'issue_count_fallback';
  /** Total issues in plan */
  totalIssues: number;
};

/**
 * Phase 145.3.2: Issue data for ACE Auto-Fix
 */
export type IssueData = {
  id: string;
  message: string;
  line: number;
  column?: number;
  severity: 'info' | 'warning' | 'error';
  category?: string;
  ruleId?: string;
};

/**
 * Phase 145.3: Options for ACE-Guided Project Auto-Fix
 */
export type AceGuidedProjectAutoFixOptions = {
  projectRoot: string;
  plan: AceGuidedAutoFixPlan;
  /** Suppress per-file logs */
  quiet?: boolean;
  /** Create backup before fixing each file */
  createBackup?: boolean;
  /** Phase 145.3.2: Map of issue ID to full issue data */
  issuesData?: Map<string, IssueData>;
  /** Phase 145.3.3: Risk level for ACE Auto-Fix */
  riskLevel?: AceRiskLevel;
};

/**
 * Phase 145.3: Result of ACE-Guided Project Auto-Fix
 * Phase 147.2: Added targetedIssues for per-run tracking
 */
export type AceGuidedProjectAutoFixResult = {
  /** Results per file */
  fileResults: Record<string, AceAutoFixResult>;
  /** Total patches applied */
  totalApplied: number;
  /** Total patches skipped */
  totalSkipped: number;
  /** Total errors encountered */
  totalErrors: number;
  /** Files that were processed */
  filesProcessed: number;
  /** Duration in ms */
  durationMs: number;
  /** Notes from the run */
  notes: string[];
  /** Phase 147.2: Total issues targeted in this run's plan */
  targetedIssues?: number;
};
