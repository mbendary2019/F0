/**
 * Phase 53 Day 3 - Live Cursors & Selections
 * Renders animated remote cursors on top of editor container
 */

'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import type { RemoteCursor } from '@/lib/collab/presence/types';

export interface CursorOverlayProps {
  containerRef: React.RefObject<HTMLElement>;
  cursors?: RemoteCursor[];
}

export default function CursorOverlay({ containerRef, cursors = [] }: CursorOverlayProps) {
  const rafRef = useRef<number | null>(null);

  // Protect against undefined/null cursors
  const list = Array.isArray(cursors) ? cursors : [];

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {list.map((c) => {
        if (!c.point) return null;
        const { x, y } = c.point;

        return (
          <motion.div
            key={c.id}
            className="absolute"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            style={{
              transform: `translate(${Math.round(x)}px, ${Math.round(y)}px)`,
            }}
          >
            {/* Label above cursor */}
            <div className="flex items-center gap-2 -translate-y-6">
              <div
                className="w-2.5 h-2.5 rounded-full shadow"
                style={{ background: c.color }}
              />
              <span
                className="px-2 py-0.5 rounded-lg text-xs font-medium shadow backdrop-blur"
                style={{
                  background: 'rgba(15,15,20,0.55)',
                  color: 'white',
                  border: `1px solid ${c.color}`,
                }}
              >
                {c.name}
              </span>
              {c.avatarUrl && (
                <Image
                  src={c.avatarUrl}
                  alt={c.name}
                  width={18}
                  height={18}
                  className="rounded-full border border-white/20"
                />
              )}
            </div>

            {/* Cursor glyph */}
            <svg
              width="16"
              height="24"
              viewBox="0 0 16 24"
              className="drop-shadow"
            >
              <path d="M0 0 L16 10 L9 12 L12 24 Z" fill={c.color} />
            </svg>
          </motion.div>
        );
      })}
    </div>
  );
}
