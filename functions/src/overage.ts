// functions/src/overage.ts
import Stripe from "stripe";
import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getConfig } from "./config";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function* iterateUsers(batchSize = 500) {
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined = undefined;
  while (true) {
    let q = db.collection("users").orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) yield doc;
    if (snap.size < batchSize) break;
    last = snap.docs[snap.docs.length - 1];
  }
}

/** Push usage deltas to Stripe once per hour */
export const pushUsageToStripe = onSchedule("every 60 minutes", async () => {
  const cfg = getConfig();
  const stripe = new Stripe(cfg.STRIPE_SECRET_KEY);

  for await (const u of iterateUsers()) {
    const uid = u.id;

    try {
      const subSnap = await db.doc(`users/${uid}/subscription`).get();
      const ent = subSnap.data();
      if (!ent || ent.status !== "active" || !ent.limits?.overage?.enabled) continue;

      const mk = new Date().toISOString().slice(0, 7); // YYYY-MM
      const mdoc = await db.doc(`usage_logs/${uid}/monthly/${mk}`).get();
      const total = (mdoc.get("total") as number) || 0;
      const reported = (mdoc.get("stripeReported")?.totalUnits as number) || 0;
      const delta = total - reported;
      if (delta <= 0) continue;

      const subItemId = ent.stripe?.overagePriceItemId as string | undefined;
      if (!subItemId) continue; // لا يوجد عنصر اشتراك متري

      await (stripe.subscriptionItems as any).createUsageRecord(subItemId, {
        quantity: delta,
        timestamp: Math.floor(Date.now() / 1000),
        action: "increment",
      });

      await db.doc(`usage_logs/${uid}/monthly/${mk}`).set(
        {
          stripeReported: {
            totalUnits: total,
            at: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

      await db.collection("billing_events").add({
        uid,
        type: "overage_record",
        meta: { delta, total, subItemId },
        createdAt: new Date(),
      });
    } catch (err: any) {
      // لا توقف بقية المستخدمين
      console.error("[pushUsageToStripe] user:", uid, "error:", err?.message || err);
      await db.collection("billing_events").add({
        uid,
        type: "overage_error",
        meta: { message: String(err?.message || err) },
        createdAt: new Date(),
      });
    }
  }
});
