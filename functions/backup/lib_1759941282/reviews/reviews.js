"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveReview = exports.submitReview = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const spamGuard_1 = require("./spamGuard");
const REQUIRES_IMG_REVIEW = process.env.REVIEWS_IMG_MOD_REQUIRED === "true";
// Optional: evaluator from Sprint 13
let evaluateToxicity = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ev = require("../aiGovernance/evaluator");
    evaluateToxicity = (txt) => {
        try {
            return Math.min(100, Number(ev.evaluateToxicity(txt) || 0));
        }
        catch (_a) {
            return 0;
        }
    };
}
catch (_a) {
    /* fallback only */
}
// FNV-1a hash to prevent spam/duplicates
function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
}
async function userOwnsProduct(db, uid, productId) {
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
exports.submitReview = functions.https.onCall(async (payload, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    const { productId, rating, text } = payload || {};
    if (!productId || typeof rating !== "number") {
        throw new functions.https.HttpsError("invalid-argument", "productId & rating required");
    }
    const db = admin.firestore();
    if (!(await userOwnsProduct(db, context.auth.uid, productId))) {
        throw new functions.https.HttpsError("permission-denied", "You must own a license to review");
    }
    const cleanText = String(text || "")
        .slice(0, 1500)
        .trim();
    const contentHash = fnv1a(`${productId}:${context.auth.uid}:${cleanText}`);
    // Check for duplicates
    const dupe = await db
        .collection("product_reviews")
        .where("productId", "==", productId)
        .where("uid", "==", context.auth.uid)
        .where("contentHash", "==", contentHash)
        .limit(1)
        .get();
    if (!dupe.empty) {
        throw new functions.https.HttpsError("already-exists", "Duplicate review");
    }
    // Toxicity: combination of quick list + (optional) evaluator from Sprint 13
    const badRe = /(hate|kill|bomb|rape|idiot|stupid|trash|scam|spam|fake)/i;
    const toxHeuristic = badRe.test(cleanText) ? 60 : 0;
    const toxEval = evaluateToxicity ? evaluateToxicity(cleanText) : 0;
    const toxScore = Math.max(toxHeuristic, toxEval);
    // Spam detection
    const spamScore = (0, spamGuard_1.scoreSpam)(cleanText);
    // Determine status based on toxicity, spam, and image moderation requirements
    let status = toxScore >= 50 || spamScore >= 60 ? "pending" : "approved";
    // If image review required, force pending status
    if (REQUIRES_IMG_REVIEW) {
        status = "pending";
    }
    const ref = await db.collection("product_reviews").add({
        productId,
        uid: context.auth.uid,
        rating: Math.max(1, Math.min(5, Math.round(rating))),
        text: cleanText,
        status,
        createdAt: Date.now(),
        approvedAt: status === "approved" ? Date.now() : null,
        contentHash,
    });
    if (status === "approved")
        await updateProductAggregates(db, productId);
    await db.collection("audit_logs").add({
        ts: Date.now(),
        actor: context.auth.uid,
        kind: "review_submit",
        meta: { productId, reviewId: ref.id, status, toxScore, spamScore },
    });
    return { id: ref.id, status };
});
/**
 * Approve or reject a review (admin only)
 */
exports.approveReview = functions.https.onCall(async (payload, context) => {
    var _a;
    const t = (((_a = context.auth) === null || _a === void 0 ? void 0 : _a.token) || {});
    if (!context.auth || !t.admin) {
        throw new functions.https.HttpsError("permission-denied", "Admin only");
    }
    const { reviewId, approve } = payload || {};
    if (!reviewId) {
        throw new functions.https.HttpsError("invalid-argument", "reviewId required");
    }
    const db = admin.firestore();
    const ref = db.collection("product_reviews").doc(reviewId);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Review not found");
    }
    const productId = snap.data().productId;
    await ref.set({
        status: approve ? "approved" : "rejected",
        approvedAt: approve ? Date.now() : null,
    }, { merge: true });
    if (approve && productId)
        await updateProductAggregates(db, productId);
    await db.collection("audit_logs").add({
        ts: Date.now(),
        actor: context.auth.uid,
        kind: "review_moderation",
        meta: { reviewId, productId, approve },
    });
    return { ok: true };
});
/**
 * Helper: Update product rating aggregates with buckets
 */
async function updateProductAggregates(db, productId) {
    const snap = await db
        .collection("product_reviews")
        .where("productId", "==", productId)
        .where("status", "==", "approved")
        .get();
    const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const d of snap.docs) {
        const r = Number(d.data().rating || 0);
        if (buckets[r] != null)
            buckets[r] += 1;
        sum += r;
    }
    const count = snap.size;
    const avg = count ? Math.round((sum / count) * 10) / 10 : 0;
    await db.collection("products").doc(productId).set({
        ratingAvg: avg,
        ratingCount: count,
        ratingBuckets: buckets,
    }, { merge: true });
}
//# sourceMappingURL=reviews.js.map