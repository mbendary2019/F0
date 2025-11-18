import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";

function isReviewerOrAdmin(request: CallableRequest) {
  const t = (request.auth?.token || {}) as any;
  return !!(t.admin || t.reviewer);
}

export const hitlAssign = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
  if (!isReviewerOrAdmin(request)) throw new HttpsError("permission-denied", "Reviewer/Admin only");

  const payload = request.data;
  const { reviewId, assigneeUid } = (payload || {}) as { reviewId: string; assigneeUid?: string };
  if (!reviewId) throw new HttpsError("invalid-argument", "reviewId required");

  const db = admin.firestore();
  const uid = assigneeUid || request.auth.uid;
  const ref = db.collection("ai_reviews").doc(reviewId);
  await ref.update({
    assignedTo: uid,
    status: "assigned",
    timeline: admin.firestore.FieldValue.arrayUnion({
      ts: Date.now(),
      actor: request.auth.uid,
      event: "assigned",
      diff: { assignedTo: uid },
    }),
  });
  return { ok: true };
});
