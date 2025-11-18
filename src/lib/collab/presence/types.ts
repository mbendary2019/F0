/**
 * Phase 53 Day 3 - Live Cursors & Selections
 * Type definitions for cursor presence and selection tracking
 */

export type CursorPoint = {
  x: number;
  y: number;
};

export type ViewportInfo = {
  scrollX: number;
  scrollY: number;
  scale: number; // for future zoom support
  width: number;
  height: number;
};

export type UserIdentity = {
  id: string;
  name: string;
  color: string; // hex or hsl
  avatarUrl?: string;
};

export type RemoteCursor = UserIdentity & {
  point: CursorPoint | null;
  lastActive: number;
  selection?: {
    start: { line: number; column: number } | null;
    end: { line: number; column: number } | null;
  };
};

export type CursorUpdate = {
  point?: CursorPoint | null;
  selection?: RemoteCursor['selection'];
  viewport?: Partial<ViewportInfo>;
};
