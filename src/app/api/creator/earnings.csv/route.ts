import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = 'force-dynamic';

/**
 * Export creator earnings as CSV
 * Only accessible by the creator themselves
 */
export async function GET(req: Request) {
  try {
    const hdr = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!hdr?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const dec = await getAuth().verifyIdToken(hdr.slice(7));
    const uid = dec.uid;

    const db = getFirestore();

    // Get all orders for this creator
    const os = await db
      .collection("orders")
      .where("creatorUid", "==", uid)
      .orderBy("paidAt", "desc")
      .limit(1000)
      .get();

    // Build CSV
    const rows = [
      [
        "orderId",
        "paidAt",
        "amountUsd",
        "platformFeeUsd",
        "amountToCreatorUsd",
        "couponCode",
        "status",
      ],
    ];

    for (const d of os.docs) {
      const o = d.data() as any;
      rows.push([
        d.id,
        o.paidAt || "",
        o.amountUsd || 0,
        o.platformFeeUsd || 0,
        o.amountToCreatorUsd ||
          Number(o.amountUsd || 0) - Number(o.platformFeeUsd || 0),
        (o.couponCode || "").toString(),
        o.status || "",
      ].map(String));
    }

    const csv = rows.map((r) => r.join(",")).join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="creator-earnings.csv"',
      },
    });
  } catch (err: any) {
    return new Response("Unauthorized", { status: 401 });
  }
}
