// orchestrator/core/conversation/types.ts
// =============================================================================
// Phase 157.1 + 162 – Conversation Types
// Data model for project conversations with Media Chat support
// =============================================================================

export type ConversationRole = 'user' | 'assistant' | 'system';

export interface ConversationTurn {
  id: string;
  threadId: string;
  projectId: string;
  authorRole: ConversationRole;
  authorId?: string;
  content: string;
  createdAt: string;
  planId?: string;       // If this turn triggered or references a Plan
  attachments?: string[]; // Phase 158: Array of attachment IDs

  // Phase 162: Media Chat focus fields
  focusAttachmentId?: string;  // Media file this message is about
  focusPage?: number;          // For PDFs: specific page number
  focusRegionHint?: string;    // UI region hint: "header", "login-form", etc.

  metadata?: {
    intent?: 'question' | 'command' | 'feedback';
    filesReferenced?: string[];
    codeSnippets?: string[];
    [key: string]: unknown;
  };
}

export interface ConversationThread {
  id: string;
  projectId: string;
  title?: string;
  createdBy: string;
  createdAt: string;
  lastMessageAt: string;
  activePlanId?: string;
  turnCount?: number;

  // Phase 162: Media Chat mode
  mediaMode?: boolean;             // Thread focused on media conversation
  defaultAttachmentId?: string;    // Default attachment for this thread
  mediaType?: 'image' | 'pdf' | 'audio' | 'document';  // Type hint for UI

  metadata?: {
    context?: string[];   // Files/issues being discussed
    tags?: string[];
    [key: string]: unknown;
  };
}

export interface ConversationStore {
  // Thread operations
  createThread(projectId: string, userId: string, title?: string): Promise<ConversationThread>;
  getThread(threadId: string): Promise<ConversationThread | null>;
  listThreads(projectId: string, limit?: number): Promise<ConversationThread[]>;
  updateThread(threadId: string, updates: Partial<ConversationThread>): Promise<void>;

  // Turn operations
  appendTurn(turn: ConversationTurn): Promise<void>;
  getTurn(turnId: string): Promise<ConversationTurn | null>;
  listTurns(threadId: string, limit?: number): Promise<ConversationTurn[]>;

  // Helpers
  getLatestThread(projectId: string): Promise<ConversationThread | null>;
}

console.log('[162][CONVERSATION] Types loaded with Media Chat support');
