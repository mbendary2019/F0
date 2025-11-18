import { adminDb } from "@/server/firebaseAdmin";

/**
 * Firestore-based Rate Limiting (Fallback)
 *
 * This is a simple rate limiter using Firestore transactions.
 * Not as performant as Redis, but works without external dependencies.
 *
 * Use this as a fallback when Upstash Redis is not available.
 */

export interface FirestoreRateLimitResult {
  ok: boolean;
  remaining: number;
  reset: number; // Timestamp in milliseconds
}

/**
 * Check and increment rate limit using Firestore
 *
 * @param key - Unique identifier for rate limit (e.g., `api:task:uid123`)
 * @param points - Maximum requests allowed (default: 60)
 * @param windowSec - Time window in seconds (default: 60)
 * @returns Rate limit result
 *
 * @example
 * ```ts
 * try {
 *   const result = await limitFs('api:task:' + uid, 60, 60);
 *   // Request allowed
 * } catch (error) {
 *   if (error.message === 'RATE_LIMIT') {
 *     return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 *   }
 * }
 * ```
 */
export async function limitFs(
  key: string,
  points: number = 60,
  windowSec: number = 60
): Promise<FirestoreRateLimitResult> {
  const docRef = adminDb.doc(`rate_limits/${key}`);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      const now = Date.now();

      let windowData: { start: number; count: number };

      if (!doc.exists) {
        // First request in window
        windowData = { start: now, count: 1 };
      } else {
        windowData = doc.data() as { start: number; count: number };

        // Check if window has expired
        if (now - windowData.start > windowSec * 1000) {
          // Reset window
          windowData = { start: now, count: 1 };
        } else {
          // Within window - check limit
          if (windowData.count >= points) {
            const resetTime = windowData.start + windowSec * 1000;
            throw new Error(
              `RATE_LIMIT:${windowData.count}:${resetTime}`
            );
          }

          // Increment count
          windowData.count++;
        }
      }

      // Update document
      transaction.set(docRef, windowData);

      return {
        ok: true,
        remaining: points - windowData.count,
        reset: windowData.start + windowSec * 1000,
      };
    });

    return result;
  } catch (error: any) {
    // Check if this is a rate limit error
    if (error.message && error.message.startsWith("RATE_LIMIT:")) {
      const [, count, reset] = error.message.split(":");

      return {
        ok: false,
        remaining: 0,
        reset: parseInt(reset, 10),
      };
    }

    // Other transaction errors - fail open
    console.error("Firestore rate limit error:", error.message);
    return {
      ok: true,
      remaining: points,
      reset: Date.now() + windowSec * 1000,
    };
  }
}

/**
 * Get current rate limit status without incrementing
 *
 * @param key - Rate limit key
 * @param points - Maximum requests allowed
 * @param windowSec - Time window in seconds
 * @returns Current status
 */
export async function getRateLimitStatusFs(
  key: string,
  points: number = 60,
  windowSec: number = 60
): Promise<FirestoreRateLimitResult> {
  try {
    const doc = await adminDb.doc(`rate_limits/${key}`).get();

    if (!doc.exists) {
      return {
        ok: true,
        remaining: points,
        reset: Date.now() + windowSec * 1000,
      };
    }

    const data = doc.data() as { start: number; count: number };
    const now = Date.now();

    // Check if window expired
    if (now - data.start > windowSec * 1000) {
      return {
        ok: true,
        remaining: points,
        reset: now + windowSec * 1000,
      };
    }

    const remaining = points - data.count;

    return {
      ok: remaining > 0,
      remaining: Math.max(0, remaining),
      reset: data.start + windowSec * 1000,
    };
  } catch (error: any) {
    console.error("Error getting rate limit status:", error.message);
    return {
      ok: true,
      remaining: points,
      reset: Date.now() + windowSec * 1000,
    };
  }
}

/**
 * Reset rate limit for a key
 *
 * @param key - Rate limit key to reset
 */
export async function resetRateLimitFs(key: string): Promise<void> {
  try {
    await adminDb.doc(`rate_limits/${key}`).delete();
  } catch (error: any) {
    console.error("Error resetting rate limit:", error.message);
  }
}

/**
 * Clean up expired rate limit documents
 * Should be called periodically (e.g., via Cloud Scheduler)
 *
 * @param windowSec - Consider documents older than this expired
 */
export async function cleanupExpiredRateLimits(
  windowSec: number = 60
): Promise<number> {
  const cutoff = Date.now() - windowSec * 1000;
  let deleted = 0;

  try {
    const snapshot = await adminDb
      .collection("rate_limits")
      .where("start", "<", cutoff)
      .limit(500) // Batch size
      .get();

    const batch = adminDb.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deleted++;
    });

    await batch.commit();

    console.log(`✅ Cleaned up ${deleted} expired rate limit documents`);

    return deleted;
  } catch (error: any) {
    console.error("Error cleaning up rate limits:", error.message);
    return deleted;
  }
}
