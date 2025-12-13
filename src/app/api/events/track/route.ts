import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { kind, productId, sessionId, utm, extra } = body || {};

    if (!["view_product", "start_checkout"].includes(kind)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await adminDb.collection("events").add({
      kind,
      productId: productId || null,
      sessionId: sessionId || null, // client-generated (uuid)
      utm: utm || null, // {source,medium,campaign}
      extra: extra || null,
      ua: req.headers.get("user-agent") || null,
      ts: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
