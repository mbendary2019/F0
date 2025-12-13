import { NextRequest, NextResponse } from "next/server";
import { assertAuth } from "@/server/authAssert";
import { limitOrNull } from "@/server/rateLimit";
import { limitFs } from "@/server/rateLimitFirestore";
import { logAudit } from "@/server/audit";

export const dynamic = 'force-dynamic';

/**
 * Protected Pro API Route Example
 *
 * This route demonstrates the complete security stack:
 * 1. Token verification with custom claims (assertAuth)
 * 2. Rate limiting (Redis or Firestore fallback)
 * 3. Audit logging
 *
 * POST /api/pro/task
 * Requires: Active Pro subscription
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const path = "/api/pro/task";
  const method = "POST";

  // Extract request metadata
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.ip || null;
  const ua = req.headers.get("user-agent") || null;

  try {
    // 1. Verify authentication and check subscription
    const auth = await assertAuth(req, {
      requireActive: true,
      tiers: ["pro"], // Only allow 'pro' tier
    });

    if (!auth.ok) {
      // Log failed auth attempt
      await logAudit({
        path,
        method,
        status: auth.status,
        ok: false,
        ip,
        ua,
        latency_ms: Date.now() - t0,
        err_code: auth.error,
      });

      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    // 2. Rate limiting
    const rlKey = `pro:task:${auth.uid}:${ip ?? "noip"}`;

    // Try Upstash Redis first
    let rl = await limitOrNull(rlKey);

    if (rl && !rl.ok) {
      // Rate limit exceeded
      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 429,
        ok: false,
        ip,
        ua,
        latency_ms: Date.now() - t0,
        claims: auth.claims,
        rl: { remaining: rl.remaining, reset: rl.reset },
        err_code: "RATE_LIMIT",
      });

      return NextResponse.json(
        {
          error: "Too many requests",
          resetAt: rl.reset ? new Date(rl.reset).toISOString() : null,
        },
        { status: 429 }
      );
    }

    // Fallback to Firestore if Redis not configured
    if (!rl || rl.ok === undefined) {
      const points = Number(process.env.RATE_LIMIT_POINTS || 60);
      const duration = Number(process.env.RATE_LIMIT_DURATION_SECONDS || 60);

      const fsResult = await limitFs(rlKey, points, duration);

      if (!fsResult.ok) {
        await logAudit({
          uid: auth.uid,
          path,
          method,
          status: 429,
          ok: false,
          ip,
          ua,
          latency_ms: Date.now() - t0,
          claims: auth.claims,
          rl: { remaining: fsResult.remaining, reset: fsResult.reset },
          err_code: "RATE_LIMIT",
        });

        return NextResponse.json(
          {
            error: "Too many requests",
            resetAt: new Date(fsResult.reset).toISOString(),
          },
          { status: 429 }
        );
      }

      rl = { ok: true, remaining: fsResult.remaining, reset: fsResult.reset };
    }

    // 3. Parse request body
    const body = await req.json();
    const { taskName, description } = body;

    if (!taskName) {
      return NextResponse.json(
        { error: "taskName is required" },
        { status: 400 }
      );
    }

    // 4. Business logic here
    // TODO: Implement actual task creation logic
    const result = {
      ok: true,
      task: {
        id: crypto.randomUUID(),
        name: taskName,
        description: description || null,
        userId: auth.uid,
        createdAt: new Date().toISOString(),
      },
    };

    // 5. Log successful request
    await logAudit({
      uid: auth.uid,
      path,
      method,
      status: 200,
      ok: true,
      ip,
      ua,
      latency_ms: Date.now() - t0,
      claims: auth.claims,
      rl: { remaining: rl.remaining, reset: rl.reset },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    // Log internal errors
    await logAudit({
      path,
      method,
      status: 500,
      ok: false,
      ip,
      ua,
      latency_ms: Date.now() - t0,
      err_code: "INTERNAL_ERROR",
    });

    console.error("Internal error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pro/task
 * List user's tasks
 */
export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const path = "/api/pro/task";
  const method = "GET";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.ip || null;
  const ua = req.headers.get("user-agent") || null;

  try {
    // Verify auth (any pro tier)
    const auth = await assertAuth(req, { requireActive: true });

    if (!auth.ok) {
      await logAudit({
        path,
        method,
        status: auth.status,
        ok: false,
        ip,
        ua,
        err_code: auth.error,
      });

      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    // Rate limit
    const rlKey = `pro:task:get:${auth.uid}`;
    const rl = await limitOrNull(rlKey);

    if (rl && !rl.ok) {
      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 429,
        ok: false,
        ip,
        ua,
        claims: auth.claims,
        err_code: "RATE_LIMIT",
      });

      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // TODO: Fetch tasks from database
    const tasks: any[] = [];

    await logAudit({
      uid: auth.uid,
      path,
      method,
      status: 200,
      ok: true,
      ip,
      ua,
      latency_ms: Date.now() - t0,
      claims: auth.claims,
    });

    return NextResponse.json({ tasks }, { status: 200 });
  } catch (error: any) {
    await logAudit({
      path,
      method,
      status: 500,
      ok: false,
      ip,
      ua,
      err_code: "INTERNAL_ERROR",
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
