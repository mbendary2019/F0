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
exports.onReviewStatusChange = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Trigger when review status changes
 * Copies images from private to public storage when approved
 */
exports.onReviewStatusChange = functions.firestore
    .document("product_reviews/{reviewId}")
    .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    if (!after)
        return;
    const becameApproved = after.status === "approved" && (before === null || before === void 0 ? void 0 : before.status) !== "approved";
    if (!becameApproved)
        return;
    const uid = after.uid;
    const reviewId = context.params.reviewId;
    const bucket = admin.storage().bucket();
    // Copy any images from private path to public path
    const [files] = await bucket.getFiles({ prefix: `review_media/${uid}/${reviewId}/` });
    if (!files.length) {
        await change.after.ref.set({ mediaUrls: [] }, { merge: true });
        return;
    }
    const publicUrls = [];
    for (const f of files) {
        const name = f.name.split("/").pop();
        const dest = bucket.file(`review_media_public/${reviewId}/${name}`);
        await f.copy(dest);
        // Generate public URL (our rules allow read: true)
        const encoded = encodeURIComponent(dest.name);
        const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media`;
        publicUrls.push(url);
    }
    await change.after.ref.set({ mediaUrls: publicUrls }, { merge: true });
});
//# sourceMappingURL=media.js.map