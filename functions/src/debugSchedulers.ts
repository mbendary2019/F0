// functions/src/debugSchedulers.ts
import * as admin from "firebase-admin";
import { onCall } from "firebase-functions/v2/https";
import Stripe from "stripe";
import { getConfig } from "./config";
import { assertAdminReq } from "./_auth";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function monthKey(d = new Date()) { return d.toISOString().slice(0,7); }

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

// ===== ROLLUP: daily -> monthly =====
export const debugRollup = onCall(async (req) => {
  assertAdminReq(req);
  const since = Date.now();
  const counters = { users: 0, total: 0, cost: 0 };
  const mk = monthKey();

  for await (const u of iterateUsers()) {
    counters.users++;
    const uid = u.id;
    const dcol = db.collection(`usage_logs/${uid}/daily`);
    const q = await dcol.where("lastUpdated", ">=", new Date(Date.now() - 31*24*60*60*1000)).get();

    let total = 0; let cost = 0; const byEndpoint: Record<string, number> = {};
    q.forEach(d => {
      const data: any = d.data();
      total += data.total || 0; cost += data.cost || 0;
      Object.keys(data).forEach(k => {
        if (k.includes("_/v1") || k.startsWith("GET_") || k.startsWith("POST_")) {
          byEndpoint[k] = (byEndpoint[k] || 0) + (data[k] || 0);
        }
      });
    });
    counters.total += total; counters.cost += cost;

    await db.doc(`usage_logs/${uid}/monthly/${mk}`).set({
      total, byEndpoint, cost, lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  await db.doc("admin/scheduler_status").set({
    rollup: { ok: true, at: admin.firestore.FieldValue.serverTimestamp(), tookMs: Date.now()-since, counters }
  }, { merge: true });

  return { ok: true, counters };
});

// ===== PUSH USAGE: Stripe usage records =====
export const debugPushUsage = onCall(async (req) => {
  assertAdminReq(req);
  const since = Date.now();
  const cfg = getConfig();
  const stripe = new Stripe(cfg.STRIPE_SECRET_KEY);
  const mk = monthKey();
  let pushed = 0;

  for await (const u of iterateUsers()) {
    const uid = u.id;
    const subSnap = await db.doc(`users/${uid}/subscription`).get();
    const ent: any = subSnap.data();
    if (!ent || ent.status !== "active" || !ent.limits?.overage?.enabled) continue;

    const mdoc = await db.doc(`usage_logs/${uid}/monthly/${mk}`).get();
    const total = (mdoc.get("total") as number) || 0;
    const reported = (mdoc.get("stripeReported")?.totalUnits as number) || 0;
    const delta = total - reported;
    if (delta <= 0) continue;

    const subItemId = ent?.stripe?.overagePriceItemId as string | undefined;
    if (!subItemId) continue;

    await (stripe.subscriptionItems as any).createUsageRecord(subItemId, {
      quantity: delta, timestamp: Math.floor(Date.now()/1000), action: "increment"
    });

    await db.doc(`usage_logs/${uid}/monthly/${mk}`).set({
      stripeReported: { totalUnits: total, at: admin.firestore.FieldValue.serverTimestamp() }
    }, { merge: true });

    pushed += delta;
  }

  await db.doc("admin/scheduler_status").set({
    pushUsage: { ok: true, at: admin.firestore.FieldValue.serverTimestamp(), tookMs: Date.now()-since, pushed }
  }, { merge: true });

  return { ok: true, pushed };
});

// ===== QUOTA WARN =====
export const debugQuotaWarn = onCall(async (req) => {
  assertAdminReq(req);
  const since = Date.now();
  const mk = monthKey();
  let warned = 0;

  for await (const u of iterateUsers()) {
    const uid = u.id;
    const sub = await db.doc(`users/${uid}/subscription`).get();
    const quota = (sub.get("limits.monthlyQuota") as number | undefined) ?? 10000;
    const used = ((await db.doc(`usage_logs/${uid}/monthly/${mk}`).get()).get("total") as number | undefined) ?? 0;

    if (quota > 0 && used >= quota * 0.8) {
      warned++;
      await db.collection("billing_events").add({
        uid, type: "quota_warn",
        meta: { used, quota, percentage: (used/quota)*100 },
        createdAt: new Date()
      });
    }
  }

  await db.doc("admin/scheduler_status").set({
    quotaWarn: { ok: true, at: admin.firestore.FieldValue.serverTimestamp(), tookMs: Date.now()-since, warned }
  }, { merge: true });

  return { ok: true, warned };
});

// ===== CLOSE PERIOD =====
export const debugClosePeriod = onCall(async (req) => {
  assertAdminReq(req);
  const since = Date.now();
  let closed = 0;

  for await (const u of iterateUsers()) {
    const uid = u.id;
    await db.collection("billing_events").add({ uid, type: "period_close", createdAt: new Date() });
    closed++;
  }

  await db.doc("admin/scheduler_status").set({
    closePeriod: { ok: true, at: admin.firestore.FieldValue.serverTimestamp(), tookMs: Date.now()-since, closed }
  }, { merge: true });

  return { ok: true, closed };
});

// ===== STATUS =====
export const debugStatus = onCall(async (req) => {
  assertAdminReq(req);
  const snap = await db.doc("admin/scheduler_status").get();
  return snap.exists ? snap.data() : {};
});
