// functions/src/quotaWarn.ts
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

export const quotaWarning = onSchedule("every 6 hours", async () => {
  const mk = new Date().toISOString().slice(0, 7);
  for await (const u of iterateUsers(500)) {
    const uid = u.id;
    try {
      const sub = await db.doc(`users/${uid}/subscription`).get();
      const quota =
        (sub.get("limits.monthlyQuota") as number | undefined) ?? 10000;

      const used =
        ((await db.doc(`usage_logs/${uid}/monthly/${mk}`).get()).get("total") as number | undefined) ?? 0;

      if (quota > 0 && used >= quota * 0.8) {
        await db.collection("billing_events").add({
          uid,
          type: "quota_warn",
          meta: { used, quota, percentage: (used / quota) * 100 },
          createdAt: new Date(),
        });
      }
    } catch (err) {
      console.error("[quotaWarning] user:", uid, "error:", err);
    }
  }
});
