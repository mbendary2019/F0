/**
 * Phase 53 Day 4 - Chat & Comments Thread
 * React hook for managing chat messages and threads
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChatMessage, ChatAuthor } from './types';
import type { ChatDoc } from './awarenessChat';
import { subscribeMessages, postMessage } from './awarenessChat';

export function useChat(chatDoc: ChatDoc | null, me: ChatAuthor | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!chatDoc) return;
    return subscribeMessages(chatDoc, setMessages);
  }, [chatDoc]);

  const send = (text: string, opts?: Partial<Pick<ChatMessage, 'anchor' | 'threadId'>>) => {
    if (!chatDoc || !me || !text.trim()) return;
    postMessage(chatDoc, { text: text.trim(), author: me, roomId: 'default', ...opts });
  };

  const rootThreads = useMemo(() => {
    const roots = messages.filter((m) => !m.threadId);
    const replies = messages.filter((m) => !!m.threadId);
    const map = new Map<string, ChatMessage & { replies: ChatMessage[] }>();
    roots.forEach((r) => map.set(r.id, { ...r, replies: [] }));
    replies.forEach((rep) => {
      const t = map.get(rep.threadId!);
      if (t) t.replies.push(rep);
    });
    return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
  }, [messages]);

  return { messages, rootThreads, send };
}
