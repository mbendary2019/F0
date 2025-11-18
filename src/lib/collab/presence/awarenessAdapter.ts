/**
 * Phase 53 Day 3 - Live Cursors & Selections
 * Y.js Awareness adapter for presence system
 */

import type { PresenceAdapter } from './useCursors';
import type { RemoteCursor, CursorUpdate, UserIdentity } from './types';
import { userColor } from './colors';

/**
 * Create a presence adapter from Y.js Awareness
 * @param awareness - Y.js Awareness instance
 * @param me - Current user identity
 */
export function createAwarenessAdapter(
  awareness: any,
  me: UserIdentity
): PresenceAdapter {
  const listeners = new Set<(list: RemoteCursor[]) => void>();

  const emit = () => {
    const states = awareness.getStates();
    const now = Date.now();
    const list: RemoteCursor[] = [];

    states.forEach((st: any, clientId: string | number) => {
      if (!st || !st.user) return;
      const id = String(st.user.id);
      if (id === me.id) return; // skip self

      list.push({
        id,
        name: st.user.name,
        color: st.user.color || userColor(id),
        avatarUrl: st.user.avatarUrl,
        point: st.cursor?.point ?? null,
        selection: st.cursor?.selection,
        lastActive: st.lastActive || now,
      });
    });

    listeners.forEach((cb) => cb(list));
  };

  const onRemoteChange = (cb: (list: RemoteCursor[]) => void) => {
    listeners.add(cb);
    cb([]);

    const handler = () => emit();
    awareness.on('change', handler);

    return () => {
      listeners.delete(cb);
      awareness.off('change', handler);
    };
  };

  const broadcast = (update: CursorUpdate) => {
    const prev = awareness.getLocalState() || {};
    awareness.setLocalState({
      ...prev,
      user: {
        id: me.id,
        name: me.name,
        color: me.color || userColor(me.id),
      },
      cursor: { ...prev.cursor, ...update },
      lastActive: Date.now(),
    });
  };

  return { me, onRemoteChange, broadcast };
}
