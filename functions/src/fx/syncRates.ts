import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const syncFxRates = onSchedule("every 1 hours", async () => {
  const db = admin.firestore();

  try {
    // Fetch exchange rates from Stripe
    // Note: Stripe provides exchange rates via their API
    // For this implementation, we'll fetch rates for common currencies
    const currencies = ["EUR", "GBP", "AED", "CAD", "AUD", "JPY", "INR", "SGD"];
    const rates: Record<string, number> = {};

    // Stripe doesn't have a direct exchange rates API, so we use a fallback
    // In production, you'd use Stripe's actual rates or a dedicated FX service
    // For now, we'll set default rates (these should be updated with real data)
    const defaultRates: Record<string, number> = {
      EUR: 0.92,
      GBP: 0.78,
      AED: 3.67,
      CAD: 1.35,
      AUD: 1.52,
      JPY: 149.50,
      INR: 83.20,
      SGD: 1.34
    };

    // In a real implementation, you would fetch from Stripe or another FX service
    // For example, using an external API like exchangerate-api.com or openexchangerates.org
    for (const currency of currencies) {
      rates[currency] = defaultRates[currency] || 1.0;
    }

    // Store in Firestore
    await db.collection("fx_rates").doc("latest").set({
      base: "USD",
      ts: Date.now(),
      rates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[syncFxRates] Updated rates for ${Object.keys(rates).length} currencies`);
  } catch (err: any) {
    console.error("[syncFxRates] Error:", err);
    throw err;
  }
});
