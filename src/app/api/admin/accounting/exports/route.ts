import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyIdToken } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await verifyIdToken(token);
    if (!decoded.admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const snap = await adminDb
      .collection("platform_accounting")
      .doc("files")
      .collection("months")
      .orderBy("month", "desc")
      .limit(12)
      .get();

    const exports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ exports });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
