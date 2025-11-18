// src/lib/ai/util/ttl.ts
// Phase 57.3: TTL (Time-To-Live) utilities for Firestore documents
// Controls storage growth with automatic expiration

import { Timestamp } from "firebase-admin/firestore";

// === Default TTL Values ===

export const DEFAULT_TTL_DAYS = {
  snippet: 180, // 6 months for cached snippets
  snippetFeedback: 365, // 1 year for snippet feedback
  clusterFeedback: 365, // 1 year for cluster feedback
  metrics: 90, // 3 months for daily metrics
} as const;

// === TTL Calculation ===

/**
 * Calculate expiration timestamp from days
 *
 * @param days - Number of days until expiration
 * @param fromDate - Base date (default: now)
 * @returns Expiration timestamp
 *
 * @example
 * ```typescript
 * const expireAt = ttlFromDays(180); // Expires in 6 months
 * await ref.set({ data, expire_at: expireAt });
 * ```
 */
export function ttlFromDays(days: number, fromDate: Date = new Date()): Date {
  const expireAt = new Date(fromDate);
  expireAt.setDate(expireAt.getDate() + days);
  return expireAt;
}

/**
 * Calculate expiration Firestore Timestamp from days
 *
 * @param days - Number of days until expiration
 * @param fromDate - Base date (default: now)
 * @returns Firestore Timestamp
 */
export function ttlTimestampFromDays(
  days: number,
  fromDate: Date = new Date()
): Timestamp {
  return Timestamp.fromDate(ttlFromDays(days, fromDate));
}

/**
 * Check if document has expired
 *
 * @param expireAt - Expiration timestamp
 * @param now - Current time (default: Date.now())
 * @returns True if expired
 *
 * @example
 * ```typescript
 * const doc = await ref.get();
 * if (isExpired(doc.data().expire_at)) {
 *   console.log('Document has expired');
 * }
 * ```
 */
export function isExpired(
  expireAt: Date | Timestamp | undefined,
  now: number = Date.now()
): boolean {
  if (!expireAt) return false;

  const expireMs =
    expireAt instanceof Date
      ? expireAt.getTime()
      : expireAt instanceof Timestamp
      ? expireAt.toMillis()
      : 0;

  return expireMs > 0 && expireMs < now;
}

/**
 * Get days until expiration
 *
 * @param expireAt - Expiration timestamp
 * @param now - Current time (default: Date.now())
 * @returns Days remaining (negative if expired)
 */
export function daysUntilExpiration(
  expireAt: Date | Timestamp,
  now: number = Date.now()
): number {
  const expireMs =
    expireAt instanceof Date
      ? expireAt.getTime()
      : expireAt.toMillis();

  const diffMs = expireMs - now;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Extend TTL by additional days
 *
 * @param currentExpireAt - Current expiration timestamp
 * @param additionalDays - Days to add
 * @returns New expiration timestamp
 *
 * @example
 * ```typescript
 * // Extend snippet TTL by 90 days when used
 * const newExpireAt = extendTTL(doc.data().expire_at, 90);
 * await ref.update({ expire_at: newExpireAt, last_used_at: now() });
 * ```
 */
export function extendTTL(
  currentExpireAt: Date | Timestamp,
  additionalDays: number
): Date {
  const currentDate =
    currentExpireAt instanceof Date
      ? currentExpireAt
      : currentExpireAt.toDate();

  return ttlFromDays(additionalDays, currentDate);
}

/**
 * Reset TTL to default value
 *
 * @param type - Document type (snippet, feedback, metrics)
 * @returns New expiration timestamp
 */
export function resetTTL(
  type: keyof typeof DEFAULT_TTL_DAYS
): Date {
  return ttlFromDays(DEFAULT_TTL_DAYS[type]);
}

/**
 * Batch calculate TTL for multiple documents
 *
 * @param count - Number of documents
 * @param days - Days until expiration
 * @returns Array of expiration timestamps
 */
export function batchTTL(count: number, days: number): Date[] {
  const base = new Date();
  return Array.from({ length: count }, () => ttlFromDays(days, base));
}

/**
 * Get TTL status with human-readable message
 *
 * @param expireAt - Expiration timestamp
 * @returns Status object with message
 */
export function getTTLStatus(
  expireAt: Date | Timestamp | undefined
): {
  expired: boolean;
  daysRemaining: number;
  message: string;
} {
  if (!expireAt) {
    return {
      expired: false,
      daysRemaining: Infinity,
      message: "No expiration set",
    };
  }

  const days = daysUntilExpiration(expireAt);
  const expired = days < 0;

  let message: string;
  if (expired) {
    message = `Expired ${Math.abs(days)} days ago`;
  } else if (days === 0) {
    message = "Expires today";
  } else if (days === 1) {
    message = "Expires tomorrow";
  } else if (days < 7) {
    message = `Expires in ${days} days`;
  } else if (days < 30) {
    message = `Expires in ${Math.floor(days / 7)} weeks`;
  } else if (days < 365) {
    message = `Expires in ${Math.floor(days / 30)} months`;
  } else {
    message = `Expires in ${Math.floor(days / 365)} years`;
  }

  return {
    expired,
    daysRemaining: days,
    message,
  };
}

/**
 * Calculate optimal TTL based on usage
 * Frequently used documents get longer TTL
 *
 * @param useCount - Number of times accessed
 * @param baseDays - Base TTL in days
 * @returns Adjusted TTL in days
 *
 * @example
 * ```typescript
 * // Popular snippet (100+ uses) gets extended TTL
 * const ttlDays = getAdaptiveTTL(150, 180); // Returns 360 (doubled)
 * ```
 */
export function getAdaptiveTTL(
  useCount: number,
  baseDays: number = DEFAULT_TTL_DAYS.snippet
): number {
  // Usage thresholds for TTL extension
  if (useCount >= 100) {
    return baseDays * 2; // Double TTL for very popular items
  } else if (useCount >= 50) {
    return Math.floor(baseDays * 1.5); // 50% extension for popular items
  } else if (useCount >= 10) {
    return Math.floor(baseDays * 1.25); // 25% extension for moderate use
  } else {
    return baseDays; // Base TTL for low use
  }
}

/**
 * TTL policy configuration
 */
export type TTLPolicy = {
  enabled: boolean;
  defaultDays: number;
  adaptive: boolean; // Use adaptive TTL based on usage
  extendOnUse: boolean; // Extend TTL when accessed
  minDays: number; // Minimum TTL
  maxDays: number; // Maximum TTL
};

export const DEFAULT_TTL_POLICY: TTLPolicy = {
  enabled: true,
  defaultDays: DEFAULT_TTL_DAYS.snippet,
  adaptive: true,
  extendOnUse: false,
  minDays: 30,
  maxDays: 730, // 2 years max
};

/**
 * Apply TTL policy to calculate expiration
 *
 * @param policy - TTL policy configuration
 * @param useCount - Number of times accessed
 * @returns Expiration date
 */
export function applyTTLPolicy(
  policy: Partial<TTLPolicy> = {},
  useCount: number = 0
): Date | undefined {
  const fullPolicy = { ...DEFAULT_TTL_POLICY, ...policy };

  if (!fullPolicy.enabled) {
    return undefined; // No expiration
  }

  let days = fullPolicy.defaultDays;

  if (fullPolicy.adaptive) {
    days = getAdaptiveTTL(useCount, days);
  }

  // Clamp to min/max
  days = Math.max(fullPolicy.minDays, Math.min(fullPolicy.maxDays, days));

  return ttlFromDays(days);
}

/**
 * Create TTL field value for Firestore write
 *
 * @param type - Document type
 * @param options - TTL options
 * @returns Object with expire_at field
 *
 * @example
 * ```typescript
 * await ref.set({
 *   ...data,
 *   ...createTTLField('snippet', { useCount: 50 })
 * });
 * // Sets expire_at to 270 days (180 * 1.5) from now
 * ```
 */
export function createTTLField(
  type: keyof typeof DEFAULT_TTL_DAYS,
  options: {
    policy?: Partial<TTLPolicy>;
    useCount?: number;
    customDays?: number;
  } = {}
): { expire_at: Date } {
  const { policy, useCount = 0, customDays } = options;

  let expireAt: Date;

  if (customDays !== undefined) {
    expireAt = ttlFromDays(customDays);
  } else {
    const defaultDays = DEFAULT_TTL_DAYS[type];
    const fullPolicy = { ...DEFAULT_TTL_POLICY, defaultDays, ...policy };
    expireAt = applyTTLPolicy(fullPolicy, useCount) || ttlFromDays(defaultDays);
  }

  return { expire_at: expireAt };
}
