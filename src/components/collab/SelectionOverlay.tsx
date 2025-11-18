'use client';
import React, { useEffect, useRef } from 'react';
import type { PeerPresence } from '@/lib/collab/types';

export default function SelectionOverlay({ peers }: { peers: PeerPresence[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    // clear previous
    root.innerHTML = '';

    for (const p of peers) {
      const sel = p.selection;
      if (!sel) continue;

      // Check if we have layout coordinates (added by parent)
      const selAny = sel as any;
      if (typeof selAny._x !== 'number') continue;

      const el = document.createElement('div');
      el.className = 'fixed z-[50] rounded-sm opacity-25 pointer-events-none';
      el.style.background = p.color;
      el.style.left = selAny._x + 'px';
      el.style.top = selAny._y + 'px';
      el.style.width = selAny._w + 'px';
      el.style.height = selAny._h + 'px';
      root.appendChild(el);
    }
  }, [peers]);

  return <div ref={ref} className="pointer-events-none fixed inset-0 z-[50]" aria-hidden />;
}
