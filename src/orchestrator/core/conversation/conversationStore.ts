// orchestrator/core/conversation/conversationStore.ts
// =============================================================================
// Phase 157.1 – Conversation Store
// In-memory store for development (with Firestore-ready interface)
// =============================================================================

import {
  ConversationThread,
  ConversationTurn,
  ConversationStore,
} from './types';

function generateId(prefix = 'conv'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export class InMemoryConversationStore implements ConversationStore {
  private threads = new Map<string, ConversationThread>();
  private turns = new Map<string, ConversationTurn>();

  // ==========================================
  // Thread Operations
  // ==========================================

  async createThread(
    projectId: string,
    userId: string,
    title?: string
  ): Promise<ConversationThread> {
    const id = generateId('thread');
    const now = new Date().toISOString();

    const thread: ConversationThread = {
      id,
      projectId,
      title: title ?? 'New Conversation',
      createdBy: userId,
      createdAt: now,
      lastMessageAt: now,
      turnCount: 0,
    };

    this.threads.set(id, thread);
    console.log('[157.1][CONV_STORE] Created thread:', id);
    return thread;
  }

  async getThread(threadId: string): Promise<ConversationThread | null> {
    return this.threads.get(threadId) ?? null;
  }

  async listThreads(projectId: string, limit = 20): Promise<ConversationThread[]> {
    const projectThreads = Array.from(this.threads.values())
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    return projectThreads.slice(0, limit);
  }

  async updateThread(threadId: string, updates: Partial<ConversationThread>): Promise<void> {
    const thread = this.threads.get(threadId);
    if (!thread) return;

    const updated = { ...thread, ...updates };
    this.threads.set(threadId, updated);
  }

  async getLatestThread(projectId: string): Promise<ConversationThread | null> {
    const threads = await this.listThreads(projectId, 1);
    return threads[0] ?? null;
  }

  // ==========================================
  // Turn Operations
  // ==========================================

  async appendTurn(turn: ConversationTurn): Promise<void> {
    this.turns.set(turn.id, turn);

    // Update thread's lastMessageAt and turnCount
    const thread = this.threads.get(turn.threadId);
    if (thread) {
      thread.lastMessageAt = turn.createdAt;
      thread.turnCount = (thread.turnCount ?? 0) + 1;
      if (turn.planId) {
        thread.activePlanId = turn.planId;
      }
      this.threads.set(turn.threadId, thread);
    }

    console.log('[157.1][CONV_STORE] Appended turn:', turn.id, turn.authorRole);
  }

  async getTurn(turnId: string): Promise<ConversationTurn | null> {
    return this.turns.get(turnId) ?? null;
  }

  async listTurns(threadId: string, limit = 50): Promise<ConversationTurn[]> {
    const threadTurns = Array.from(this.turns.values())
      .filter((t) => t.threadId === threadId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return threadTurns.slice(-limit);
  }

  // ==========================================
  // Helpers for debugging
  // ==========================================

  getAllThreads(): ConversationThread[] {
    return Array.from(this.threads.values());
  }

  getAllTurns(): ConversationTurn[] {
    return Array.from(this.turns.values());
  }

  getThreadTurnCount(threadId: string): number {
    return Array.from(this.turns.values()).filter((t) => t.threadId === threadId).length;
  }
}

// Global singleton for persistence across requests
declare global {
  // eslint-disable-next-line no-var
  var __conversationStore: InMemoryConversationStore | undefined;
}

let conversationStore: InMemoryConversationStore | null = global.__conversationStore || null;

export function getConversationStore(): InMemoryConversationStore {
  if (!conversationStore) {
    conversationStore = new InMemoryConversationStore();
    global.__conversationStore = conversationStore;
    console.log('[157.1][CONV_STORE] Initialized conversation store');
  }
  return conversationStore;
}

console.log('[157.1][CONVERSATION] ConversationStore module loaded');
