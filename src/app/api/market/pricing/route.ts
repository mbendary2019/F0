import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const FALLBACK_RATES: Record<string, number> = {
  EUR: 0.92,
  GBP: 0.78,
  AED: 3.67,
  CAD: 1.35,
  AUD: 1.52,
  JPY: 149.50,
  INR: 83.20,
  SGD: 1.34
};

function psychologicalRounding(amount: number): number {
  if (amount <= 1) return amount;
  const rounded = Math.floor(amount);
  return rounded - 0.01;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { baseUsd, currency } = body;

    if (!baseUsd || !currency) {
      return NextResponse.json({ error: "baseUsd and currency required" }, { status: 400 });
    }

    const targetCurrency = String(currency).toUpperCase();

    // No conversion needed for USD
    if (targetCurrency === "USD") {
      return NextResponse.json({
        baseUsd: Number(baseUsd),
        currency: "USD",
        converted: Number(baseUsd),
        rate: 1.0,
        source: "none"
      });
    }

    // Get FX rate
    let rate = FALLBACK_RATES[targetCurrency] || 1.0;
    let source = "fallback";

    try {
      const snap = await adminDb.collection("fx_rates").doc("latest").get();
      if (snap.exists) {
        const data = snap.data();
        const rates = data?.rates || {};
        if (rates[targetCurrency]) {
          rate = rates[targetCurrency];
          source = "live";
        }
      }
    } catch (err) {
      console.warn("Could not fetch FX rates, using fallback:", err);
    }

    // Convert
    const converted = Number(baseUsd) * rate;
    const rounded = psychologicalRounding(converted);

    return NextResponse.json({
      baseUsd: Number(baseUsd),
      currency: targetCurrency,
      converted: Math.round(rounded * 100) / 100,
      rate,
      source
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
