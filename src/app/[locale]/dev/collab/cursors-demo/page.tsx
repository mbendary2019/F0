/**
 * Phase 53 Day 3 - Live Cursors & Selections Demo
 * Simple standalone demo showing cursor tracking and selection highlighting
 */

'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';

// Dynamic import with SSR disabled to prevent hydration errors
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// Import our Phase 53 Day 3 components
import CursorOverlay from '@/components/collab/CursorOverlay';
import SelectionLayer from '@/components/collab/SelectionLayer';
import type { RemoteCursor } from '@/lib/collab/presence/types';
import type { UserSelectionRects } from '@/components/collab/SelectionLayer';
import { userColor } from '@/lib/collab/presence/colors';

// Mock users for demo
const MOCK_USERS = [
  { id: 'user1', name: 'Alice', color: userColor('user1') },
  { id: 'user2', name: 'Bob', color: userColor('user2') },
  { id: 'user3', name: 'Charlie', color: userColor('user3') },
];

const INITIAL_CODE = `// F0 Collaborative Editor - Cursors Demo
// This demo shows live cursor tracking and selection highlighting

function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Try selecting text or moving your cursor
// You'll see mock remote users' cursors and selections

const result = fibonacci(10);
console.log('Fibonacci(10) =', result);

// Phase 53 Day 3 Features:
// ✓ Live cursor tracking with animations
// ✓ Selection highlighting with translucent overlays
// ✓ Deterministic color generation
// ✓ Rate-limited cursor updates (60fps)
// ✓ Monaco editor integration
`;

export default function CursorsDemoPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  // Mock remote cursors state
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [remoteSelections, setRemoteSelections] = useState<UserSelectionRects[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Track local cursor position
    editor.onDidChangeCursorPosition((e) => {
      const pos = e.position;
      console.log('[demo] Cursor moved to:', { line: pos.lineNumber, column: pos.column });
    });

    // Track local selection
    editor.onDidChangeCursorSelection((e) => {
      const sel = e.selection;
      console.log('[demo] Selection changed:', {
        startLine: sel.startLineNumber,
        startColumn: sel.startColumn,
        endLine: sel.endLineNumber,
        endColumn: sel.endColumn,
      });
    });
  }, []);

  // Simulate remote cursor movements
  const startAnimation = useCallback(() => {
    if (!containerRef.current) return;

    setIsAnimating(true);

    // Animate cursors
    const interval = setInterval(() => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Generate random positions for mock users
      const mockCursors: RemoteCursor[] = MOCK_USERS.map((user, i) => {
        const time = Date.now() / 1000;
        const x = (Math.sin(time + i * 2) * 0.3 + 0.5) * width;
        const y = (Math.cos(time + i * 1.5) * 0.3 + 0.5) * height;

        return {
          ...user,
          point: { x, y },
          lastActive: Date.now(),
          selection: undefined,
        };
      });

      setRemoteCursors(mockCursors);

      // Generate random selections
      const mockSelections: UserSelectionRects[] = MOCK_USERS.map((user, i) => {
        const startY = 100 + i * 80;
        const height = 20 + Math.random() * 40;

        return {
          userId: user.id,
          color: user.color,
          rects: [
            {
              x: 50 + Math.random() * 200,
              y: startY,
              width: 100 + Math.random() * 300,
              height,
            },
          ],
        };
      });

      setRemoteSelections(mockSelections);
    }, 50); // 20 FPS animation

    return () => clearInterval(interval);
  }, []);

  const stopAnimation = useCallback(() => {
    setIsAnimating(false);
    setRemoteCursors([]);
    setRemoteSelections([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isAnimating) {
        stopAnimation();
      }
    };
  }, [isAnimating, stopAnimation]);

  return (
    <div className="flex flex-col h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Live Cursors Demo
          </h1>
          <span className="px-2 py-1 text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded">
            Phase 53 Day 3
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!isAnimating ? (
            <button
              onClick={startAnimation}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Animation
            </button>
          ) : (
            <button
              onClick={stopAnimation}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Stop Animation
            </button>
          )}
          <a
            href="/en/dev/collab"
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-md transition-colors"
          >
            ← Back to Collab
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-hidden">
        <div className="h-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg overflow-hidden relative">
          {/* Editor Container */}
          <div
            ref={containerRef}
            className="h-full relative"
          >
            <Editor
              height="100%"
              defaultLanguage="typescript"
              defaultValue={INITIAL_CODE}
              theme="vs-dark"
              onMount={handleEditorMount}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />

            {/* Selection Layer (behind cursors) */}
            <SelectionLayer selections={remoteSelections} />

            {/* Cursor Overlay (in front) */}
            <CursorOverlay containerRef={containerRef} cursors={remoteCursors} />
          </div>

          {/* Status Indicator */}
          {isAnimating && (
            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-black/70 backdrop-blur rounded-lg text-white text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span>{remoteCursors.length} mock users active</span>
            </div>
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="px-6 py-3 bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Live cursor tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Selection highlighting</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Framer Motion animations</span>
            </div>
          </div>
          <div className="text-xs">
            Phase 53 Day 3 • F0 Collaborative Editor
          </div>
        </div>
      </footer>
    </div>
  );
}
