/**
 * Phase 53 Day 4 - Chat & Comments Thread
 * Awareness adapter bridge using Y.js shared array for messages
 * (ephemeral by default) + optional Firestore persistence
 */

import * as Y from 'yjs';
import { nanoid } from 'nanoid';
import type { ChatMessage, ChatAuthor } from './types';

export type ChatDoc = {
  ydoc: Y.Doc;
  yarr: Y.Array<ChatMessage>;
};

export function createChatDoc(ydoc: Y.Doc): ChatDoc {
  const yarr = ydoc.getArray<ChatMessage>('chat');
  return { ydoc, yarr };
}

export function postMessage(
  chat: ChatDoc,
  msg: Omit<ChatMessage, 'id' | 'createdAt'> & Partial<Pick<ChatMessage, 'createdAt' | 'id'>>
) {
  const full: ChatMessage = {
    id: msg.id || nanoid(),
    createdAt: msg.createdAt || Date.now(),
    anchor: null,
    threadId: null,
    ...msg,
  } as ChatMessage;
  chat.yarr.push([full]);
  return full;
}

export function subscribeMessages(chat: ChatDoc, cb: (list: ChatMessage[]) => void) {
  const emit = () => cb(chat.yarr.toArray());
  const observer = () => emit();
  chat.yarr.observe(observer);
  emit();
  return () => chat.yarr.unobserve(observer);
}
