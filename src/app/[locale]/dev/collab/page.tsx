'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import type * as monacoNs from 'monaco-editor';
import { Y } from '@/lib/y';
import { connectRoom } from '@/lib/collab/roomSingleton';
import { colorFor } from '@/lib/collab/colors';
import { useLiveCursors } from '@/hooks/useLiveCursors';
import { toScreen, screenOfSelection } from '@/lib/collab/monacoCursorAdapter';
import CursorOverlay from '@/components/collab/CursorOverlay';
import SelectionOverlay from '@/components/collab/SelectionOverlay';
import PresenceList from '@/components/collab/PresenceList';
import ChatPanel from '@/components/collab/ChatPanel';
import { useChatChannel } from '@/lib/collab/chat/useChatChannel';
import { useAutoSummary } from '@/lib/collab/summary';

const ROOM_ID = 'ide-file-demo-page-tsx';
const STUN_TURN: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302'] },
];

const randName = () => {
  const adj = ['Quick', 'Happy', 'Smart', 'Calm', 'Brave', 'Bright', 'Sharp', 'Neon', 'Bold', 'Kind'];
  const noun = ['Coder', 'Dev', 'Hacker', 'Builder', 'Pilot', 'Runner', 'Wizard', 'Ninja', 'Sage', 'Agent'];
  return `${adj[Math.floor(Math.random() * adj.length)]} ${noun[Math.floor(Math.random() * noun.length)]}`;
};

// Generate today's session ID: roomId__YYYYMMDD
const getTodaySessionId = (roomId: string) => {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${roomId}__${today}`;
};

function CollabPage() {
  // منع HTTPS على localhost تلقائيًا (dev only)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
      window.location.replace('http://' + window.location.host + window.location.pathname + window.location.search);
    }
  }, []);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monacoNs.editor.IStandaloneCodeEditor | null>(null);
  const [awarenessInstance, setAwarenessInstance] = useState<any>(null);
  const cursorSeq = useRef(0);
  const selectionSeq = useRef(0);
  const lastCursorUpdate = useRef(0);

  const [status, setStatus] = useState<'boot' | 'loading' | 'ready' | 'error'>('boot');
  const [me] = useState(() => {
    const id = Math.random().toString(36).slice(2, 8);
    return { id, name: randName(), color: colorFor(id) };
  });
  const [sessionId] = useState(() => getTodaySessionId(ROOM_ID));
  const [showPinModal, setShowPinModal] = useState(false);

  // Use the live cursors hook
  const { peers } = useLiveCursors(awarenessInstance, me.id);

  // Use the chat channel hook
  const { messages, peers: chatPeers, markTyping, send } = useChatChannel({
    roomId: ROOM_ID,
    me: { id: me.id, name: me.name, color: me.color },
    awareness: awarenessInstance,
  });

  // Enable auto-summarization (every 60 seconds)
  useAutoSummary({
    roomId: ROOM_ID,
    enabled: status === 'ready', // Only run when editor is ready
    windowMs: 60_000, // Summarize last 60 seconds
    intervalMs: 60_000, // Run every 60 seconds
  });

  // Throttled cursor update (24 FPS max)
  const updateCursor = (pos: { x: number; y: number; line?: number; column?: number }) => {
    if (!awarenessInstance) return;
    const now = performance.now();
    if (now - lastCursorUpdate.current < 1000 / 24) return; // 24 FPS throttle
    lastCursorUpdate.current = now;
    cursorSeq.current++;

    const state = awarenessInstance.getLocalState() || {};
    awarenessInstance.setLocalState({
      ...state,
      cursor: { ...pos, v: cursorSeq.current },
    });
  };

  // Selection update
  const updateSelection = (sel: {
    from: { line: number; column: number };
    to: { line: number; column: number };
  }) => {
    if (!awarenessInstance) return;
    selectionSeq.current++;

    const state = awarenessInstance.getLocalState() || {};
    awarenessInstance.setLocalState({
      ...state,
      selection: { ...sel, v: selectionSeq.current },
    });
  };

  useEffect(() => {
    let disposed = false;
    let ytext: Y.Text | null = null;
    let unsubs: Array<() => void> = [];
    let roomHandle: ReturnType<typeof connectRoom> | null = null;

    (async () => {
      try {
        // 0) امنع https محليًا
        if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
          const url = 'http://' + window.location.host + window.location.pathname + window.location.search;
          console.warn('[collab] forcing HTTP ->', url);
          window.location.replace(url);
          return;
        }

        console.info('[collab] effect start');
        setStatus('loading');

        // 1) تحقق من الحاوية
        if (!containerRef.current) {
          console.error('[collab] containerRef is null');
          setStatus('error');
          return;
        }

        // 2) استيراد ديناميكي آمن لـ Monaco
        let monaco: typeof monacoNs;
        try {
          console.info('[collab] importing monaco...');
          monaco = await import('monaco-editor') as typeof monacoNs;
          console.info('[collab] monaco imported ✓');
        } catch (e) {
          console.error('[collab] monaco import failed', e);
          setStatus('error');
          return;
        }

        if (disposed || !containerRef.current) return;

        // 3) إنشاء المحرر
        console.info('[collab] creating editor...');
        const editor = monaco.editor.create(containerRef.current, {
          value: '// F0 Collaborative Editor - Day 3\n// Try typing and see live cursors!\n\nfunction hello() {\n  console.log("Hello from F0!");\n}\n',
          language: 'typescript',
          fontSize: 14,
          automaticLayout: true,
          minimap: { enabled: false },
          theme: 'vs-dark',
        });
        editorRef.current = editor;
        const model = editor.getModel()!;
        console.info('[collab] editor created ✓');

        // 4) استيراد yjs + webrtc ديناميكياً (من الـ wrapper المركزي)
        let WebrtcProvider: any, Awareness: any;
        try {
          console.info('[collab] importing y-webrtc & awareness...');
          const yModule = await import('@/lib/y');
          WebrtcProvider = yModule.WebrtcProvider;
          Awareness = yModule.Awareness;
          console.info('[collab] y-webrtc & awareness imported ✓');
        } catch (e) {
          console.error('[collab] y-webrtc/awareness import failed', e);
          setStatus('error');
          return;
        }

        // 5) اتصال الغرفة عبر الـ singleton
        console.info('[collab] connecting room...');
        roomHandle = connectRoom(ROOM_ID, (ydoc) => ({
          provider: new WebrtcProvider(ROOM_ID, ydoc, {
            rtcConfiguration: { iceServers: STUN_TURN },
            filterBcConns: true,
            maxConns: 20,
          }),
          awareness: new Awareness(ydoc),
        }));
        console.info('[collab] room connected ✓');

        // 6) إعداد الـ awareness للمستخدم الحالي
        roomHandle.awareness.setLocalState({
          id: me.id,
          name: me.name,
          color: me.color,
          idle: false,
          ts: Date.now(),
        });
        setAwarenessInstance(roomHandle.awareness);

        // Y <-> Monaco text sync
        ytext = roomHandle.ydoc.getText('monaco');
        const syncToMonaco = () => {
          const target = ytext!.toString();
          if (model.getValue() !== target) {
            model.pushEditOperations([], [{ range: model.getFullModelRange(), text: target }], () => null);
          }
        };
        ytext.observe(syncToMonaco);
        unsubs.push(() => ytext && ytext.unobserve(syncToMonaco));
        syncToMonaco();

        const subChange = model.onDidChangeContent(() => {
          const val = model.getValue();
          if (val === ytext!.toString()) return;
          Y.transact(roomHandle!.ydoc, () => {
            ytext!.delete(0, ytext!.length);
            ytext!.insert(0, val);
          });
        });
        unsubs.push(() => subChange.dispose());

        // Cursor position updates
        const subPos = editor.onDidChangeCursorPosition((e) => {
          const pos = e.position;
          const screenPos = toScreen(editor, { lineNumber: pos.lineNumber, column: pos.column });
          if (screenPos) {
            updateCursor({
              x: screenPos.x,
              y: screenPos.y,
              line: pos.lineNumber,
              column: pos.column,
            });
          }
        });
        unsubs.push(() => subPos.dispose());

        // Selection updates
        const subSel = editor.onDidChangeCursorSelection((e) => {
          const s = e.selection;
          updateSelection({
            from: { line: s.startLineNumber, column: s.startColumn },
            to: { line: s.endLineNumber, column: s.endColumn },
          });
        });
        unsubs.push(() => subSel.dispose());

        // Track mouse movement for cursor position
        const onMouseMove = (e: MouseEvent) => {
          updateCursor({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', onMouseMove, { passive: true });
        unsubs.push(() => window.removeEventListener('mousemove', onMouseMove));

        // Idle detection (30s)
        let idleTimeout: any;
        const resetIdle = () => {
          clearTimeout(idleTimeout);
          const state = roomHandle?.awareness.getLocalState();
          if (state?.idle) {
            roomHandle?.awareness.setLocalState({ ...state, idle: false, ts: Date.now() });
          }
          idleTimeout = setTimeout(() => {
            const s = roomHandle?.awareness.getLocalState();
            if (s) {
              roomHandle?.awareness.setLocalState({ ...s, idle: true, ts: Date.now() });
            }
          }, 30000);
        };
        window.addEventListener('mousemove', resetIdle);
        window.addEventListener('keydown', resetIdle);
        unsubs.push(() => {
          window.removeEventListener('mousemove', resetIdle);
          window.removeEventListener('keydown', resetIdle);
          clearTimeout(idleTimeout);
        });
        resetIdle();

        console.info('[collab] ready ✓');
        setStatus('ready');
      } catch(e) {
        console.error('[collab] fatal boot error', e);
        setStatus('error');
      }
    })();

    return () => {
      disposed = true;
      unsubs.forEach((fn) => fn());
      if (editorRef.current) editorRef.current.dispose?.();
      if (roomHandle) roomHandle.dispose();
    };
  }, [me.id, me.name, me.color]);

  // Add layout coordinates to peers for selection rendering
  const peersWithLayout = useMemo(() => {
    const editor = editorRef.current;
    if (!editor) return peers;

    return peers.map(p => {
      if (!p.selection) return p;
      const box = screenOfSelection(
        editor,
        { lineNumber: p.selection.from.line, column: p.selection.from.column },
        { lineNumber: p.selection.to.line, column: p.selection.to.column }
      );
      if (!box) return p;

      return {
        ...p,
        selection: {
          ...p.selection,
          _x: box.x,
          _y: box.y,
          _w: box.w,
          _h: box.h,
        } as any,
      };
    });
  }, [peers]);

  // Handler for pinning a note
  const handlePin = async (content: string) => {
    try {
      const { pinMemory } = await import('@/lib/collab/memory/pinMemory');
      await pinMemory({
        roomId: ROOM_ID,
        sessionId,
        content,
        me: { uid: me.id, name: me.name },
      });
      setShowPinModal(false);
    } catch (error) {
      console.error('[collab] Failed to pin memory:', error);
      alert('Failed to pin memory. Please try again.');
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header
        status={status}
        me={me}
        peerCount={peers.length}
        roomId={ROOM_ID}
        sessionId={sessionId}
        onShowPin={() => setShowPinModal(true)}
      />
      <PresenceList peers={chatPeers} />
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Section */}
        <div className="flex-1 p-4">
          <div
            ref={containerRef}
            style={{ height: '100%', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', position: 'relative' }}
          />
          <SelectionOverlay peers={peersWithLayout} />
          <CursorOverlay containerRef={containerRef} cursors={peersWithLayout} />
        </div>
        {/* Chat Section */}
        <div className="w-80">
          <ChatPanel
            roomTitle={`Room: ${ROOM_ID}`}
            messages={messages}
            myUserId={me.id}
            onSend={send}
            onTyping={markTyping}
          />
        </div>
      </div>
      {/* Pin Modal */}
      {showPinModal && <PinModal onClose={() => setShowPinModal(false)} onPin={handlePin} />}
    </div>
  );
}

function Header({
  status,
  me,
  peerCount,
  roomId,
  sessionId,
  onShowPin,
}: {
  status: string;
  me: { name: string; color: string };
  peerCount: number;
  roomId: string;
  sessionId: string;
  onShowPin: () => void;
}) {
  const dot = status === 'ready' ? '#16a34a' : status === 'loading' ? '#f59e0b' : status === 'error' ? '#dc2626' : '#6b7280';
  const timelineUrl = `/en/ops/memory?room=${encodeURIComponent(roomId)}&session=${encodeURIComponent(sessionId)}`;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-white dark:bg-neutral-900">
      <span style={{ color: dot, fontWeight: 700 }}>●</span>
      <span style={{ color: '#6c5ce7', fontWeight: 700 }}>F0 Collaborative Editor – Day 6 (Memory Timeline)</span>
      <span className="text-neutral-600 dark:text-neutral-400 text-sm">status: {status}</span>
      {peerCount > 0 && (
        <span className="text-neutral-600 dark:text-neutral-400 text-sm">
          {peerCount} {peerCount === 1 ? 'peer' : 'peers'} online
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        {/* Cursors Demo Button */}
        <a
          href="/en/dev/collab/cursors-demo"
          className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors flex items-center gap-1.5"
          title="Open Live Cursors Demo"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          Cursors Demo
        </a>
        {/* Chat Demo Button */}
        <a
          href="/en/dev/collab/chat-demo"
          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors flex items-center gap-1.5"
          title="Open Chat & Comments Demo"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Chat Demo
        </a>
        {/* View Timeline Button */}
        <a
          href={timelineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors flex items-center gap-1.5"
          title="Open Memory Timeline in new tab"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          View Timeline
        </a>
        {/* Pin Note Button */}
        <button
          onClick={onShowPin}
          className="px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors flex items-center gap-1.5"
          title="Pin a note to memory timeline"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Pin Note
        </button>
        <span className="text-sm" style={{ color: me.color }}>
          You: <b>{me.name}</b>
        </span>
      </div>
    </div>
  );
}

function PinModal({ onClose, onPin }: { onClose: () => void; onPin: (content: string) => void }) {
  const [content, setContent] = useState('');
  const [isPinning, setIsPinning] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsPinning(true);
    try {
      await onPin(content.trim());
    } finally {
      setIsPinning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Pin a Note
          </h3>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter an important note, decision, or reminder..."
            rows={4}
            className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
            autoFocus
          />
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() || isPinning}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              {isPinning ? 'Pinning...' : 'Pin to Timeline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// تعطيل SSR لمنع Hydration errors (Monaco + Y.js + WebRTC = client-only)
import nextDynamic from 'next/dynamic';
export default nextDynamic(() => Promise.resolve(CollabPage), { ssr: false });
