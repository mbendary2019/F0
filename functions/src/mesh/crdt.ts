/**
 * Phase 43 - CRDT Merge Logic
 * Last-Write-Wins (LWW) merge for gossip state
 */

export interface Obj {
  id: string;
  ts: number;
  kind: string;
  body: any;
}

/**
 * LWW merge: pick newer object by timestamp
 */
export function merge(a: Obj, b: Obj): Obj {
  return a.ts >= b.ts ? a : b;
}

/**
 * Merge multiple objects, returning latest by (kind, id)
 */
export function mergeMany(objects: Obj[]): Map<string, Obj> {
  const state = new Map<string, Obj>();

  for (const obj of objects) {
    const key = `${obj.kind}:${obj.id}`;
    const existing = state.get(key);

    if (!existing || obj.ts > existing.ts) {
      state.set(key, obj);
    }
  }

  return state;
}

/**
 * Convert map to snapshot format
 */
export function toSnapshot(state: Map<string, Obj>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of state) {
    result[key] = value;
  }
  return result;
}
