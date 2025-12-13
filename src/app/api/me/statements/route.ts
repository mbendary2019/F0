import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const h = req.headers.get("authorization") || "";
    if (!h.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dec = await verifyIdToken(h.slice(7));
    const uid = dec.uid;

    const snap = await adminDb
      .collection("customer_statements")
      .doc(uid)
      .collection("files")
      .orderBy("month", "desc")
      .limit(24)
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
