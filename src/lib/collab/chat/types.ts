/**
 * Phase 53 Day 4 - Chat & Comments Thread
 * Type definitions for real-time chat and inline comments
 */

export type ChatAuthor = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
};

export type ChatMessage = {
  id: string;              // uuid
  roomId: string;          // Y-room id
  text: string;
  author: ChatAuthor;
  createdAt: number;       // Date.now()
  // If a message is an inline comment, it can store an anchor range
  anchor?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  } | null;
  // Thread id for replies (root is message.id)
  threadId?: string | null;
};
