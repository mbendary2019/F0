// src/types/ideEvents.ts
export type IdeEventKind =
  | 'FILE_SNAPSHOT'      // أول مرة يفتح ملف أو يعمل sync كامل
  | 'FILE_CHANGED'       // diff جزئي أو range
  | 'FILE_DELTA'         // ✅ Optimized delta for small changes
  | 'SELECTION_CHANGED'  // الـ cursor / selection
  | 'TEST_RESULT'
  | 'TERMINAL_OUTPUT'
  | 'HEARTBEAT';

export interface IdeEventEnvelope {
  eventId: string;            // uuid v4 من الـ IDE
  sessionId: string;          // نفس الـ session اللي ظاهر في Live Coding
  projectId: string;
  source: 'ide';
  kind: IdeEventKind;
  ts: string;                 // ISO timestamp
  payload: unknown;           // one of the payload types below
}

// أمثلة payloads أساسية نحتاجها دلوقتي:

export interface FileSnapshotPayload {
  path: string;
  languageId?: string;        // ts, js, jsx, tsx, json...
  content: string;            // full content
}

export interface FileChangedPayload {
  path: string;
  languageId?: string;
  // نبدأ بسيطة: نبعت الـ content كامل بعد التعديل
  content: string;
  // ممكن بعدين نضيف diff ranges
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

export interface SelectionChangedPayload {
  path: string;
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export interface HeartbeatPayload {
  ideName: 'vscode' | 'cursor' | 'web';
  ideVersion: string;
}

// Commands من السحابة → IDE
export type IdeCommandKind = 'APPLY_PATCH' | 'OPEN_FILE';

export interface IdeCommandEnvelope {
  commandId: string;
  sessionId: string;
  projectId: string;
  kind: IdeCommandKind;
  ts: string;
  payload: unknown;
}

export interface ApplyPatchPayload {
  patchId: string;     // id بتاع الـ patch في Firestore
  files: {
    path: string;
    newContent: string;
  }[];
}

export interface OpenFilePayload {
  path: string;
  line?: number;
  character?: number;
}

// Patch structure
export interface IdePatch {
  patchId: string;
  sessionId: string;
  projectId: string;
  createdBy: 'agent' | 'user';
  ts: string;
  files: {
    path: string;
    oldContent?: string;  // اختياري
    newContent: string;
    operation: 'modify' | 'add' | 'delete';
  }[];
  status: 'pending' | 'applied' | 'discarded';
  appliedAt?: string;
}
