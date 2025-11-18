import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionCookie } from "@/lib/auth-helpers";

/**
 * GET /api/admin/config/app
 * Returns current app config
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifySessionCookie(req);
    if (!session?.claims?.admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const doc = await adminDb.collection("config").doc("app").get();
    const config = doc.exists ? doc.data() : {};

    return NextResponse.json({ config });
  } catch (error: any) {
    console.error("[GET /api/admin/config/app] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/config/app
 * Updates app config (merge)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await verifySessionCookie(req);
    if (!session?.claims?.admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { config } = body;

    if (!config || typeof config !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid 'config' object" },
        { status: 400 }
      );
    }

    // Add metadata
    const updatedConfig = {
      ...config,
      updatedAt: Date.now(),
      updatedBy: session.uid,
    };

    await adminDb
      .collection("config")
      .doc("app")
      .set(updatedConfig, { merge: true });

    return NextResponse.json({ success: true, config: updatedConfig });
  } catch (error: any) {
    console.error("[POST /api/admin/config/app] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
