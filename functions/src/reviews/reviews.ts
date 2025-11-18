import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { scoreSpam } from "./spamGuard";

const REQUIRES_IMG_REVIEW = process.env.REVIEWS_IMG_MOD_REQUIRED === "true";

// Optional: evaluator from Sprint 13
let evaluateToxicity: ((t: string) => number) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ev = require("../aiGovernance/evaluator");
  evaluateToxicity = (txt: string) => {
    try {
      return Math.min(100, Number(ev.evaluateToxicity(txt) || 0));
    } catch {
      return 0;
    }
  };
} catch {
  /* fallback only */
}

// FNV-1a hash to prevent spam/duplicates
function fnv1a(str: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}

async function userOwnsProduct(
  db: FirebaseFirestore.Firestore,
  uid: string,
  productId: string
) {
  const lic = await db
    .collection("licenses")
    .where("uid", "==", uid)
    .where("productId", "==", productId)
    .limit(1)
    .get();
  return !lic.empty;
}

/**
 * Submit a product review with enhanced moderation
 * Requires: user must have a license for the product
 * Auto-moderation: toxicity detection + duplicate prevention
 */
export const submitReview = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

  const { productId, rating, text } = request.data || {};
  if (!productId || typeof rating !== "number") {
    throw new HttpsError("invalid-argument", "productId & rating required");
  }

  const db = admin.firestore();
  if (!(await userOwnsProduct(db, request.auth.uid, productId))) {
    throw new HttpsError(
      "permission-denied",
      "You must own a license to review"
    );
  }

  const cleanText = String(text || "")
    .slice(0, 1500)
    .trim();
  const contentHash = fnv1a(`${productId}:${request.auth.uid}:${cleanText}`);

  // Check for duplicates
  const dupe = await db
    .collection("product_reviews")
    .where("productId", "==", productId)
    .where("uid", "==", request.auth.uid)
    .where("contentHash", "==", contentHash)
    .limit(1)
    .get();
  if (!dupe.empty) {
    throw new HttpsError("already-exists", "Duplicate review");
  }

  // Toxicity: combination of quick list + (optional) evaluator from Sprint 13
  const badRe = /(hate|kill|bomb|rape|idiot|stupid|trash|scam|spam|fake)/i;
  const toxHeuristic = badRe.test(cleanText) ? 60 : 0;
  const toxEval = evaluateToxicity ? evaluateToxicity(cleanText) : 0;
  const toxScore = Math.max(toxHeuristic, toxEval);

  // Spam detection
  const spamScore = scoreSpam(cleanText);

  // Determine status based on toxicity, spam, and image moderation requirements
  let status: "pending" | "approved" =
    toxScore >= 50 || spamScore >= 60 ? "pending" : "approved";

  // If image review required, force pending status
  if (REQUIRES_IMG_REVIEW) {
    status = "pending";
  }

  const ref = await db.collection("product_reviews").add({
    productId,
    uid: request.auth.uid,
    rating: Math.max(1, Math.min(5, Math.round(rating))),
    text: cleanText,
    status,
    createdAt: Date.now(),
    approvedAt: status === "approved" ? Date.now() : null,
    contentHash,
  });

  if (status === "approved") await updateProductAggregates(db, productId);

  await db.collection("audit_logs").add({
    ts: Date.now(),
    actor: request.auth.uid,
    kind: "review_submit",
    meta: { productId, reviewId: ref.id, status, toxScore, spamScore },
  });

  return { id: ref.id, status };
});

/**
 * Approve or reject a review (admin only)
 */
export const approveReview = onCall(async (request) => {
  const t = (request.auth?.token || {}) as any;
  if (!request.auth || !t.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  const { reviewId, approve } = request.data || {};
  if (!reviewId) {
    throw new HttpsError("invalid-argument", "reviewId required");
  }

  const db = admin.firestore();
  const ref = db.collection("product_reviews").doc(reviewId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Review not found");
  }

  const productId = (snap.data() as any).productId;

  await ref.set(
    {
      status: approve ? "approved" : "rejected",
      approvedAt: approve ? Date.now() : null,
    },
    { merge: true }
  );

  if (approve && productId) await updateProductAggregates(db, productId);

  await db.collection("audit_logs").add({
    ts: Date.now(),
    actor: request.auth.uid,
    kind: "review_moderation",
    meta: { reviewId, productId, approve },
  });

  return { ok: true };
});

/**
 * Helper: Update product rating aggregates with buckets
 */
async function updateProductAggregates(db: FirebaseFirestore.Firestore, productId: string) {
  const snap = await db
    .collection("product_reviews")
    .where("productId", "==", productId)
    .where("status", "==", "approved")
    .get();

  const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
  let sum = 0;

  for (const d of snap.docs) {
    const r = Number((d.data() as any).rating || 0);
    if (buckets[r] != null) buckets[r] += 1;
    sum += r;
  }

  const count = snap.size;
  const avg = count ? Math.round((sum / count) * 10) / 10 : 0;

  await db.collection("products").doc(productId).set(
    {
      ratingAvg: avg,
      ratingCount: count,
      ratingBuckets: buckets,
    },
    { merge: true }
  );
}
