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
exports.enforceGate = enforceGate;
exports.trackUsage = trackUsage;
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
async function enforceGate(uid) {
    var _a, _b, _c, _d;
    // Get user subscription
    const subSnap = await db.doc(`users/${uid}/subscription`).get();
    const sub = subSnap.exists
        ? subSnap.data()
        : {
            plan: 'free',
            limits: {
                ratePerMin: 60,
                monthlyQuota: 10000,
                overage: { enabled: false }
            },
            status: 'active'
        };
    // Check if subscription is active
    if (sub.status !== 'active') {
        return {
            decision: { allow: false, hard: true, reason: 'subscription_inactive' },
            subscription: sub
        };
    }
    // Get monthly usage
    const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthlyDoc = await db.doc(`usage_logs/${uid}/monthly/${monthKey}`).get();
    const used = monthlyDoc.get('total') || 0;
    const quota = (_b = (_a = sub.limits) === null || _a === void 0 ? void 0 : _a.monthlyQuota) !== null && _b !== void 0 ? _b : 10000;
    // Check quota
    if (used >= quota) {
        if ((_d = (_c = sub.limits) === null || _c === void 0 ? void 0 : _c.overage) === null || _d === void 0 ? void 0 : _d.enabled) {
            // Allow with overage billing
            return {
                decision: { allow: true, reason: 'overage', remainingQuota: 0 },
                subscription: sub
            };
        }
        else {
            // Hard block
            return {
                decision: { allow: false, hard: true, reason: 'quota_exceeded' },
                subscription: sub
            };
        }
    }
    // Allow with remaining quota
    return {
        decision: { allow: true, remainingQuota: quota - used },
        subscription: sub
    };
}
/** Track usage after request completes */
async function trackUsage(uid, endpoint, success, costCents = 0, durationMs = 0) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
    const dailyRef = db.doc(`usage_logs/${uid}/daily/${today}`);
    const monthlyRef = db.doc(`usage_logs/${uid}/monthly/${monthKey}`);
    const increment = admin.firestore.FieldValue.increment(1);
    const costIncrement = admin.firestore.FieldValue.increment(costCents);
    // Update daily
    await dailyRef.set({
        total: increment,
        [success ? 'success' : 'errors']: increment,
        [`${endpoint}`]: increment,
        cost: costIncrement,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    // Update monthly (real-time for gate checks)
    await monthlyRef.set({
        total: increment,
        [`byEndpoint.${endpoint}`]: increment,
        cost: costIncrement,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
//# sourceMappingURL=limits.js.map