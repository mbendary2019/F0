import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

/**
 * Daily job to aggregate creator earnings from paid orders
 * Creates/updates analytics_creator documents with last24h metrics
 */
export const creatorEarningsDaily = onSchedule("every 24 hours", async () => {
  const db = admin.firestore();
  const since = Date.now() - 24 * 60 * 60 * 1000;

  // Get all paid orders from last 24 hours
  const q = await db
    .collection("orders")
    .where("status", "==", "paid")
    .where("paidAt", ">", since)
    .get();

  // Aggregate by creator
  const byCreator = new Map<
    string,
    { orders: number; gross: number; platform: number; net: number }
  >();

  for (const d of q.docs) {
    const o = d.data() as any;
    const uid = o.creatorUid || null;
    if (!uid) continue;

    const cur = byCreator.get(uid) || { orders: 0, gross: 0, platform: 0, net: 0 };
    const gross = Number(o.amountUsd || 0);
    const platform = Number(o.platformFeeUsd || 0);
    const net = Number(o.amountToCreatorUsd || gross - platform);

    cur.orders += 1;
    cur.gross += gross;
    cur.platform += platform;
    cur.net += net;

    byCreator.set(uid, cur);
  }

  // Batch update analytics_creator documents
  const batch = db.batch();

  for (const [uid, s] of Array.from(byCreator)) {
    const doc = db.collection("analytics_creator").doc(uid);
    batch.set(
      doc,
      {
        ts: Date.now(),
        last24h: {
          orders: s.orders,
          grossUsd: Math.round(s.gross * 100) / 100,
          platformUsd: Math.round(s.platform * 100) / 100,
          netUsd: Math.round(s.net * 100) / 100,
        },
      },
      { merge: true }
    );
  }

  await batch.commit();
  console.log(`📊 Creator earnings updated for ${byCreator.size} creators`);
});
