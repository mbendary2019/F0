/**
 * Phase 53 Day 4 - Chat & Comments Thread Demo
 * Integrates Monaco editor + ChatPanel + inline comment pin
 */

'use client';

import dynamic from 'next/dynamic';
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
import type { OnMount } from '@monaco-editor/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { createChatDoc } from '@/lib/collab/chat/awarenessChat';
import { useChat } from '@/lib/collab/chat/useChat';
import ChatPanelDay4 from '@/components/collab/ChatPanelDay4';
import CommentPin from '@/components/collab/CommentPin';

const INITIAL_CODE = `// Phase 53 Day 4 — Chat & Comments Demo
// Real-time side panel for chat + inline comments anchored to selections

function fibonacci(n: number) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Try this:
// 1. Type a message in the chat panel
// 2. Select some code and click "Add comment"
// 3. Reply to existing messages
// 4. See thread structure with replies

const result = fibonacci(10);
console.log('Fibonacci(10) =', result);

// Features:
// ✓ Real-time chat with Y.js
// ✓ Threaded conversations
// ✓ Inline comments anchored to code selections
// ✓ Reply functionality
// ✓ Smooth animations with Framer Motion
`;

export default function ChatDemoPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<any>(null);

  // In real app, reuse your existing Y.doc from Day2 provider
  const ydoc = useMemo(() => new Y.Doc(), []);
  const chatDoc = useMemo(() => createChatDoc(ydoc), [ydoc]);
  const me = { id: 'user-LOCAL', name: 'You', color: 'hsl(210 90% 60%)' };

  const { rootThreads, send } = useChat(chatDoc, me);
  const [currentSel, setCurrentSel] = useState<{
    start: { line: number; column: number };
    end: { line: number; column: number };
  } | null>(null);

  const onMount: OnMount = (ed) => {
    setEditor(ed);
    ed.onDidChangeCursorSelection(() => {
      const sel = ed.getSelection();
      if (!sel) return setCurrentSel(null);
      
      // Only show comment button if there's a non-empty selection
      const hasSelection = 
        sel.startLineNumber !== sel.endLineNumber ||
        sel.startColumn !== sel.endColumn;
      
      if (hasSelection) {
        setCurrentSel({
          start: { line: sel.startLineNumber, column: sel.startColumn },
          end: { line: sel.endLineNumber, column: sel.endColumn },
        });
      } else {
        setCurrentSel(null);
      }
    });
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-neutral-950 border-b border-white/10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">
            Chat & Comments Demo
          </h1>
          <span className="px-2 py-1 text-xs font-medium bg-green-900/50 text-green-300 rounded">
            Phase 53 Day 4
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/en/dev/collab"
            className="px-4 py-2 text-sm font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
          >
            ← Back to Collab
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full w-full flex">
          <div ref={containerRef} className="relative flex-1 bg-neutral-950">
            <Editor
              onMount={onMount}
              height="100%"
              defaultLanguage="typescript"
              defaultValue={INITIAL_CODE}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                fontLigatures: true,
                smoothScrolling: true,
                padding: { top: 16, bottom: 16 },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
            <CommentPin
              canComment={!!currentSel}
              onSubmit={(text) =>
                send(text, currentSel ? { anchor: currentSel, threadId: null } : undefined)
              }
            />
          </div>
          <ChatPanelDay4
            threads={rootThreads}
            onSend={(t) => send(t)}
            onReply={(threadId, text) => send(text, { threadId })}
            me={me}
          />
        </div>
      </main>

      {/* Footer Info */}
      <footer className="px-6 py-3 bg-neutral-950 border-t border-white/10">
        <div className="flex items-center justify-between text-sm text-white/60">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Real-time chat</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Threaded conversations</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Inline comments</span>
            </div>
          </div>
          <div className="text-xs">
            Phase 53 Day 4 • F0 Collaborative Editor
          </div>
        </div>
      </footer>
    </div>
  );
}
