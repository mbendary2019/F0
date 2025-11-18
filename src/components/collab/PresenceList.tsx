'use client';
import React from 'react';
import type { PeerUser } from '@/lib/collab/chat/types';

export default function PresenceList({ peers }: { peers: PeerUser[] }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b bg-white dark:bg-neutral-900">
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Peers ({peers.length}):
      </span>
      <div className="flex flex-wrap gap-2">
        {peers.length === 0 && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            No other peers online
          </span>
        )}
        {peers.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-xs bg-white dark:bg-neutral-800"
            style={{ borderColor: p.color }}
            title={`${p.name} - Last seen: ${new Date(p.lastSeen || Date.now()).toLocaleTimeString()}`}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                background: p.isTyping ? p.color : `${p.color}AA`,
                animation: p.isTyping ? 'pulse 1s infinite' : 'none',
              }}
            />
            <span className="max-w-32 truncate">{p.name}</span>
            {p.isTyping && (
              <em className="opacity-70 text-[10px]">typing…</em>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
