import * as admin from "firebase-admin";
import { resolveRegionPrice } from "../pricing/regions";

export async function bundlePriceForCurrency(
  bundle: any,
  currency: string,
  country?: string,
  fxRates?: any
): Promise<number> {
  // Check for bundle-level currency override first
  if (bundle?.prices?.[currency.toUpperCase()] != null) {
    return Number(bundle.prices[currency.toUpperCase()]);
  }

  // Calculate sum of product prices
  const db = admin.firestore();
  const productIds = bundle.productIds || [];

  if (!productIds.length) return 0;

  let total = 0;
  for (const pid of productIds) {
    const prodSnap = await db.collection("products").doc(pid).get();
    if (!prodSnap.exists) continue;

    const product = prodSnap.data() as any;

    // Calculate FX price if needed
    let fxPrice = Number(product.priceUsd || 0);
    if (currency.toUpperCase() !== "USD" && fxRates?.rates) {
      const rate = fxRates.rates[currency.toUpperCase()] || 1;
      fxPrice = fxPrice * rate;
    }

    // Resolve price using region rules
    const price = await resolveRegionPrice(product, currency, country, fxPrice);
    total += price;
  }

  // Apply bundle discount
  const discount = Number(bundle.discountPercent || 0);
  const finalPrice = total * (1 - discount / 100);

  return Math.round(finalPrice * 100) / 100;
}

export async function issueBundleLicenses(order: any, bundle: any) {
  const db = admin.firestore();
  const batch = db.batch();

  const productIds = bundle.productIds || [];

  for (const pid of productIds) {
    const licRef = db.collection("licenses").doc();
    batch.set(licRef, {
      uid: order.uid,
      productId: pid,
      orderId: order.id,
      bundleId: bundle.id || order.bundleId,
      createdAt: Date.now(),
      revoked: false,
    });
  }

  await batch.commit();
  console.log(`Issued ${productIds.length} licenses for bundle order ${order.id}`);
}
