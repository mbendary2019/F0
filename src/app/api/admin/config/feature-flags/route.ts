import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionCookie } from "@/lib/auth-helpers";

/**
 * GET /api/admin/config/feature-flags
 * Returns current feature flags
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifySessionCookie(req);
    if (!session?.claims?.admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const doc = await adminDb.collection("config").doc("feature_flags").get();
    const flags = doc.exists ? doc.data() : {};

    return NextResponse.json({ flags });
  } catch (error: any) {
    console.error("[GET /api/admin/config/feature-flags] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/config/feature-flags
 * Updates feature flags (merge)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await verifySessionCookie(req);
    if (!session?.claims?.admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { flags } = body;

    if (!flags || typeof flags !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid 'flags' object" },
        { status: 400 }
      );
    }

    // Add metadata
    const updatedFlags = {
      ...flags,
      updatedAt: Date.now(),
      updatedBy: session.uid,
    };

    await adminDb
      .collection("config")
      .doc("feature_flags")
      .set(updatedFlags, { merge: true });

    return NextResponse.json({ success: true, flags: updatedFlags });
  } catch (error: any) {
    console.error("[POST /api/admin/config/feature-flags] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
