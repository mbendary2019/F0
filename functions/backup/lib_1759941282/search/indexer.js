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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.reindexProducts = exports.onProductWrite = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const ALG_APP = process.env.ALGOLIA_APP_ID || ((_a = functions.config().algolia) === null || _a === void 0 ? void 0 : _a.app_id);
const ALG_KEY = process.env.ALGOLIA_ADMIN_KEY || ((_b = functions.config().algolia) === null || _b === void 0 ? void 0 : _b.admin_key);
const ALG_INDEX = process.env.ALGOLIA_INDEX_PRODUCTS ||
    ((_c = functions.config().algolia) === null || _c === void 0 ? void 0 : _c.index) ||
    "products_prod";
let algolia = null;
function getAlg() {
    if (!ALG_APP || !ALG_KEY)
        return null;
    if (!algolia)
        algolia = require("algoliasearch")(ALG_APP, ALG_KEY);
    return algolia;
}
/**
 * Auto-index products to Algolia on write
 */
exports.onProductWrite = functions.firestore
    .document("products/{id}")
    .onWrite(async (change, ctx) => {
    const alg = getAlg();
    if (!alg)
        return; // disabled, no-op
    const idx = alg.initIndex(ALG_INDEX);
    if (!change.after.exists) {
        // delete
        await idx.deleteObject(ctx.params.id);
        return;
    }
    const d = change.after.data();
    if (!(d.active && d.published)) {
        await idx.deleteObject(ctx.params.id);
        return;
    }
    await idx.saveObject({
        objectID: ctx.params.id,
        id: ctx.params.id,
        title: d.title || "",
        description: d.description || "",
        priceUsd: d.priceUsd || 0,
        ratingAvg: d.ratingAvg || 0,
        ratingCount: d.ratingCount || 0,
        slug: d.slug || "",
    });
});
/**
 * Admin function to reindex all products
 */
exports.reindexProducts = functions.https.onCall(async (_payload, ctx) => {
    var _a;
    const t = (((_a = ctx.auth) === null || _a === void 0 ? void 0 : _a.token) || {});
    if (!ctx.auth || !t.admin) {
        throw new functions.https.HttpsError("permission-denied", "Admin only");
    }
    const alg = getAlg();
    if (!alg) {
        throw new functions.https.HttpsError("failed-precondition", "Algolia not configured");
    }
    const idx = alg.initIndex(ALG_INDEX);
    const db = admin.firestore();
    const snap = await db
        .collection("products")
        .where("active", "==", true)
        .where("published", "==", true)
        .limit(5000)
        .get();
    const batch = snap.docs.map((d) => (Object.assign({ objectID: d.id, id: d.id }, d.data())));
    await idx.saveObjects(batch);
    return { indexed: batch.length };
});
//# sourceMappingURL=indexer.js.map