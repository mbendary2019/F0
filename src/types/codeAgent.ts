// Phase 87.1 - Code Agent types

export interface CodeAgentFileContext {
  path: string;
  content: string;
  languageId?: string; // "typescript", "javascript", "json", ...
  isTestFile?: boolean;
}

export interface CodeAgentTaskRequest {
  projectId: string;
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  stack: {
    frontend: string; // "Next.js 14 + TypeScript"
    backend: string; // "Firebase Functions v2"
    db: string; // "Firestore"
  };
  files: CodeAgentFileContext[];
  mode: 'implement_task';
}

export type CodePatchAction = 'create' | 'modify' | 'delete';

export interface CodeAgentPatch {
  path: string;
  action: CodePatchAction;
  content?: string; // required if create/modify
}

export interface CodeAgentResponse {
  summary: string;
  patches: CodeAgentPatch[];
  notes?: string;
}
