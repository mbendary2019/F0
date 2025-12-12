// orchestrator/core/uiBuilder/uiGenerationPlanTypes.ts
// =============================================================================
// Phase 167.0 – UI Generation Plan Types
// Schema for planning and executing UI generation from screenshots/prompts
// =============================================================================

// =============================================================================
// Generation Modes
// =============================================================================

/**
 * How the UI should be generated
 */
export type UiGenerationMode =
  | 'create_page'     // Create a new page from scratch
  | 'extend_page'     // Add components to existing page
  | 'inject_section'  // Insert a section into a specific location
  | 'replace_section' // Replace existing section
  | 'create_component'; // Create standalone component

/**
 * File target kinds
 */
export type UiFileKind =
  | 'page'       // Route page (page.tsx)
  | 'layout'     // Route layout (layout.tsx)
  | 'component'  // React component
  | 'hook'       // Custom hook
  | 'style'      // CSS/SCSS file
  | 'util'       // Utility/helper
  | 'type'       // Type definitions
  | 'api';       // API route

// =============================================================================
// File Target
// =============================================================================

/**
 * Target file for generation/modification
 */
export interface UiFileTarget {
  path: string;            // e.g. src/app/(dashboard)/analytics/page.tsx
  kind: UiFileKind;
  language?: 'tsx' | 'ts' | 'css' | 'scss' | 'json';
}

// =============================================================================
// Component Planning
// =============================================================================

/**
 * Position hint for component placement
 */
export type UiPositionHint =
  | 'top'
  | 'bottom'
  | 'sidebar'
  | 'hero'
  | 'inline'
  | 'modal'
  | 'header'
  | 'footer'
  | 'main';

/**
 * Single component plan within a file
 */
export interface UiComponentPlan {
  id: string;                         // comp_xxx
  type: string;                       // 'StatsCardGrid', 'FilterBar', 'DataTable'
  name: string;                       // Component name to generate
  props: Record<string, unknown>;     // Props to pass
  children?: UiComponentPlan[];       // Nested components
  sourceMemoryId?: string;            // From MediaMemory/NeuralMemory
  positionHint?: UiPositionHint;
  dependencies?: string[];            // Required imports
  dataSource?: {
    type: 'api' | 'state' | 'props' | 'context';
    endpoint?: string;
    hookName?: string;
  };
}

// =============================================================================
// File Plan
// =============================================================================

/**
 * Plan for a single file (create or modify)
 */
export interface UiFilePlan {
  id: string;                         // file_xxx
  target: UiFileTarget;
  action: 'create' | 'modify';
  description: string;                // What this file does
  components: UiComponentPlan[];      // Components to include
  imports?: string[];                 // Additional imports needed
  exports?: string[];                 // What to export
  hooks?: string[];                   // Custom hooks to use
  contextProviders?: string[];        // Context providers to wrap with
}

// =============================================================================
// Style Hints
// =============================================================================

/**
 * Visual style hints extracted from design/screenshot
 */
export interface UiStyleHints {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  spacing?: 'tight' | 'normal' | 'roomy';
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  shadows?: 0 | 1 | 2 | 3;
  theme?: 'light' | 'dark' | 'auto';
  fontFamily?: string;
}

/**
 * Layout style hints
 */
export type UiLayoutStyleHint =
  | 'sidebar'
  | 'top-nav'
  | 'cards-grid'
  | 'form-page'
  | 'list-detail'
  | 'dashboard'
  | 'landing'
  | 'auth-page'
  | 'settings';

// =============================================================================
// Main Generation Plan
// =============================================================================

/**
 * Status of the generation plan
 */
export type UiGenerationPlanStatus =
  | 'PLANNED'    // Plan created, not yet executed
  | 'RUNNING'    // Currently generating code
  | 'APPLIED'    // Successfully applied to project
  | 'FAILED'     // Failed during execution
  | 'CANCELLED'  // Cancelled by user
  | 'ROLLBACK';  // Changes rolled back

/**
 * Main UI Generation Plan
 * This is what the PlannerAgent produces and CodegenAgent consumes
 */
export interface UiGenerationPlan {
  id: string;                         // plan_xxx
  projectId: string;
  proposalId: string;                 // Link to UiGenerationProposal
  sourceAttachmentId?: string;        // Screenshot/design attachment

  // Generation config
  mode: UiGenerationMode;
  routePath: string;                  // '/dashboard/analytics'
  pageName: string;                   // 'AnalyticsDashboardPage'

  // Layout & Style
  layoutStyleHint?: UiLayoutStyleHint;
  styleHints?: UiStyleHints;

  // Files to generate/modify
  files: UiFilePlan[];

  // Execution tracking
  status: UiGenerationPlanStatus;
  errorMessage?: string;
  errorStack?: string;

  // Dependencies
  requiredPackages?: string[];        // npm packages to install
  requiredComponents?: string[];      // Components from design system

  // Context references
  neuralContextIds?: string[];        // Neural memory items used
  mediaMemoryIds?: string[];          // Media memory nodes used

  // Timestamps
  createdAt: number;
  updatedAt: number;
  executedAt?: number;
  completedAt?: number;

  // User info
  createdBy?: string;
}

// =============================================================================
// File Changes (Output of CodegenAgent)
// =============================================================================

/**
 * Single file change result
 */
export interface UiFileChange {
  id: string;                         // change_xxx
  target: UiFileTarget;
  action: 'create' | 'modify' | 'delete';
  language: 'tsx' | 'ts' | 'css' | 'scss' | 'json';

  // Content
  newContent?: string;                // Full content for create
  originalContent?: string;           // Original content for modify
  patch?: string;                     // Unified diff for modify

  // Metadata
  summary: string;                    // What changed
  linesAdded?: number;
  linesRemoved?: number;

  // Validation
  syntaxValid?: boolean;
  typeCheckPassed?: boolean;
  lintPassed?: boolean;
}

/**
 * Result of code generation
 */
export interface UiCodegenResult {
  planId: string;
  projectId: string;
  files: UiFileChange[];

  // Summary
  totalFiles: number;
  filesCreated: number;
  filesModified: number;

  // Timing
  generationTimeMs: number;

  // Errors
  errors?: Array<{
    file: string;
    error: string;
    recoverable: boolean;
  }>;
}

// =============================================================================
// Apply Result
// =============================================================================

/**
 * Result of applying changes to the project
 */
export interface UiApplyResult {
  planId: string;
  projectId: string;
  success: boolean;

  // Applied files
  appliedFiles: UiFileTarget[];
  failedFiles?: Array<{
    target: UiFileTarget;
    error: string;
  }>;

  // Rollback info
  rollbackAvailable: boolean;
  rollbackId?: string;

  // Summary
  summary: string;

  // Timing
  applyTimeMs: number;
}

// =============================================================================
// Orchestration Types
// =============================================================================

/**
 * Parameters for executing UI generation
 */
export interface ExecuteUiGenerationParams {
  projectId: string;
  proposalId: string;
  attachmentId?: string;
  modeOverride?: UiGenerationMode;
  dryRun?: boolean;                   // Don't actually apply changes
  skipValidation?: boolean;           // Skip syntax/type checking
}

/**
 * Full result of UI generation execution
 */
export interface ExecuteUiGenerationResult {
  plan: UiGenerationPlan;
  codegen: UiCodegenResult;
  applySummary: UiApplyResult;

  // Overall status
  success: boolean;
  stage: 'PLAN' | 'CODEGEN' | 'APPLY' | 'COMPLETE';
  errorMessage?: string;

  // Links for user
  viewDiffUrl?: string;
  openInIdeUrl?: string;
}

// =============================================================================
// Request Types (from UI/API)
// =============================================================================

/**
 * Request to build a generation plan
 */
export interface BuildPlanRequest {
  projectId: string;
  proposalId: string;
  attachmentId?: string;
  targetRoute?: string;               // Override route path
  mode?: UiGenerationMode;
  styleOverrides?: Partial<UiStyleHints>;
}

/**
 * Request to execute generation
 */
export interface ExecuteGenerationRequest {
  projectId: string;
  planId?: string;                    // Use existing plan
  proposalId?: string;                // Or build new plan from proposal
  dryRun?: boolean;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation result for a file
 */
export interface UiFileValidation {
  target: UiFileTarget;
  syntaxValid: boolean;
  typeCheckPassed: boolean;
  lintPassed: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Overall validation result
 */
export interface UiValidationResult {
  valid: boolean;
  files: UiFileValidation[];
  blockers: string[];
  warnings: string[];
}

// =============================================================================
// Rollback Types
// =============================================================================

/**
 * Rollback record for undoing changes
 */
export interface UiRollbackRecord {
  id: string;                         // rollback_xxx
  planId: string;
  projectId: string;
  originalFiles: Array<{
    path: string;
    content: string | null;           // null if file didn't exist
  }>;
  createdAt: number;
  expiresAt: number;                  // Auto-cleanup after
}

console.log('[167.0][UI_BUILDER] Types loaded');
