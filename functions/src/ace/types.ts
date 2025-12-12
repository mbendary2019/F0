// functions/src/ace/types.ts
// Phase 147: ACE Auto-Fix Backend Types
// Shared types for ACE Cloud Function

// ============================================
// Range & Patch Types
// ============================================

export interface AceRange {
  line: number;   // 1-based line number
  column: number; // 1-based column number
}

export interface AcePatch {
  /** File path (relative to project root) */
  filePath: string;
  /** Start position of the code to replace */
  start: AceRange;
  /** End position of the code to replace */
  end: AceRange;
  /** The replacement code */
  replacement: string;
  /** Optional reason/description for the fix */
  reason?: string;
  /** Issue ID this patch addresses (if any) */
  issueId?: string;
}

// ============================================
// Request & Response Types
// ============================================

export interface AceAutoFixRequest {
  /** File path relative to project root */
  filePath: string;
  /** Description of what this file does */
  fileRole?: string;
  /** The file's source code */
  code: string;
  /** List of issues to fix */
  issues?: AceIssue[];
  /** Risk level: how aggressive should fixes be */
  riskLevel?: 'strict' | 'balanced' | 'relaxed';
  /** Language of the file */
  language?: 'ts' | 'tsx' | 'js' | 'jsx' | 'json' | 'other';
  /** If true, only analyze but don't generate patches */
  dryRun?: boolean;
}

export interface AceIssue {
  id: string;
  message: string;
  line: number;
  column?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  ruleId?: string;
}

export interface AceAutoFixResult {
  /** List of patches to apply */
  patches: AcePatch[];
  /** Human-readable summary of changes */
  summary?: string;
  /** Any notes or warnings */
  notes?: string[];
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

// ============================================
// OpenAI Response Schema Types
// ============================================

export interface OpenAIPatchResponse {
  summary?: string;
  patches: Array<{
    filePath?: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
    replacement: string;
    reason?: string;
  }>;
}
