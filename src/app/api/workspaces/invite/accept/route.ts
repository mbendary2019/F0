import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/firebaseAdmin";
import { assertAuth } from "@/server/authAssert";
import { logAudit } from "@/server/audit";
import { hashToken } from "@/server/crypto";

/**
 * Accept Workspace Invite API
 *
 * POST /api/workspaces/invite/accept
 *
 * Accepts a workspace invitation and adds the user as a member.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const path = "/api/workspaces/invite/accept";
  const method = "POST";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.ip || null;
  const ua = req.headers.get("user-agent") || null;

  try {
    // 1. Verify authentication (any authenticated user can accept invite)
    const auth = await assertAuth(req);

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

    // 2. Parse request body
    const body = await req.json();
    const { token, id } = body;

    if (!token || !id) {
      return NextResponse.json(
        { error: "Missing token or invite ID" },
        { status: 400 }
      );
    }

    // 3. Fetch invite document
    const inviteDoc = await adminDb.doc(`invites/${id}`).get();

    if (!inviteDoc.exists) {
      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 404,
        ok: false,
        ip,
        ua,
        err_code: "INVITE_NOT_FOUND",
      });

      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    const inviteData = inviteDoc.data() as any;

    // 4. Check if invite has already been used
    if (inviteData.usedBy) {
      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 410,
        ok: false,
        ip,
        ua,
        err_code: "INVITE_ALREADY_USED",
      });

      return NextResponse.json(
        { error: "Invite has already been used" },
        { status: 410 }
      );
    }

    // 5. Check if invite has expired
    const expiresAt = inviteData.expiresAt.toDate
      ? inviteData.expiresAt.toDate()
      : new Date(inviteData.expiresAt);

    if (expiresAt < new Date()) {
      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 410,
        ok: false,
        ip,
        ua,
        err_code: "INVITE_EXPIRED",
      });

      return NextResponse.json(
        { error: "Invite has expired" },
        { status: 410 }
      );
    }

    // 6. Verify token hash
    const tokenHash = hashToken(token);

    if (tokenHash !== inviteData.tokenHash) {
      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 401,
        ok: false,
        ip,
        ua,
        err_code: "INVALID_TOKEN",
      });

      return NextResponse.json(
        { error: "Invalid invite token" },
        { status: 401 }
      );
    }

    // 7. Check if email matches (if invite was email-specific)
    if (inviteData.email && auth.claims.email) {
      if (inviteData.email.toLowerCase() !== auth.claims.email.toLowerCase()) {
        await logAudit({
          uid: auth.uid,
          path,
          method,
          status: 403,
          ok: false,
          ip,
          ua,
          err_code: "EMAIL_MISMATCH",
        });

        return NextResponse.json(
          { error: "This invite is for a different email address" },
          { status: 403 }
        );
      }
    }

    const wsId = inviteData.wsId;

    // 8. Check if user is already a member
    const existingMember = await adminDb
      .doc(`workspaces/${wsId}/members/${auth.uid}`)
      .get();

    if (existingMember.exists) {
      // Already a member - just mark invite as used
      await inviteDoc.ref.update({
        usedBy: auth.uid,
        usedAt: new Date(),
      });

      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 200,
        ok: true,
        ip,
        ua,
        latency_ms: Date.now() - t0,
        metadata: { workspaceId: wsId, alreadyMember: true },
      });

      return NextResponse.json(
        {
          ok: true,
          wsId,
          message: "You are already a member of this workspace",
        },
        { status: 200 }
      );
    }

    // 9. Add user as member
    await adminDb.doc(`workspaces/${wsId}/members/${auth.uid}`).set({
      role: inviteData.role,
      status: "active",
      invitedBy: inviteData.createdBy,
      joinedAt: new Date(),
    });

    // 10. Mark invite as used
    await inviteDoc.ref.update({
      usedBy: auth.uid,
      usedAt: new Date(),
    });

    // 11. Log success
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
        role: inviteData.role,
        inviteId: id,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        wsId,
        role: inviteData.role,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Accept invite error:", error);

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
