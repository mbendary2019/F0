import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

async function requireAdmin(req: NextRequest) {
  const hdr = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!hdr?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const dec = await adminAuth.verifyIdToken(hdr.slice(7));
  if (!dec.admin) throw new Error("Forbidden");
  return dec.uid;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    await requireAdmin(req);
    await adminDb
      .collection("coupons")
      .doc(String(params.code).toUpperCase())
      .delete();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
