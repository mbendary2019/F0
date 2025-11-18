import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

async function requireAdmin(req: NextRequest) {
  const hdr = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!hdr?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const dec = await adminAuth.verifyIdToken(hdr.slice(7));
  if (!dec.admin) throw new Error("Forbidden");
  return dec.uid;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const doc = await adminDb.collection("analytics").doc("funnels_1h").get();
    return NextResponse.json(doc.exists ? doc.data() : { rows: [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
