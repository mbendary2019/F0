// API route to fetch Firestore documents for Ops Dashboard
// Requires admin authentication

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { assertAdminReq } from "@/lib/admin/assertAdminReq";

export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    await assertAdminReq();

    const { searchParams } = new URL(req.url);
    const collection = searchParams.get("collection");
    const doc = searchParams.get("doc");

    if (!collection || !doc) {
      return NextResponse.json(
        { error: "Missing collection or doc parameter" },
        { status: 400 }
      );
    }

    // Fetch document
    const docRef = adminDb.collection(collection).doc(doc);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const data = snapshot.data();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[firestore API] Error:", error);

    // Handle auth errors
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
