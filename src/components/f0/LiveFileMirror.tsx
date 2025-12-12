// src/components/f0/LiveFileMirror.tsx
'use client';

import React from 'react';
import { useLiveFileContent } from '@/hooks/useLiveFileContent';

interface LiveFileMirrorProps {
  projectId: string;
  sessionId: string;
  filePath: string | null;
}

export function LiveFileMirror({
  projectId,
  sessionId,
  filePath,
}: LiveFileMirrorProps) {
  const { state, loading } = useLiveFileContent(projectId, sessionId, filePath);

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-400">
        Select a file from the session to preview live changes.
      </div>
    );
  }

  if (loading || !state) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <span>Loading live content...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#050816] border border-violet-500/40 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-violet-500/30 text-xs text-slate-300 flex items-center justify-between">
        <span className="truncate font-mono">{state.path}</span>
        <div className="flex items-center gap-2">
          {state.languageId && (
            <span className="text-[10px] uppercase text-slate-500">
              {state.languageId}
            </span>
          )}
          <span className="text-[10px] uppercase text-violet-300 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live from VS Code
          </span>
        </div>
      </div>

      {/* Content */}
      <pre className="flex-1 overflow-auto text-xs p-3 font-mono text-slate-100 whitespace-pre">
        {state.content}
      </pre>

      {/* Footer with stats */}
      <div className="px-3 py-1.5 border-t border-violet-500/20 text-[10px] text-slate-500 flex items-center justify-between">
        <span>{state.content.split('\n').length} lines</span>
        <span>{state.content.length} characters</span>
      </div>
    </div>
  );
}
