import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/firebaseAdmin";
import { assertAuth } from "@/server/authAssert";
import { logAudit } from "@/server/audit";

export const dynamic = 'force-dynamic';

/**
 * Remove Member API
 *
 * DELETE /api/workspaces/[wsId]/members/[memberUid]
 *
 * Removes a member from a workspace.
 * Only admins and owners can remove members.
 * Users cannot remove themselves (use leave endpoint instead).
 * Cannot remove the workspace owner.
 */

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { wsId: string; memberUid: string } }
) {
  const t0 = Date.now();
  const { wsId, memberUid } = params;
  const path = `/api/workspaces/${wsId}/members/${memberUid}`;
  const method = "DELETE";

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
        { error: "Only admins and owners can remove members" },
        { status: 403 }
      );
    }

    // 4. Prevent removing self
    if (memberUid === auth.uid) {
      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 400,
        ok: false,
        ip,
        ua,
        err_code: "CANNOT_REMOVE_SELF",
      });

      return NextResponse.json(
        {
          error: "You cannot remove yourself. Use the leave workspace endpoint instead.",
        },
        { status: 400 }
      );
    }

    // 5. Check if target member exists
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

    // 6. Prevent removing the workspace owner
    if (targetMemberData.role === "owner") {
      await logAudit({
        uid: auth.uid,
        path,
        method,
        status: 403,
        ok: false,
        ip,
        ua,
        err_code: "CANNOT_REMOVE_OWNER",
      });

      return NextResponse.json(
        { error: "Cannot remove the workspace owner" },
        { status: 403 }
      );
    }

    // 7. Remove member
    await adminDb.doc(`workspaces/${wsId}/members/${memberUid}`).delete();

    // 8. Log success
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
        removedMember: memberUid,
        removedRole: targetMemberData.role,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Member removed successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Remove member error:", error);

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
