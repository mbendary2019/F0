/**
 * Phase 53 Day 3 - Live Cursors & Selections
 * React hook for managing cursor presence and selection state
 * Bridges presence system with cursor + selection updates
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CursorPoint, RemoteCursor, CursorUpdate, UserIdentity } from './types';
import { userColor } from './colors';

/**
 * Adapter interface for connecting to presence system
 * Can be implemented with Y.js awareness, Firestore, or any other backend
 */
export type PresenceAdapter = {
  me: UserIdentity;
  onRemoteChange: (cb: (list: RemoteCursor[]) => void) => () => void;
  // Broadcast a partial update to peers (cursor/selection/viewport)
  broadcast: (update: CursorUpdate) => void;
};

/**
 * Hook for managing live cursors and selections
 * @param presence - Presence adapter (Y.js awareness, Firestore, etc.)
 * @returns me, remotes, updateCursor, updateSelection
 */
export const useCursors = (presence: PresenceAdapter) => {
  const [remotes, setRemotes] = useState<RemoteCursor[]>([]);
  const lastMove = useRef<number>(0);

  // Subscribe to remote cursor changes
  useEffect(() => {
    return presence.onRemoteChange((list) => setRemotes(list));
  }, [presence]);

  /**
   * Update local cursor position
   * Rate-limited to ~60fps for performance
   */
  const updateCursor = useCallback(
    (point: CursorPoint | null) => {
      // Rate-limit to ~60fps max
      const now = performance.now();
      if (now - lastMove.current < 16) return;
      lastMove.current = now;
      presence.broadcast({ point });
    },
    [presence]
  );

  /**
   * Update local selection (Monaco editor range)
   */
  const updateSelection = useCallback(
    (selection: RemoteCursor['selection']) => {
      presence.broadcast({ selection });
    },
    [presence]
  );

  /**
   * Current user identity with deterministic color
   */
  const me = useMemo<UserIdentity>(() => {
    const id = presence.me.id;
    return {
      ...presence.me,
      color: presence.me.color || userColor(id),
    };
  }, [presence.me]);

  return { me, remotes, updateCursor, updateSelection };
};
