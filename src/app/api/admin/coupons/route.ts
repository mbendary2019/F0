import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

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
    const snap = await adminDb
      .collection("coupons")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();
    return NextResponse.json({
      items: snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await requireAdmin(req);
    const body = await req.json();
    const { code, ...data } = body || {};
    if (!code) {
      return NextResponse.json({ error: "code required" }, { status: 400 });
    }
    await adminDb
      .collection("coupons")
      .doc(String(code).toUpperCase())
      .set(
        {
          code: String(code).toUpperCase(),
          active: true,
          createdAt: Date.now(),
          createdBy: uid,
          ...data,
        },
        { merge: true }
      );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
