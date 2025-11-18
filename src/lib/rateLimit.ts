/**
 * In-Memory Rate Limiter
 * Sliding Window + Token Bucket hybrid
 *
 * Configuration via ENV:
 * - RATE_LIMIT_WINDOW_MS: Sliding window duration (default: 60000 = 1 minute)
 * - RATE_LIMIT_MAX_REQS: Max requests per window (default: 10)
 * - RATE_LIMIT_BURST: Token bucket capacity (default: 5)
 * - RATE_LIMIT_REFILL_MS: Token refill interval (default: 5000 = 5 seconds)
 * - RATE_LIMIT_REFILL_TOKENS: Tokens added per refill (default: 1)
 *
 * Note: For serverless (Vercel/Cloudflare), consider Redis/Upstash for distributed state.
 */

type Bucket = {
  tokens: number;
  lastRefill: number;
  hits: number[];
};

const store: Map<string, Bucket> = new Map();

// Configuration from ENV (with defaults)
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || "60000"); // 1 minute
const MAX_REQS = Number(process.env.RATE_LIMIT_MAX_REQS || "10"); // 10 requests per window
const BURST = Number(process.env.RATE_LIMIT_BURST || "5"); // 5 tokens max
const REFILL_MS = Number(process.env.RATE_LIMIT_REFILL_MS || "5000"); // Refill every 5 seconds
const REFILL_TOKENS = Number(process.env.RATE_LIMIT_REFILL_TOKENS || "1"); // 1 token per refill

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
  return `${path}::${ip}::${ua}`;
}

/**
 * Check if a request is allowed under rate limits
 * Returns { allowed: boolean, retryAfterMs: number }
 */
export function rateLimitAllow(key: string): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();

  // Get or create bucket for this key
  let b = store.get(key);
  if (!b) {
    b = { tokens: BURST, lastRefill: now, hits: [] };
    store.set(key, b);
  }

  // 1) Token bucket: refill tokens over time
  const elapsed = Math.max(0, now - b.lastRefill);
  const refillCount = Math.floor(elapsed / REFILL_MS) * REFILL_TOKENS;
  if (refillCount > 0) {
    b.tokens = Math.min(BURST, b.tokens + refillCount);
    b.lastRefill = now;
  }

  // 2) Sliding window: prune old hits
  const cutoff = now - WINDOW_MS;
  b.hits = b.hits.filter((ts) => ts >= cutoff);

  // 3) Check limits
  if (b.hits.length >= MAX_REQS || b.tokens <= 0) {
    // Rate limit exceeded
    // Calculate when the oldest hit will expire
    const retryAfter = b.hits.length > 0
      ? Math.max(0, b.hits[0] + WINDOW_MS - now)
      : REFILL_MS; // Wait for next token refill

    return { allowed: false, retryAfterMs: retryAfter };
  }

  // 4) Allow request - consume token and record hit
  b.tokens -= 1;
  b.hits.push(now);

  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Cleanup old entries periodically (optional)
 * Run this via setInterval or cron to prevent memory bloat
 */
export function cleanupOldEntries() {
  const now = Date.now();
  const cutoff = now - WINDOW_MS * 2; // Keep entries for 2x window duration

  for (const [key, bucket] of store.entries()) {
    // Remove if no recent hits
    if (bucket.hits.length === 0 || bucket.hits[bucket.hits.length - 1] < cutoff) {
      store.delete(key);
    }
  }
}

// Optional: Run cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupOldEntries, 5 * 60 * 1000);
}
