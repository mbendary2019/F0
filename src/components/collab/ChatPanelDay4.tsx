/**
 * Phase 53 Day 4 - Chat & Comments Thread
 * UI component for chat panel with threaded conversations
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ChatMessage, ChatAuthor } from '@/lib/collab/chat/types';

export default function ChatPanelDay4({
  threads = [],
  onSend,
  me,
  onReply,
}: {
  threads?: (ChatMessage & { replies: ChatMessage[] })[];
  onSend: (text: string) => void;
  onReply: (threadId: string, text: string) => void;
  me: ChatAuthor;
}) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threads]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(text);
      setText('');
    }
  };

  return (
    <div className="w-80 shrink-0 h-full border-l border-white/10 bg-neutral-950 flex flex-col">
      <div className="p-3 border-b border-white/10 text-sm font-semibold text-white">
        Chat & Comments
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {threads.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-white/10 p-2"
          >
            <Item msg={t} />
            {t.replies.length > 0 && (
              <div className="mt-2 space-y-2 pl-4 border-l border-white/10">
                {t.replies.map((r) => (
                  <Item key={r.id} msg={r} />
                ))}
              </div>
            )}
            <ReplyBox onSubmit={(v) => onReply(t.id, v)} />
          </motion.div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-2 border-t border-white/10">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-md bg-neutral-900 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/30 text-white"
          />
          <button
            type="submit"
            className="px-3 py-2 text-sm rounded-md border border-white/20 hover:border-white/40 text-white"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function Item({ msg }: { msg: ChatMessage }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: msg.author.color }}
        />
        <span className="font-medium text-white">{msg.author.name}</span>
        <span className="text-xs text-white/50">
          {new Date(msg.createdAt).toLocaleTimeString()}
        </span>
      </div>
      <div className="mt-1 whitespace-pre-wrap text-white/90">{msg.text}</div>
      {msg.anchor && (
        <div className="mt-1 text-xs text-white/60">
          ↳ anchored to selection (L{msg.anchor.start.line}:{msg.anchor.start.column}–L
          {msg.anchor.end.line}:{msg.anchor.end.column})
        </div>
      )}
    </div>
  );
}

function ReplyBox({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [v, setV] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (v.trim()) {
      onSubmit(v.trim());
      setV('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Reply…"
        className="flex-1 rounded-md bg-neutral-900 border border-white/10 px-2 py-1.5 text-xs outline-none focus:border-white/30 text-white"
      />
      <button
        type="submit"
        className="px-2 py-1.5 text-xs rounded-md border border-white/20 hover:border-white/40 text-white"
      >
        Reply
      </button>
    </form>
  );
}
