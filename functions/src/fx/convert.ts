import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Fallback rates if fx_rates/latest is not available
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
  // Round to .99 for psychological pricing
  // Examples: 29.00 -> 28.99, 50.00 -> 49.99
  if (amount <= 1) return amount; // Don't round very small amounts

  const rounded = Math.floor(amount);
  return rounded - 0.01;
}

export const convertPrice = onCall(async (request) => {
  const payload = request.data;
  const { baseUsd, currency } = payload || {};

  if (!baseUsd || !currency) {
    throw new HttpsError("invalid-argument", "baseUsd and currency required");
  }

  const targetCurrency = String(currency).toUpperCase();

  // No conversion needed for USD
  if (targetCurrency === "USD") {
    return {
      baseUsd: Number(baseUsd),
      currency: "USD",
      converted: Number(baseUsd),
      rate: 1.0
    };
  }

  const db = admin.firestore();
  let rate = FALLBACK_RATES[targetCurrency] || 1.0;
  let source = "fallback";

  try {
    // Try to get latest rates from Firestore
    const fxSnap = await db.collection("fx_rates").doc("latest").get();
    if (fxSnap.exists) {
      const data = fxSnap.data();
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

  // Apply psychological rounding
  const rounded = psychologicalRounding(converted);

  return {
    baseUsd: Number(baseUsd),
    currency: targetCurrency,
    converted: Math.round(rounded * 100) / 100,
    rate,
    source
  };
});
