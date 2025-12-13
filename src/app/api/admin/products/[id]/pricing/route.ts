import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) throw new Error("Unauthorized");
  const dec = await verifyIdToken(h.slice(7));
  if (!dec.admin) throw new Error("Forbidden");
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(req);
    const snap = await adminDb.collection("products").doc(params.id).get();
    const d = snap.exists ? snap.data() : {};
    return NextResponse.json({ prices: (d as any)?.prices || {} });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === "Unauthorized" ? 401 : 403 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    // body: { prices: { USD: number, EUR: number, ... } }
    await adminDb
      .collection("products")
      .doc(params.id)
      .set({ prices: body.prices || {} }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === "Unauthorized" ? 401 : 403 });
  }
}
