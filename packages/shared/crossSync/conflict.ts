// F0 Phase 35 - Conflict Resolution (CRDT-like)

/**
 * Last-Write-Wins (LWW) conflict resolution
 * Simple but effective for most use cases
 */
export function resolveLWW<T extends { updatedAt: number }>(local: T, remote: T): T {
  return local.updatedAt > remote.updatedAt ? local : remote;
}

/**
 * Field-level merge with LWW per field
 */
export function resolveFieldLWW<T extends Record<string, any>>(
  local: T,
  remote: T,
  timestampFields: Record<keyof T, number>
): T {
  const result = { ...local };

  for (const key in remote) {
    const localTimestamp = timestampFields[key as keyof T] || 0;
    const remoteTimestamp = timestampFields[key as keyof T] || 0;

    if (remoteTimestamp > localTimestamp) {
      result[key] = remote[key];
    }
  }

  return result;
}

/**
 * Array merge with deduplication
 */
export function mergeArrays<T>(
  local: T[],
  remote: T[],
  keyFn: (item: T) => string = (item) => JSON.stringify(item)
): T[] {
  const map = new Map<string, T>();

  // Add local items
  for (const item of local) {
    map.set(keyFn(item), item);
  }

  // Merge remote items
  for (const item of remote) {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

/**
 * Queue item merge with priority
 */
export function mergeQueues(
  local: { id: string; createdAt: number; priority?: number }[],
  remote: { id: string; createdAt: number; priority?: number }[]
): typeof local {
  const merged = mergeArrays([...local, ...remote], (item) => item.id);

  // Sort by priority (higher first) then createdAt (older first)
  return merged.sort((a, b) => {
    const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdAt - b.createdAt;
  });
}

/**
 * Detect conflicts between local and remote versions
 */
export function detectConflict<T extends { updatedAt: number; version?: number }>(
  local: T,
  remote: T
): { hasConflict: boolean; reason?: string } {
  // No conflict if timestamps match
  if (local.updatedAt === remote.updatedAt) {
    return { hasConflict: false };
  }

  // Version-based conflict detection
  if (local.version !== undefined && remote.version !== undefined) {
    if (local.version !== remote.version && local.updatedAt !== remote.updatedAt) {
      return {
        hasConflict: true,
        reason: `Version mismatch: local=${local.version}, remote=${remote.version}`,
      };
    }
  }

  // Significant time difference might indicate concurrent edits
  const timeDiff = Math.abs(local.updatedAt - remote.updatedAt);
  if (timeDiff < 5000) {
    // Less than 5 seconds - possible concurrent edit
    return {
      hasConflict: true,
      reason: 'Concurrent edit detected (timestamps within 5s)',
    };
  }

  return { hasConflict: false };
}

/**
 * Three-way merge (local, remote, base)
 */
export function threeWayMerge<T extends Record<string, any>>(
  local: T,
  remote: T,
  base: T
): { merged: T; conflicts: string[] } {
  const merged = { ...base };
  const conflicts: string[] = [];

  for (const key in local) {
    const localValue = local[key];
    const remoteValue = remote[key];
    const baseValue = base[key];

    // No change in either
    if (localValue === baseValue && remoteValue === baseValue) {
      continue;
    }

    // Only local changed
    if (localValue !== baseValue && remoteValue === baseValue) {
      merged[key] = localValue;
      continue;
    }

    // Only remote changed
    if (localValue === baseValue && remoteValue !== baseValue) {
      merged[key] = remoteValue;
      continue;
    }

    // Both changed to same value
    if (localValue === remoteValue) {
      merged[key] = localValue;
      continue;
    }

    // Both changed to different values - conflict!
    conflicts.push(key);
    merged[key] = remoteValue; // Default to remote for now
  }

  return { merged, conflicts };
}


