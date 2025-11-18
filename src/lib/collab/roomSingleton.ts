// src/lib/collab/roomSingleton.ts
import { Y } from '@/lib/y';
import type { Awareness } from 'y-protocols/awareness'; // نتجنّب استيراد مباشر هنا — هنمرره من برّا

type Handle = {
  ydoc: Y.Doc;
  provider: any;
  awareness: Awareness;
  refs: number;
  dispose: () => void;
};

const g = globalThis as any;
if (!g.__YJS_ROOMS__) g.__YJS_ROOMS__ = new Map<string, Handle>();
const store: Map<string, Handle> = g.__YJS_ROOMS__;

/**
 * ينشئ/يعيد نفس الاتصال لنفس الـ ROOM_ID بدون تكرار.
 * WebrtcProvider و Awareness يتم تمريرهم من المستدعي (بعد dynamic import).
 */
export function connectRoom(
  roomId: string,
  ctor: (ydoc: Y.Doc) => { provider: any; awareness: Awareness }
): Handle {
  const existing = store.get(roomId);
  if (existing) {
    existing.refs++;
    console.info(`[roomSingleton] reusing room "${roomId}", refs now: ${existing.refs}`);
    return existing;
  }
  const ydoc = new Y.Doc();
  const { provider, awareness } = ctor(ydoc);

  // Create dispose function that decrements refs and cleans up
  const dispose = () => {
    const h = store.get(roomId);
    if (!h) return;
    h.refs--;
    console.info(`[roomSingleton] dispose() called for "${roomId}", refs now: ${h.refs}`);
    if (h.refs <= 0) {
      console.info(`[roomSingleton] destroying room "${roomId}"`);
      try { h.provider?.destroy?.(); } catch (e) { console.error('[roomSingleton] provider.destroy() error:', e); }
      try { h.ydoc?.destroy?.(); } catch (e) { console.error('[roomSingleton] ydoc.destroy() error:', e); }
      store.delete(roomId);
    }
  };

  const handle: Handle = { ydoc, provider, awareness, refs: 1, dispose };
  store.set(roomId, handle);
  console.info(`[roomSingleton] created new room "${roomId}", refs: 1`);
  return handle;
}

export function disconnectRoom(roomId: string) {
  const h = store.get(roomId);
  if (!h) return;
  h.refs--;
  if (h.refs <= 0) {
    try { h.provider?.destroy?.(); } catch {}
    try { h.ydoc?.destroy?.(); } catch {}
    store.delete(roomId);
  }
}
