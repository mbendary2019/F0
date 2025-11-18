/**
 * Phase 49: In-Memory Rate Limiter
 * For production: use Redis or Firestore
 */

interface Bucket {
  count: number;
  reset: number; // timestamp when bucket resets
}

const buckets = new Map<string, Bucket>();

/**
 * Check rate limit for a key
 * @param key - Unique key (e.g., "log:192.168.1.1")
 * @param limit - Max requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if allowed, false if rate limited
 */
export function checkRate(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  // No bucket or expired bucket
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }

  // Increment counter
  bucket.count++;

  // Check if exceeded
  if (bucket.count > limit) {
    return false;
  }

  return true;
}

/**
 * Cleanup expired buckets (call periodically)
 */
export function cleanupBuckets(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.reset < now) {
      buckets.delete(key);
    }
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupBuckets, 5 * 60 * 1000);
