import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

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

export async function GET(req: NextRequest) {
  // Heuristics: x-vercel-ip-country OR Cloudflare "cf-ipcountry" OR Accept-Language
  const country =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    "";

  const countryCode = country.toUpperCase();
  const currency = COUNTRY_CURRENCY_MAP[countryCode] || "USD";

  return NextResponse.json({ country: countryCode || "UNKNOWN", currency });
}
