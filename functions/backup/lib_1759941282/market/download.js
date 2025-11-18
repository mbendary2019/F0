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
exports.generateDownloadUrl = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
exports.generateDownloadUrl = functions.https.onCall(async (payload, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    const { productId } = payload || {};
    if (!productId)
        throw new functions.https.HttpsError("invalid-argument", "productId required");
    const db = admin.firestore();
    // Verify license ownership
    const licSnap = await db.collection("licenses")
        .where("uid", "==", context.auth.uid)
        .where("productId", "==", productId)
        .limit(1)
        .get();
    if (licSnap.empty)
        throw new functions.https.HttpsError("permission-denied", "No license");
    // Resolve product assetPath
    const prod = await db.collection("products").doc(productId).get();
    if (!prod.exists)
        throw new functions.https.HttpsError("not-found", "Product not found");
    const p = prod.data();
    const path = p.assetPath;
    if (!path)
        throw new functions.https.HttpsError("failed-precondition", "Product asset missing");
    // Signed URL (e.g., 60 minutes)
    const bucket = admin.storage().bucket();
    const file = bucket.file(path);
    const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 60 * 60 * 1000
    });
    // Update license usage
    await licSnap.docs[0].ref.set({ lastDownloadAt: Date.now(), downloadCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
    return { url };
});
//# sourceMappingURL=download.js.map