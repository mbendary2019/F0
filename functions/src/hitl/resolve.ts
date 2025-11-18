import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";

function isReviewerOrAdmin(request: CallableRequest) {
  const t = (request.auth?.token || {}) as any;
  return !!(t.admin || t.reviewer);
}

export const hitlResolve = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
  if (!isReviewerOrAdmin(request)) throw new HttpsError("permission-denied", "Reviewer/Admin only");

  const payload = request.data;
  const { reviewId, action, notes } = (payload || {}) as {
    reviewId: string;
    action: "approve" | "reject";
    notes?: string;
  };
  if (!reviewId || !action) throw new HttpsError("invalid-argument", "reviewId, action required");

  const db = admin.firestore();
  const ref = db.collection("ai_reviews").doc(reviewId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Review not found");
  const r = snap.data() as any;

  const caller = request.auth.uid;
  const t = (request.auth.token || {}) as any;
  if (!t.admin && r.assignedTo && r.assignedTo !== caller) {
    throw new HttpsError("permission-denied", "Only assignee or admin may resolve");
  }

  await ref.update({
    status: "resolved",
    outcome: { action, notes: notes || null, resolvedAt: Date.now(), resolvedBy: caller },
    timeline: admin.firestore.FieldValue.arrayUnion({
      ts: Date.now(),
      actor: caller,
      event: "resolved",
      diff: { action, notes: !!notes },
    }),
  });

  return { ok: true };
});
