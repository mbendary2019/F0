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
exports.hitlResolve = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
function isReviewerOrAdmin(ctx) {
    var _a;
    const t = (((_a = ctx.auth) === null || _a === void 0 ? void 0 : _a.token) || {});
    return !!(t.admin || t.reviewer);
}
exports.hitlResolve = functions.https.onCall(async (payload, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    if (!isReviewerOrAdmin(context))
        throw new functions.https.HttpsError("permission-denied", "Reviewer/Admin only");
    const { reviewId, action, notes } = (payload || {});
    if (!reviewId || !action)
        throw new functions.https.HttpsError("invalid-argument", "reviewId, action required");
    const db = admin.firestore();
    const ref = db.collection("ai_reviews").doc(reviewId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new functions.https.HttpsError("not-found", "Review not found");
    const r = snap.data();
    const caller = context.auth.uid;
    const t = (context.auth.token || {});
    if (!t.admin && r.assignedTo && r.assignedTo !== caller) {
        throw new functions.https.HttpsError("permission-denied", "Only assignee or admin may resolve");
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
//# sourceMappingURL=resolve.js.map