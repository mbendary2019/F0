import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebaseAdmin";

async function requireAdmin(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) throw new Error("Unauthorized");
  const dec = await verifyIdToken(h.slice(7));
  if (!dec.admin) throw new Error("Forbidden");
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const snap = await adminDb.collection("config").doc("pricing_regions").get();
    return NextResponse.json(snap.exists ? snap.data() : {});
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: err.message === "Unauthorized" ? 401 : 403 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));

    await adminDb.collection("config").doc("pricing_regions").set(body);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: err.message === "Unauthorized" ? 401 : 403 }
    );
  }
}
