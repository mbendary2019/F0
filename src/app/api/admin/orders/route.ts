import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

async function requireAdmin(req: Request) {
  const hdr = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!hdr?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const dec = await getAuth().verifyIdToken(hdr.slice(7));
  if (!(dec as any).admin) {
    throw new Error("Forbidden");
  }
  return dec.uid;
}

/**
 * Admin endpoint to list orders filtered by status
 * Supports: ?status=paid|refunded
 */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "paid").toLowerCase();

    const db = getFirestore();
    let q: FirebaseFirestore.Query = db.collection("orders");

    if (status) {
      q = q.where("status", "==", status);
    }

    q = q.orderBy("paidAt", "desc").limit(200);

    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return NextResponse.json({ items });
  } catch (err: any) {
    const status = err.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: err.message }, { status });
  }
}
