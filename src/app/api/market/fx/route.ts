import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  try {
    const snap = await adminDb.collection("fx_rates").doc("latest").get();

    if (!snap.exists) {
      return NextResponse.json({
        base: "USD",
        rates: {
          EUR: 0.92,
          GBP: 0.78,
          AED: 3.67,
          CAD: 1.35,
          AUD: 1.52,
          JPY: 149.50,
          INR: 83.20,
          SGD: 1.34
        },
        ts: Date.now(),
        source: "fallback"
      });
    }

    const data = snap.data();
    return NextResponse.json({
      base: data?.base || "USD",
      rates: data?.rates || {},
      ts: data?.ts || Date.now(),
      source: "live"
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
