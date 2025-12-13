import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { rateLimitAllow, getKeyFingerprint } from "@/lib/rateLimit";
import { isOriginAllowed, buildCorsHeaders, getIpFromRequest } from "@/lib/http/cors";

export const dynamic = 'force-dynamic';

/**
 * Community Analytics Tracking API
 *
 * Security Features:
 * - CORS strict origin policy
 * - Rate limiting (configurable via ENV)
 * - Payload size guard (max 4KB by default)
 * - PII filtering (removes sensitive data)
 * - IP redaction (always "redacted")
 *
 * Configuration:
 * - CORS_ALLOWED_ORIGINS: Comma-separated list of allowed origins
 * - PAYLOAD_MAX_BYTES: Maximum payload size in bytes (default: 4096)
 * - RATE_LIMIT_*: Rate limiting configuration (see rateLimit.ts)
 */

const MAX_BYTES = Number(process.env.PAYLOAD_MAX_BYTES ?? "4096");

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  const allowed = isOriginAllowed(origin);
  const headers = buildCorsHeaders(origin, allowed);

  // Return 204 No Content with CORS headers
  return new NextResponse(null, { status: 204, headers });
}

/**
 * POST handler for tracking events
 */
export async function POST(req: NextRequest) {
  await initAdmin();

  const origin = req.headers.get("origin") || "";
  const allowed = isOriginAllowed(origin);
  const cors = buildCorsHeaders(origin, allowed);

  // 1. CORS strict check
  if (!allowed && origin) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "CORS_FORBIDDEN" }),
      { status: 403, headers: cors }
    );
  }

  try {
    // 2. Rate limiting (before reading body for performance)
    const key = getKeyFingerprint({
      ip: getIpFromRequest(req),
      ua: req.headers.get("user-agent"),
      path: "/api/ops/analytics/track",
    });

    const rl = rateLimitAllow(key);

    if (!rl.allowed) {
      const res = new NextResponse(
        JSON.stringify({ ok: false, error: "RATE_LIMIT_EXCEEDED" }),
        { status: 429, headers: cors }
      );
      res.headers.set("Retry-After", Math.ceil(rl.retryAfterMs / 1000).toString());
      res.headers.set("X-RateLimit-Limit", process.env.RATE_LIMIT_MAX_REQS ?? "10");
      res.headers.set("X-RateLimit-Window-MS", process.env.RATE_LIMIT_WINDOW_MS ?? "60000");
      return res;
    }

    // 3. Payload size guard - check Content-Length first
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength && contentLength > MAX_BYTES) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "PAYLOAD_TOO_LARGE" }),
        { status: 413, headers: cors }
      );
    }

    // Read body as text and verify actual byte size
    const rawBody = await req.text();
    const actualBytes = new TextEncoder().encode(rawBody).length;

    if (actualBytes > MAX_BYTES) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "PAYLOAD_TOO_LARGE" }),
        { status: 413, headers: cors }
      );
    }

    // 4. Parse JSON
    let body: any = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "INVALID_JSON" }),
        { status: 400, headers: cors }
      );
    }

    const { name, data = {}, ts = Date.now() } = body || {};

    // Validate event name
    if (!name || typeof name !== "string") {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "INVALID_NAME" }),
        { status: 400, headers: cors }
      );
    }

    // 5. Sanitize - remove any potential PII
    const clean = JSON.parse(JSON.stringify(data ?? {}));

    // Extended PII blacklist
    delete clean.email;
    delete clean.phone;
    delete clean.name;
    delete clean.address;
    delete clean.walletAddress;
    delete clean.wallet;
    delete clean.privateKey;
    delete clean.userId;
    delete clean.uid;
    delete clean.ip;
    delete clean.ipAddress;
    delete clean.creditCard;
    delete clean.ssn;
    delete clean.password;

    // 6. Write to Firestore
    const db = getFirestore();
    await db.collection("ops_community_events").add({
      name,
      data: clean,
      ts,
      ua: req.headers.get("user-agent") || "",
      ip: "redacted", // Never store actual IP
      createdAt: Date.now(),
    });

    // 7. Return success
    const res = new NextResponse(
      JSON.stringify({ ok: true }),
      { status: 200, headers: cors }
    );
    res.headers.set("Cache-Control", "no-store");
    return res;

  } catch (e: any) {
    console.error("Track error:", e);
    return new NextResponse(
      JSON.stringify({ ok: false, error: "INTERNAL" }),
      { status: 500, headers: cors }
    );
  }
}
