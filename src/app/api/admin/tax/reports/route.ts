import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) throw new Error("Unauthorized");
  const dec = await verifyIdToken(h.slice(7));
  if (!dec.admin) throw new Error("Forbidden");
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const start = Number(body.start || 0);
    const end = Number(body.end || 0);

    if (!start || !end) {
      return NextResponse.json({ error: "start/end required" }, { status: 400 });
    }

    // Client will call the exportTaxReport callable function directly
    // This endpoint is just for validation
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: err.message === "Unauthorized" ? 401 : 403 }
    );
  }
}
