/**
 * CORS Utilities
 * Centralized CORS handling for API routes
 */

/**
 * Parse allowed origins from environment variable
 * @returns Array of allowed origin URLs
 */
export function parseAllowedOrigins(): string[] {
  const origins = process.env.CORS_ALLOWED_ORIGINS ?? "";
  return origins
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Check if origin is allowed
 * @param origin - Origin header from request
 * @param allowlist - List of allowed origins (defaults to parseAllowedOrigins())
 * @returns true if origin is allowed
 */
export function isOriginAllowed(
  origin: string,
  allowlist = parseAllowedOrigins()
): boolean {
  // If allowlist is empty, allow all (development mode)
  if (!allowlist.length) return true;

  // Check if origin exists and is in allowlist
  return !!origin && allowlist.includes(origin);
}

/**
 * Build CORS headers
 * @param origin - Origin header from request
 * @param allowed - Whether origin is allowed
 * @returns Headers object with CORS headers
 */
export function buildCorsHeaders(origin: string, allowed: boolean): Headers {
  const headers = new Headers();

  if (allowed && origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "content-type, authorization");
    headers.set("Access-Control-Max-Age", "3600"); // 1 hour
  }

  return headers;
}

/**
 * Get IP address from request headers
 * Supports Vercel, Cloudflare, and other platforms
 * @param req - NextRequest object
 * @returns IP address or null
 */
export function getIpFromRequest(req: {
  headers: { get: (key: string) => string | null };
}): string | null {
  // Try x-forwarded-for first (Vercel, most proxies)
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    // Take first IP in comma-separated list
    return xForwardedFor.split(",")[0]?.trim() || null;
  }

  // Try cf-connecting-ip (Cloudflare)
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Try x-real-ip (nginx)
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  return null;
}
