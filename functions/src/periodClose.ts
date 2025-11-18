// functions/src/periodClose.ts
import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

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

/** Run at 00:00 on the 1st day of each month (UTC) */
export const closeBillingPeriod = onSchedule("0 0 1 * *", async () => {
  for await (const u of iterateUsers(500)) {
    const uid = u.id;
    try {
      await db.collection("billing_events").add({
        uid,
        type: "period_close",
        createdAt: new Date(),
      });

      // (اختياري) لو تستخدم متغير monthUsed سريع:
      // await db.doc(`usage_logs/${uid}/daily/__meta`).set(
      //   { monthUsed: 0, resetAt: admin.firestore.FieldValue.serverTimestamp() },
      //   { merge: true }
      // );
    } catch (err) {
      console.error("[closeBillingPeriod] user:", uid, "error:", err);
    }
  }
});
