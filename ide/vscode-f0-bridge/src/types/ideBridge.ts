// src/types/ideBridge.ts

export type IdeEventKind =
  | 'FILE_SNAPSHOT'
  | 'FILE_CHANGED'
  | 'FILE_DELTA'        // ✅ Optimized delta for small changes
  | 'SELECTION_CHANGED'
  | 'HEARTBEAT';

export interface IdeEventEnvelope {
  eventId: string;
  sessionId: string;
  projectId: string;
  source: 'vscode';
  kind: IdeEventKind;
  ts: string;
  payload: any;
}

export interface FileSnapshotPayload {
  path: string;
  languageId?: string;
  content: string;
}

export interface FileChangedPayload {
  path: string;
  languageId?: string;
  content: string;
}

export interface FileDeltaPayload {
  path: string;
  languageId?: string;
  // Index where change starts (string level)
  start: number;
  // Length of old text to delete
  deleteCount: number;
  // New text to insert
  insertText: string;
}

export type IdeCommandKind = 'APPLY_PATCH' | 'OPEN_FILE';

export interface IdeCommandEnvelope {
  commandId: string;
  sessionId: string;
  projectId: string;
  kind: IdeCommandKind;
  ts: string;
  payload: any;
}

export interface ApplyPatchPayload {
  patchId: string;
  files: {
    path: string;
    newContent: string;
  }[];
}
