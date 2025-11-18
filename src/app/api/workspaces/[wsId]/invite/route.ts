import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/firebaseAdmin";
import { assertAuth } from "@/server/authAssert";
import { limitOrNull } from "@/server/rateLimit";
import { logAudit } from "@/server/audit";
import { createInviteToken, hashToken } from "@/server/crypto";

/**
 * Create Workspace Invite API
 *
 * POST /api/workspaces/[wsId]/invite
 *
 * Creates a secure invite link for a workspace.
 * Only admins and owners can create invites.
 */

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { wsId: string } }
) {
  const t0 = Date.now();
  const { wsId } = params;
  const path = `/api/workspaces/${wsId}/invite`;
  const method = "POST";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.ip || null;
  const ua = req.headers.get("user-agent") || null;

  try {
    // 1. Verify authentication
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

    // 2. Check if user is a member of the workspace
    const memberDoc = await adminDb
      .doc(`workspaces/${wsId}/members/${auth.uid}`)
      .get();

    if (!memberDoc.exists) {
      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 403,
        ok: false,
        ip,
        ua,
        err_code: "NOT_MEMBER",
      });

      return NextResponse.json(
        { error: "You are not a member of this workspace" },
        { status: 403 }
      );
    }

    // 3. Check if user has permission to invite (owner or admin)
    const memberData = memberDoc.data() as any;
    const userRole = memberData.role;

    if (!["owner", "admin"].includes(userRole)) {
      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 403,
        ok: false,
        ip,
        ua,
        err_code: "INSUFFICIENT_ROLE",
      });

      return NextResponse.json(
        { error: "Only admins and owners can create invites" },
        { status: 403 }
      );
    }

    // 4. Rate limiting
    const rlKey = `workspace:invite:${wsId}:${auth.uid}`;
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
        rl,
        err_code: "RATE_LIMIT",
      });

      return NextResponse.json(
        { error: "Too many invite requests" },
        { status: 429 }
      );
    }

    // 5. Parse request body
    const body = await req.json();
    const { email, role: targetRole } = body;

    // Validate role
    const validRoles = ["admin", "member", "viewer"];
    const roleToAssign = validRoles.includes(targetRole) ? targetRole : "member";

    // Optional email validation
    if (email && typeof email === "string" && email.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }
    }

    // 6. Generate secure token
    const rawToken = createInviteToken();
    const tokenHash = hashToken(rawToken);

    // 7. Calculate expiry
    const ttlMinutes = Number(process.env.INVITE_TTL_MINUTES || 10080); // 1 week default
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // 8. Create invite document
    const inviteRef = await adminDb.collection("invites").add({
      wsId,
      email: email || null,
      role: roleToAssign,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
      createdBy: auth.uid,
      usedBy: null,
      usedAt: null,
    });

    // 9. Generate invite URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/workspaces/invite?token=${rawToken}&id=${inviteRef.id}`;

    // 10. Log success
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
      metadata: {
        workspaceId: wsId,
        inviteId: inviteRef.id,
        role: roleToAssign,
      },
    });

    return NextResponse.json(
      {
        inviteId: inviteRef.id,
        url: inviteUrl,
        role: roleToAssign,
        expiresAt: expiresAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Invite creation error:", error);

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
