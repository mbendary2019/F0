// desktop/src/components/PreviewLogsPane.tsx
// Phase 117: Preview Logs Panel - displays console.log/warn/error from webview
'use client';

import React, { useRef, useEffect } from 'react';
import clsx from 'clsx';
import {
  usePreviewLogsState,
  getFilteredLogs,
  type PreviewLogLevel,
} from '../state/previewLogsState';

const levelColors: Record<PreviewLogLevel, string> = {
  log: 'text-slate-300',
  info: 'text-blue-300',
  warn: 'text-amber-300',
  error: 'text-red-400',
};

const levelBadge: Record<PreviewLogLevel, string> = {
  log: 'bg-slate-500/20 text-slate-300',
  info: 'bg-blue-500/20 text-blue-300',
  warn: 'bg-amber-500/20 text-amber-300',
  error: 'bg-red-500/20 text-red-400',
};

export const PreviewLogsPane: React.FC = () => {
  const { logs, filterLevel, setFilterLevel, clearLogs } = usePreviewLogsState();
  const filteredLogs = getFilteredLogs(logs, filterLevel);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length]);

  const filterButton = (level: 'all' | PreviewLogLevel, label: string) => (
    <button
      key={level}
      onClick={() => setFilterLevel(level)}
      className={clsx(
        'px-2 py-0.5 rounded text-[9px] uppercase tracking-wider border transition',
        filterLevel === level
          ? 'border-[#7b5cff]/60 bg-[#7b5cff]/25 text-[#f5f3ff] shadow-[0_0_8px_rgba(123,92,255,0.5)]'
          : 'border-white/10 bg-white/5 text-[#d1ccff]/70 hover:bg-white/10'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-48 border-t border-[#26124a] bg-[#050015]">
      {/* Header - Phase 119.4: Polished */}
      <div className="flex h-7 items-center justify-between gap-2 border-b border-[#1b0d3a] bg-gradient-to-r from-[#050018] via-[#080022] to-[#050018] px-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-[#c3b5ff]">
            Console
          </span>
          <span className="text-[9px] text-[#8b7faa]">
            ({filteredLogs.length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          {filterButton('all', 'All')}
          {filterButton('info', 'Info')}
          {filterButton('warn', 'Warn')}
          {filterButton('error', 'Error')}

          <button
            onClick={clearLogs}
            className="ml-2 px-2 py-0.5 rounded text-[9px] uppercase tracking-wider border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Logs List - Phase 119.4: Polished body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-black/35 px-2 py-1.5 font-mono text-[11px] scrollbar-thin scrollbar-thumb-[#342065] scrollbar-track-transparent"
      >
        {filteredLogs.length === 0 ? (
          <div className="mt-3 text-center text-[10px] text-[#9e8fe0]/80">
            No logs yet. Console messages from the preview will appear here.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={clsx(
                'flex items-start gap-2 px-3 py-1 border-b border-[#1b0d3a]/50 hover:bg-white/[0.02]',
                levelColors[log.level]
              )}
            >
              {/* Timestamp */}
              <span className="flex-shrink-0 text-[9px] text-[#6b5f8a] tabular-nums">
                {new Date(log.ts).toLocaleTimeString('en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>

              {/* Level badge */}
              <span
                className={clsx(
                  'flex-shrink-0 px-1.5 py-0.5 rounded text-[8px] uppercase',
                  levelBadge[log.level]
                )}
              >
                {log.level}
              </span>

              {/* Message */}
              <span className="flex-1 break-all whitespace-pre-wrap">
                {log.message}
              </span>

              {/* Source (if available) */}
              {log.source && (
                <span className="flex-shrink-0 text-[9px] text-[#5a4d7a] truncate max-w-[120px]">
                  {log.source}
                  {log.lineNumber ? `:${log.lineNumber}` : ''}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PreviewLogsPane;
