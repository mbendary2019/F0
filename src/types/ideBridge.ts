/**
 * Phase 84: IDE Bridge Types
 * Phase 107: Context-Aware Code Generation
 * Type definitions for VS Code / IDE integration with F0 Agent
 */

import type { F0ContextFile, F0Selection } from './context';

export type IdeClientKind = 'vscode' | 'cursor-like';

export interface IdeSession {
  id: string;
  projectId: string;
  clientKind: IdeClientKind;
  createdAt: string;
  createdBy: string; // uid
}

/**
 * Phase 84.7: Workspace Context
 */
export interface IdeWorkspaceContext {
  projectId?: string;
  sessionId?: string;
  openedFiles?: { path: string; languageId?: string }[];
  currentFile?: { path: string; languageId?: string };
  changedFiles?: { path: string; status: 'modified' | 'added' | 'deleted' }[];
  packageJson?: {
    path?: string;
    content?: string;
    deps?: Record<string, string>;
    devDeps?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  timestamp?: number;
}

/**
 * Phase 85.1: Workspace Plan Types
 * Phase 85.4.1: Impact & Risk Estimation
 */

export type ImpactLevel = "low" | "medium" | "high";
export type RiskLevel = "low" | "medium" | "high";

export interface WorkspacePlanStepImpact {
  fileImpacts: Array<{
    path: string;
    fanIn: number;
    fanOut: number;
    isCore: boolean;
    isGodFile: boolean;
    isCycleParticipant: boolean;
    predictedBlastRadius: number;
    impact: ImpactLevel;
    risk: RiskLevel;
  }>;
  overallImpact: ImpactLevel;
  overallRisk: RiskLevel;
  blastRadius: number;
  notes?: string;
}

export interface WorkspacePlanStep {
  id: string;
  title: string;
  description: string;
  targetFiles: string[]; // e.g. ["src/index.ts", "src/utils.ts"]
  changeKind:
    | 'refactor'
    | 'bugfix'
    | 'performance'
    | 'typing'
    | 'style'
    | 'structure'
    | 'docs'
    | 'other';
  estimatedImpact?: string; // human-readable summary
  // Phase 85.4.1: Impact & Risk Estimation
  impact?: WorkspacePlanStepImpact;
}

export interface WorkspacePlan {
  goal: string; // user goal in natural language
  summary: string; // high-level explanation
  steps: WorkspacePlanStep[];
}

/**
 * Phase 85.1: Chat Modes
 */
export type IdeChatMode =
  | 'single-file'          // السلوك الحالي (default)
  | 'multi-file-plan'      // نعمل Plan فقط
  | 'multi-file-apply';    // Plan + patches

export interface IdeChatRequest {
  sessionId: string;
  projectId: string;
  message: string;
  locale?: string;
  // Phase 106: OpenAI-compatible fields
  prompt?: string;      // Alternative to message (for OpenAI compat)
  input?: string;       // Alternative to message (for agent input)
  // Phase 109: Desktop IDE support
  ideType?: 'continue' | 'vscode' | 'web' | 'desktop';     // IDE client type
  fileContext?: {
    filePath?: string;  // Made optional for Phase 106
    path?: string;      // Phase 106: Alternative field name
    content: string;
    languageId?: string;
    selection?: {
      startLine: number;
      startCol: number;
      endLine: number;
      endCol: number;
    } | null;
    isOpen?: boolean;   // Phase 106: File open state
  }[];
  // Phase 84.7: Workspace context
  workspaceContext?: IdeWorkspaceContext;
  // Phase 85.1: Chat mode
  mode?: IdeChatMode;
  // Phase 106: Metadata
  metadata?: Record<string, any>;

  /**
   * Phase 107: Context-aware code generation
   * Primary file being edited (for determining refactor vs generation mode)
   */
  primaryFilePath?: string;

  /**
   * Phase 107: Selection in primary file (if any)
   * Presence of selection indicates REFACTOR mode
   */
  selection?: F0Selection;

  /**
   * Phase 107: Enhanced file context with F0ContextFile format
   * Replaces/augments legacy fileContext for better type safety
   */
  contextFiles?: F0ContextFile[];
}

export interface IdeChatResponse {
  messageId: string;
  replyText: string;
  patchSuggestion?: {
    hasPatch: boolean;
    patchText?: string; // unified diff block
  };
  taskKind?: string;
  // Phase 85.1: Workspace plan support
  kind?: 'single-file' | 'workspace-plan' | 'workspace-plan+patches';
  plan?: WorkspacePlan;
  patches?: Array<{
    filePath: string;
    diff: string;
    stepId?: string; // Phase 85.2: Link patch to plan step
  }>;
}

export interface IdeSessionRequest {
  projectId: string;
  clientKind?: IdeClientKind;
}

export interface IdeSessionResponse {
  sessionId: string;
  projectId: string;
  clientKind: IdeClientKind;
}

/**
 * Phase 85.3: Project Dependency Analysis Types
 */
export interface IdeDependencyEdge {
  from: string; // file path
  to: string;   // file path
  kind: "import" | "dynamic-import" | "require" | "export" | "other";
}

export interface IdeFileNode {
  path: string;
  languageId?: string;
  imports: string[];        // raw import specifiers (e.g., "./utils", "react")
  dependsOn: string[];      // resolved workspace file paths
  dependents?: string[];    // files that depend on this file
  fanIn?: number;           // how many files depend on this
  fanOut?: number;          // how many files this depends on
}

export interface IdeProjectIssue {
  id: string;
  kind: "cycle" | "high-fan-in" | "high-fan-out" | "orphan" | "other";
  severity: "info" | "warning" | "error";
  title: string;
  description: string;
  files: string[];
}

export interface IdeProjectAnalysisSummary {
  projectId: string;
  fileCount: number;
  edgeCount: number;
  createdAt: number;
  topFanIn: Array<{ path: string; fanIn: number }>;
  topFanOut: Array<{ path: string; fanOut: number }>;
  cycles: string[][];
  issues: IdeProjectIssue[];
}

export interface IdeProjectAnalysisDocument {
  summary: IdeProjectAnalysisSummary;
  files: IdeFileNode[];
  edges: IdeDependencyEdge[];
}
