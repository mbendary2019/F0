import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Simple publisher function - adds event to queue for processing
 * If you have a real publisher from Phase 3, import and use it instead
 */
async function publishEvent(params: { uid: string; type: string; data: any; meta?: any }) {
  const { uid, type, data, meta } = params;

  // Add to delivery queue (simplified - adapt to your Phase 3 implementation)
  await db.collection("webhook_queue").add({
    uid,
    eventType: type,
    payload: data,
    meta: meta || {},
    status: "pending",
    attempts: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/** Callable: send a test webhook event to all active subscriptions for the current user */
export const sendTestWebhook = onCall<{ event?: string; payload?: any }>(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "UNAUTH");

  const eventType = req.data?.event || "test.event";
  const payload = req.data?.payload || { ok: true };

  // Publish test event using the same delivery system
  await publishEvent({
    uid,
    type: eventType,
    data: payload,
    meta: { test: true }
  });

  return { ok: true, queued: true, type: eventType };
});
