import { onCall, HttpsError } from "firebase-functions/v2/https";

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  AE: "AED",
  GB: "GBP",
  EU: "EUR",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  CA: "CAD",
  AU: "AUD",
  JP: "JPY",
  IN: "INR",
  SG: "SGD",
  US: "USD",
};

export const guessRegionCurrency = onCall(async (request) => {
  const { country } = request.data || {};

  if (!country) {
    throw new HttpsError("invalid-argument", "country code required");
  }

  const countryCode = String(country).toUpperCase();
  const currency = COUNTRY_CURRENCY_MAP[countryCode] || "USD";

  return {
    country: countryCode,
    currency,
  };
});
