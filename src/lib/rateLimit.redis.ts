/**
 * Upstash Redis Rate Limiter (Serverless-Ready)
 * For production deployment on Vercel/Cloudflare
 *
 * Install:
 * pnpm add @upstash/redis
 *
 * ENV Variables:
 * - UPSTASH_REDIS_REST_URL: Your Upstash Redis REST URL
 * - UPSTASH_REDIS_REST_TOKEN: Your Upstash Redis REST Token
 * - RATE_LIMIT_WINDOW_MS: Sliding window duration (default: 60000 = 1 minute)
 * - RATE_LIMIT_MAX_REQS: Max requests per window (default: 10)
 */

import { Redis } from "@upstash/redis";

// Redis client (singleton)
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set");
    }

    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

// Configuration
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || "60000"); // 1 minute
const MAX_REQS = Number(process.env.RATE_LIMIT_MAX_REQS || "10"); // 10 requests per window

/**
 * Generate a unique key fingerprint for rate limiting
 * Combines IP, User-Agent, and API path
 */
export function getKeyFingerprint(opts: {
  ip?: string | null;
  ua?: string | null;
  path?: string;
}) {
  const ip = (opts.ip || "ip?").toString().slice(0, 64);
  const ua = (opts.ua || "ua?").toString().slice(0, 128);
  const path = (opts.path || "path?").toString().slice(0, 64);
  return `ratelimit:${path}::${ip}::${ua}`;
}

/**
 * Check if a request is allowed under rate limits using Redis
 * Uses Redis sorted set for distributed sliding window
 * Returns { allowed: boolean, retryAfterMs: number }
 */
export async function rateLimitAllow(key: string): Promise<{
  allowed: boolean;
  retryAfterMs: number;
}> {
  const redis = getRedis();
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  try {
    // Use Redis pipeline for atomic operations
    const pipeline = redis.pipeline();

    // 1. Remove old entries (outside sliding window)
    pipeline.zremrangebyscore(key, 0, windowStart);

    // 2. Count current requests in window
    pipeline.zcard(key);

    // 3. Get oldest request timestamp (for retry-after calculation)
    pipeline.zrange(key, 0, 0, { withScores: true });

    // Execute pipeline
    const results = await pipeline.exec();

    // Extract results
    const count = (results[1] as number) || 0;
    const oldest = results[2] as { score: number; member: string }[] | null;

    // Check if rate limit exceeded
    if (count >= MAX_REQS) {
      // Calculate retry-after based on oldest request
      const retryAfterMs = oldest && oldest.length > 0
        ? Math.max(0, (oldest[0].score + WINDOW_MS) - now)
        : WINDOW_MS;

      return { allowed: false, retryAfterMs };
    }

    // Allow request - add to sorted set
    const requestId = `${now}-${Math.random().toString(36).slice(2)}`;
    await redis.zadd(key, { score: now, member: requestId });

    // Set expiration (2x window to be safe)
    await redis.expire(key, Math.ceil((WINDOW_MS * 2) / 1000));

    return { allowed: true, retryAfterMs: 0 };
  } catch (error) {
    console.error("Redis rate limit error:", error);
    // Fail open - allow request if Redis is down
    return { allowed: true, retryAfterMs: 0 };
  }
}

/**
 * Get rate limit stats for a key
 */
export async function getRateLimitStats(key: string): Promise<{
  count: number;
  oldestTimestamp: number;
  newestTimestamp: number;
}> {
  const redis = getRedis();
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  try {
    // Remove old entries first
    await redis.zremrangebyscore(key, 0, windowStart);

    // Get count
    const count = await redis.zcard(key);

    // Get oldest and newest
    const oldest = await redis.zrange(key, 0, 0, { withScores: true });
    const newest = await redis.zrange(key, -1, -1, { withScores: true });

    return {
      count: count || 0,
      oldestTimestamp: oldest && oldest.length > 0 ? oldest[0].score : 0,
      newestTimestamp: newest && newest.length > 0 ? newest[0].score : 0,
    };
  } catch (error) {
    console.error("Redis stats error:", error);
    return { count: 0, oldestTimestamp: 0, newestTimestamp: 0 };
  }
}

/**
 * Clear rate limit for a key (admin function)
 */
export async function clearRateLimit(key: string): Promise<void> {
  const redis = getRedis();
  try {
    await redis.del(key);
  } catch (error) {
    console.error("Redis clear error:", error);
  }
}

/**
 * Get all rate limit keys (admin function)
 * Warning: Can be slow if many keys exist
 */
export async function getAllRateLimitKeys(): Promise<string[]> {
  const redis = getRedis();
  try {
    const keys = await redis.keys("ratelimit:*");
    return keys || [];
  } catch (error) {
    console.error("Redis keys error:", error);
    return [];
  }
}
