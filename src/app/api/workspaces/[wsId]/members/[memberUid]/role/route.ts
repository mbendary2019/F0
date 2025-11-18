import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/firebaseAdmin";
import { assertAuth } from "@/server/authAssert";
import { logAudit } from "@/server/audit";

/**
 * Change Member Role API
 *
 * POST /api/workspaces/[wsId]/members/[memberUid]/role
 *
 * Changes the role of a workspace member.
 * Only admins and owners can change roles.
 * Users cannot change their own role.
 */

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { wsId: string; memberUid: string } }
) {
  const t0 = Date.now();
  const { wsId, memberUid } = params;
  const path = `/api/workspaces/${wsId}/members/${memberUid}/role`;
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

    // 2. Check if requester is a member
    const requesterDoc = await adminDb
      .doc(`workspaces/${wsId}/members/${auth.uid}`)
      .get();

    if (!requesterDoc.exists) {
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

    // 3. Check if requester has permission (owner or admin)
    const requesterData = requesterDoc.data() as any;
    const requesterRole = requesterData.role;

    if (!["owner", "admin"].includes(requesterRole)) {
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
        { error: "Only admins and owners can change member roles" },
        { status: 403 }
      );
    }

    // 4. Prevent changing own role
    if (memberUid === auth.uid) {
      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 400,
        ok: false,
        ip,
        ua,
        err_code: "CANNOT_CHANGE_OWN_ROLE",
      });

      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 400 }
      );
    }

    // 5. Parse request body
    const body = await req.json();
    const { newRole } = body;

    // Validate new role
    const validRoles = ["admin", "member", "viewer"];

    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // 6. Check if target member exists
    const targetMemberDoc = await adminDb
      .doc(`workspaces/${wsId}/members/${memberUid}`)
      .get();

    if (!targetMemberDoc.exists) {
      return NextResponse.json(
        { error: "Member not found in workspace" },
        { status: 404 }
      );
    }

    const targetMemberData = targetMemberDoc.data() as any;

    // 7. Prevent demoting the workspace owner
    if (targetMemberData.role === "owner") {
      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 403,
        ok: false,
        ip,
        ua,
        err_code: "CANNOT_DEMOTE_OWNER",
      });

      return NextResponse.json(
        { error: "Cannot change the role of the workspace owner" },
        { status: 403 }
      );
    }

    // 8. Update member role
    await adminDb.doc(`workspaces/${wsId}/members/${memberUid}`).update({
      role: newRole,
      updatedAt: new Date(),
    });

    // 9. Log success
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
        targetMember: memberUid,
        oldRole: targetMemberData.role,
        newRole,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        role: newRole,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Change role error:", error);

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
