import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

async function requireUser(req: Request) {
  const hdr = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!hdr?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const dec = await getAuth().verifyIdToken(hdr.slice(7));
  return dec.uid;
}

/**
 * Get creator earnings summary and recent orders
 * Only accessible by the creator themselves
 */
export async function GET(req: Request) {
  try {
    const uid = await requireUser(req);
    const db = getFirestore();

    // Get summary (last24h aggregated metrics)
    const sDoc = await db.collection("analytics_creator").doc(uid).get();
    const summary = sDoc.exists
      ? sDoc.data()
      : {
          last24h: {
            orders: 0,
            grossUsd: 0,
            platformUsd: 0,
            netUsd: 0,
          },
        };

    // Get recent orders for this creator
    const os = await db
      .collection("orders")
      .where("creatorUid", "==", uid)
      .orderBy("paidAt", "desc")
      .limit(100)
      .get();

    const items = os.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return NextResponse.json({ summary, items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
