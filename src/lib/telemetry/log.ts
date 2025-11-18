import { adminDb } from "@/lib/firebaseAdmin";
import type { OpsEvent } from "@/lib/types/telemetry";

/**
 * Log telemetry event to Firestore
 * Swallows errors to avoid breaking user flow
 */
export async function logEvent(event: OpsEvent): Promise<void> {
  try {
    await adminDb.collection("ops_events").add({
      ...event,
      timestamp: new Date(),
    });
    console.log(`[telemetry] logged event: ${event.type}`);
  } catch (err) {
    // Swallow errors in telemetry to avoid breaking user flow
    console.error("[telemetry] error logging event:", err);
  }
}

/**
 * Log multiple events in batch
 */
export async function logEvents(events: OpsEvent[]): Promise<void> {
  const batch = adminDb.batch();

  try {
    events.forEach((event) => {
      const ref = adminDb.collection("ops_events").doc();
      batch.set(ref, {
        ...event,
        timestamp: new Date(),
      });
    });

    await batch.commit();
    console.log(`[telemetry] logged ${events.length} events in batch`);
  } catch (err) {
    console.error("[telemetry] error logging batch events:", err);
  }
}

/**
 * Query recent events for a session
 */
export async function getSessionEvents(sessionId: string): Promise<OpsEvent[]> {
  try {
    const snap = await adminDb
      .collection("ops_events")
      .where("sessionId", "==", sessionId)
      .orderBy("ts", "desc")
      .limit(100)
      .get();

    return snap.docs.map((doc) => doc.data() as OpsEvent);
  } catch (err) {
    console.error("[telemetry] error fetching session events:", err);
    return [];
  }
}

/**
 * Query events by user and type
 */
export async function getUserEvents(
  userId: string,
  type?: OpsEvent["type"],
  limit = 50
): Promise<OpsEvent[]> {
  try {
    let query = adminDb.collection("ops_events").where("userId", "==", userId);

    if (type) {
      query = query.where("type", "==", type);
    }

    const snap = await query.orderBy("ts", "desc").limit(limit).get();

    return snap.docs.map((doc) => doc.data() as OpsEvent);
  } catch (err) {
    console.error("[telemetry] error fetching user events:", err);
    return [];
  }
}
