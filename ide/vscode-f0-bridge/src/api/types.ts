/**
 * IDE Bridge Types
 * Shared between extension and backend
 * Mirrors types from src/types/ideBridge.ts in main project
 */

export type IdeClientKind = 'vscode' | 'cursor-like';

export interface IdeSession {
  id: string;
  projectId: string;
  clientKind: IdeClientKind;
  createdAt: string;
  createdBy: string;
}

export interface IdeFileSelection {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface IdeFileContext {
  filePath: string;
  content: string;
  languageId?: string;
  selection?: IdeFileSelection;
}

/**
 * Phase 84.7: Workspace Context
 */
export interface IdeWorkspaceContext {
  projectId: string;
  sessionId: string;
  openedFiles: { path: string; languageId?: string }[];
  currentFile?: { path: string; languageId?: string };
  changedFiles?: { path: string; status: 'modified' | 'added' | 'deleted' }[];
  packageJson?: {
    path: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  timestamp?: number;
}

export interface IdeChatRequest {
  sessionId: string;
  projectId: string;
  message: string;
  locale?: string;
  fileContext?: IdeFileContext;
  workspaceContext?: IdeWorkspaceContext;
}

export interface IdePatchSuggestion {
  hasPatch: boolean;
  patchText?: string; // unified diff block
}

export interface IdeChatResponse {
  messageId: string;
  replyText: string;
  patchSuggestion?: IdePatchSuggestion;
  taskKind?: string;
}
