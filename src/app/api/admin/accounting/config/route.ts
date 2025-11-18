import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyIdToken } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await verifyIdToken(token);
    if (!decoded.admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const snap = await adminDb.collection("config").doc("accounting_gl").get();
    if (!snap.exists) {
      // Return defaults
      return NextResponse.json({
        revenue: "4000",
        platformFees: "4050",
        creatorPayouts: "5000",
        refunds: "4090",
        cash: "1000",
        ar: "1100",
      });
    }

    return NextResponse.json(snap.data());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await verifyIdToken(token);
    if (!decoded.admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json();
    const { revenue, platformFees, creatorPayouts, refunds, cash, ar } = body;

    // Validate GL accounts are numeric strings
    const accounts = { revenue, platformFees, creatorPayouts, refunds, cash, ar };
    for (const [k, v] of Object.entries(accounts)) {
      if (typeof v !== "string" || !/^\d+$/.test(v)) {
        return NextResponse.json({ error: `Invalid GL account for ${k}` }, { status: 400 });
      }
    }

    await adminDb.collection("config").doc("accounting_gl").set(accounts);

    await adminDb.collection("audit_logs").add({
      ts: Date.now(),
      kind: "accounting_gl_updated",
      actor: decoded.uid,
      meta: accounts,
    });

    return NextResponse.json({ success: true, accounts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
