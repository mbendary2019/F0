'use client';

import type { Project } from './types';

export function ProjectCard({ p }: { p: Project }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-black/40 p-4 hover:border-fuchsia-500/70 transition">
      <div className="font-medium mb-1 truncate">{p.name}</div>
      <div className="text-xs text-neutral-400 mb-2">
        Status: {p.status} • Tasks: {p.tasksCount}
      </div>
      <div className="text-[11px] text-neutral-500">
        Last activity: {new Date(p.lastActivityAt).toLocaleString()}
      </div>
    </div>
  );
}
