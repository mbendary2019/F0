import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

const SEARCH_V2_ENABLED = process.env.SEARCH_V2_ENABLED === "true";
const ALG_APP = process.env.ALGOLIA_APP_ID;
const ALG_KEY = process.env.ALGOLIA_SEARCH_KEY;
const ALG_INDEX = process.env.ALGOLIA_INDEX_PRODUCTS || "products_prod";

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim();

    // Algolia Search (if enabled and configured)
    if (SEARCH_V2_ENABLED && ALG_APP && ALG_KEY) {
      const alg = require("algoliasearch")(ALG_APP, ALG_KEY);
      const idx = alg.initIndex(ALG_INDEX);
      const res = await idx.search(q || "", { hitsPerPage: 60 });
      return NextResponse.json({
        items: (res.hits || []).map((h: any) => ({ id: h.id, ...h })),
      });
    }

    // Fallback: Firestore filtering (MVP)
    const snap = await adminDb
      .collection("products")
      .where("active", "==", true)
      .where("published", "==", true)
      .orderBy("createdAt", "desc")
      .limit(120)
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const filtered = q
      ? items.filter(
          (p) =>
            (p.title || "").toLowerCase().includes(q.toLowerCase()) ||
            (p.description || "").toLowerCase().includes(q.toLowerCase())
        )
      : items;

    return NextResponse.json({ items: filtered.slice(0, 60) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
