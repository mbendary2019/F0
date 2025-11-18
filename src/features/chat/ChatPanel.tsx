'use client';
import React, { useEffect, useRef, useState } from 'react';
import ChatInput from './ChatInput';
import { useChatAgent } from './useChatAgent';
import type { ChatMessage } from '@/types/project';

type MessageItemProps = {
  msg: ChatMessage;
  isOwn: boolean;
};

function MessageItem({ msg, isOwn }: MessageItemProps) {
  // Ensure createdAt is always a valid number
  const timestamp = typeof msg.createdAt === 'number' ? msg.createdAt : Date.now();
  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // System/Assistant message
  if (msg.role === 'assistant' || msg.role === 'system') {
    return (
      <div className="flex justify-start my-4">
        <div className="max-w-[90%] bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-300/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-xs font-semibold text-indigo-300">Agent</span>
            <span className="text-xs text-neutral-400">{time}</span>
          </div>
          <div className="text-sm text-neutral-300 whitespace-pre-wrap break-words leading-relaxed">
            {msg.text}
          </div>
        </div>
      </div>
    );
  }

  // User message
  return (
    <div className="flex flex-col gap-1 items-end">
      <div className="text-xs text-neutral-400">{time}</div>
      <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-blue-500 text-white">
        <div className="whitespace-pre-wrap break-words">{msg.text}</div>
      </div>
    </div>
  );
}

type ChatPanelProps = {
  projectId: string;
};

export default function ChatPanel({ projectId }: ChatPanelProps) {
  const { send, loading, error } = useChatAgent(projectId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastAgentReply, setLastAgentReply] = useState<any>(null);
  const [preflightStatus, setPreflightStatus] = useState<string>('');
  const listRef = useRef<HTMLDivElement>(null);

  // Validate projectId
  if (!projectId) {
    return <div className="p-3 text-sm text-red-500">Missing projectId</div>;
  }

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: 1e9, behavior: 'smooth' });
    }
  }, [messages]);

  async function handleSend(text: string) {
    // Add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // Send to agent
      const result = await send(text);

      // Add agent response
      if (result?.message) {
        setMessages((prev) => [...prev, result.message]);
      }

      // Store last agent reply for button visibility
      if (result) {
        setLastAgentReply(result);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Add error message
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        text: 'Failed to get agent response. Please try again.',
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }

  async function handlePreflight() {
    setPreflightStatus('🔍 جاري فحص البيئة...');
    try {
      const res = await fetch('/api/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();

      if (data.ready) {
        setPreflightStatus('✅ البيئة جاهزة للتنفيذ');
        // Show success message
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: 'system',
          text: data.message || '✅ Preflight checks passed successfully',
          createdAt: Date.now(),
        }]);
      } else {
        setPreflightStatus('❌ فحص البيئة فشل');
        // Show detailed error message
        const errorMsg = data.message || 'Preflight checks failed';
        const issues = data.issues?.length ? '\n\n' + data.issues.map((i: string) => `• ${i}`).join('\n') : '';
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: 'system',
          text: errorMsg + issues,
          createdAt: Date.now(),
        }]);
      }
    } catch (err: any) {
      setPreflightStatus('❌ خطأ في الفحص');
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'system',
        text: `❌ Preflight check error: ${err?.message || 'Unknown error'}`,
        createdAt: Date.now(),
      }]);
    }
    setTimeout(() => setPreflightStatus(''), 5000);
  }

  async function handleGeneratePlan() {
    // This will trigger plan sync in useChatAgent
    await handleSend('نفّذ الخطة');
  }

  return (
    <div className="flex flex-col h-full bg-[var(--panel-bg)] text-[var(--panel-fg)] border-l border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-semibold">
          Agent Chat
        </h3>
        <span className="text-xs opacity-60">Project {projectId.slice(0, 8)}</span>
      </div>

      {/* Messages List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm opacity-60">
            Start chatting with the agent to create phases and tasks!
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem key={msg.id} msg={msg} isOwn={msg.role === 'user'} />
        ))}
        {error && (
          <div className="text-xs rounded-lg p-2 bg-[var(--bubble-error-bg)] text-[var(--bubble-error-fg)]">
            {error}
          </div>
        )}
      </div>

      {/* Control Buttons - Show when plan is ready */}
      {lastAgentReply?.meta?.ready && (
        <div className="px-4 py-2 border-t border-white/10 space-y-2">
          {/* Clarity Score Display */}
          {lastAgentReply?.meta?.clarity_score !== undefined && (
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="opacity-70">درجة الوضوح:</span>
              <span className="font-medium text-indigo-400">
                {Math.round(lastAgentReply.meta.clarity_score * 100)}%
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handlePreflight}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all hover:bg-white/5"
              style={{ borderColor: 'var(--card-bdr)' }}
            >
              <span>🧪</span>
              <span>Preflight</span>
            </button>
            <button
              onClick={handleGeneratePlan}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: 'var(--neon)',
                color: 'white',
                boxShadow: '0 0 20px rgba(99,102,241,0.4)'
              }}
            >
              <span>✨</span>
              <span>توليد الخطة</span>
            </button>
          </div>

          {/* Status Message */}
          {preflightStatus && (
            <div className="mt-2 text-xs text-center opacity-80 py-1 px-2 rounded bg-white/5">
              {preflightStatus}
            </div>
          )}

          {/* Missing Info */}
          {lastAgentReply?.meta?.missing?.length > 0 && (
            <div className="mt-2 text-xs opacity-70 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
              <div className="font-medium mb-1">⚠️ معلومات مطلوبة:</div>
              <ul className="list-disc list-inside space-y-0.5">
                {lastAgentReply.meta.missing.map((info: string, i: number) => (
                  <li key={i}>{info}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="mt-auto">
        <ChatInput onSend={handleSend} />
        {loading && (
          <div className="p-2 text-xs opacity-60 animate-pulse">
            Agent is thinking…
          </div>
        )}
      </div>
    </div>
  );
}
