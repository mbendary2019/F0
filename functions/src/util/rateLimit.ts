/**
 * Simple In-Memory Rate Limiter
 * For production, replace with Redis/Memorystore
 */

interface RateLimitBucket {
  count: number;
  reset: number;
}

const buckets = new Map<string, RateLimitBucket>();

// Clean up old buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.reset < now) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if a key is within rate limit
 * @param key Unique identifier (e.g., IP address, user ID)
 * @param limit Maximum number of requests
 * @param windowMs Time window in milliseconds
 * @returns true if within limit, false if exceeded
 */
export function checkRate(
  key: string,
  limit = 60,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.reset < now) {
    // Create new bucket or reset expired one
    buckets.set(key, {
      count: 1,
      reset: now + windowMs,
    });
    return true;
  }

  bucket.count++;
  return bucket.count <= limit;
}

/**
 * Get current count for a key
 */
export function getCount(key: string): number {
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < Date.now()) {
    return 0;
  }
  return bucket.count;
}

/**
 * Reset rate limit for a key
 */
export function resetLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Get time until reset for a key
 */
export function getTimeUntilReset(key: string): number {
  const bucket = buckets.get(key);
  if (!bucket) return 0;

  const now = Date.now();
  return Math.max(0, bucket.reset - now);
}
