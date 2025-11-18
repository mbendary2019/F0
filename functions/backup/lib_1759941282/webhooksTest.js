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
exports.sendTestWebhook = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
/**
 * Simple publisher function - adds event to queue for processing
 * If you have a real publisher from Phase 3, import and use it instead
 */
async function publishEvent(params) {
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
exports.sendTestWebhook = (0, https_1.onCall)(async (req) => {
    var _a, _b, _c;
    const uid = (_a = req.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "UNAUTH");
    const eventType = ((_b = req.data) === null || _b === void 0 ? void 0 : _b.event) || "test.event";
    const payload = ((_c = req.data) === null || _c === void 0 ? void 0 : _c.payload) || { ok: true };
    // Publish test event using the same delivery system
    await publishEvent({
        uid,
        type: eventType,
        data: payload,
        meta: { test: true }
    });
    return { ok: true, queued: true, type: eventType };
});
//# sourceMappingURL=webhooksTest.js.map