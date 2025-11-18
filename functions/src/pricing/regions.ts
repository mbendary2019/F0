import * as admin from "firebase-admin";

let cache: any = null;
let cacheTs = 0;

export async function loadPricingRegions() {
  if (Date.now() - cacheTs < 60_000 && cache) return cache;
  const snap = await admin.firestore().collection("config").doc("pricing_regions").get();
  cache = (snap.exists ? snap.data() : {}) || {};
  cacheTs = Date.now();
  return cache;
}

function psychologicalRounding(amount: number): number {
  if (amount <= 1) return amount;
  const rounded = Math.floor(amount);
  return rounded - 0.01;
}

export async function resolveRegionPrice(
  product: any,
  currency: string,
  country?: string,
  fxPrice: number = 0
): Promise<number> {
  const cur = currency.toUpperCase();

  // 1) Product currency override (highest priority)
  if (product?.prices?.[cur] != null) {
    return Number(product.prices[cur]);
  }

  // 2) Load region rules
  const rules = await loadPricingRegions();
  const regions = rules.regions || {};
  const defaults = rules.defaults || {};

  // 3) Check region-specific rules
  if (country && regions[country]) {
    const region = regions[country];

    // If region has a fixed price for this product tier/ID
    if (region.fixed && product.tier && region.fixed[product.tier]) {
      return Number(region.fixed[product.tier]);
    }
    if (region.fixed && product.id && region.fixed[product.id]) {
      return Number(region.fixed[product.id]);
    }

    // If region has currency-specific multiplier
    if (region.currency === cur && region.multiplier) {
      const baseUsd = Number(product.priceUsd || 0);
      let price = baseUsd * region.multiplier;
      if (region.round === "psychological") {
        price = psychologicalRounding(price);
      }
      return Math.round(price * 100) / 100;
    }
  }

  // 4) Check currency defaults
  if (defaults[cur] && defaults[cur].multiplier) {
    const baseUsd = Number(product.priceUsd || 0);
    let price = baseUsd * defaults[cur].multiplier;
    if (defaults[cur].round === "psychological") {
      price = psychologicalRounding(price);
    }
    return Math.round(price * 100) / 100;
  }

  // 5) Fallback to FX price
  return fxPrice || Number(product.priceUsd || 0);
}
