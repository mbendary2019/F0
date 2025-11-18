'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/collab/chat/types';

type MessageItemProps = {
  msg: ChatMessage & { system?: boolean };
  isOwn: boolean;
};

function MessageItem({ msg, isOwn }: MessageItemProps) {
  const time = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // System message (AI Summary)
  if (msg.system) {
    return (
      <div className="flex justify-center my-4">
        <div className="max-w-[90%] bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 border border-indigo-300 dark:border-indigo-600 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">AI Summary</span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{time}</span>
          </div>
          <div className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap break-words leading-relaxed">
            {msg.text}
          </div>
        </div>
      </div>
    );
  }

  // Regular user message
  return (
    <div className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
      <div className="flex items-baseline gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        {!isOwn && <span className="font-medium">{msg.userName}</span>}
        <span>{time}</span>
      </div>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isOwn
            ? 'bg-blue-500 text-white'
            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
        }`}
        style={!isOwn ? { borderLeft: `3px solid ${msg.userColor}` } : {}}
      >
        <div className="whitespace-pre-wrap break-words">{msg.text}</div>
      </div>
    </div>
  );
}

type ChatPanelProps = {
  roomTitle: string;
  messages: ChatMessage[];
  myUserId: string;
  onSend: (text: string) => void;
  onTyping: () => void;
};

export default function ChatPanel({
  roomTitle,
  messages,
  myUserId,
  onSend,
  onTyping,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = input.trim();
      if (trimmed) {
        onSend(trimmed);
        setInput('');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    onTyping();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {roomTitle}
        </h3>
      </div>

      {/* Messages List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-neutral-500 dark:text-neutral-400">
            No messages yet. Start chatting!
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem key={msg.id} msg={msg} isOwn={msg.userId === myUserId} />
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
        <textarea
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          rows={3}
          className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
        />
      </div>
    </div>
  );
}
