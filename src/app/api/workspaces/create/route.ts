import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/firebaseAdmin";
import { assertAuth } from "@/server/authAssert";
import { limitOrNull } from "@/server/rateLimit";
import { logAudit } from "@/server/audit";

export const dynamic = 'force-dynamic';

/**
 * Create Workspace API
 *
 * POST /api/workspaces/create
 *
 * Creates a new workspace and sets the creator as owner.
 * Requires active subscription.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const path = "/api/workspaces/create";
  const method = "POST";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.ip || null;
  const ua = req.headers.get("user-agent") || null;

  try {
    // 1. Verify authentication and subscription
    const auth = await assertAuth(req, { requireActive: true });

    if (!auth.ok) {
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
    const rlKey = `workspaces:create:${auth.uid}`;
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
        rl,
        err_code: "RATE_LIMIT",
      });

      return NextResponse.json(
        { error: "Too many workspace creation requests" },
        { status: 429 }
      );
    }

    // 3. Parse request body
    const body = await req.json();
    const { name } = body;

    // Validate workspace name
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Workspace name is required" },
        { status: 400 }
      );
    }

    if (name.trim().length === 0) {
      return NextResponse.json(
        { error: "Workspace name cannot be empty" },
        { status: 400 }
      );
    }

    if (name.length > 80) {
      return NextResponse.json(
        { error: "Workspace name must be 80 characters or less" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // 4. Create workspace
    const wsRef = await adminDb.collection("workspaces").add({
      name: trimmedName,
      ownerUid: auth.uid,
      planTier: auth.claims.sub_tier || "free",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 5. Add creator as owner member
    await wsRef.collection("members").doc(auth.uid).set({
      role: "owner",
      status: "active",
      joinedAt: new Date(),
    });

    // 6. Log success
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
      metadata: { workspaceId: wsRef.id, workspaceName: trimmedName },
    });

    return NextResponse.json(
      {
        id: wsRef.id,
        name: trimmedName,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Workspace creation error:", error);

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

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
