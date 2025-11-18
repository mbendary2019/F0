/**
 * Phase 53 Day 3 - Live Cursors & Selections
 * Renders remote selections (Monaco line/column range projected to DOM coords)
 */

'use client';

import { translucent } from '@/lib/collab/presence/colors';

export type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type UserSelectionRects = {
  userId: string;
  color: string;
  rects: SelectionRect[];
};

export interface SelectionLayerProps {
  selections?: UserSelectionRects[];
}

export default function SelectionLayer({ selections = [] }: SelectionLayerProps) {
  // Protect against undefined/null selections
  const list = Array.isArray(selections) ? selections : [];

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {list.map((s) => (
        <div key={s.userId} className="absolute inset-0">
          {(s.rects || []).map((r, i) => (
            <div
              key={`${s.userId}-${i}`}
              className="absolute rounded-sm"
              style={{
                left: r.x,
                top: r.y,
                width: r.width,
                height: r.height,
                background: translucent(s.color, 0.18),
                outline: `1px solid ${translucent(s.color, 0.55)}`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
