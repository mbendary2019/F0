/**
 * API Types for Cursor Bridge
 * Mirrors types from main project's ideBridge.ts
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
  patchText?: string;
}

export interface IdeChatResponse {
  messageId: string;
  replyText: string;
  patchSuggestion?: IdePatchSuggestion;
  taskKind?: string;
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
