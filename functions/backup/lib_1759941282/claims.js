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
exports.syncClaimsOnEntitlementsWrite = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
/**
 * Sync Entitlements to Custom Claims
 *
 * Automatically updates Firebase Auth custom claims when user entitlements change.
 * This allows for fast authorization checks without Firestore reads.
 *
 * Claims added:
 * - sub_active: boolean - Whether subscription is active
 * - sub_tier: string - Subscription tier (free, pro, etc.)
 * - sub_exp: number | null - Subscription expiry timestamp (seconds)
 */
exports.syncClaimsOnEntitlementsWrite = functions.firestore
    .document("users/{uid}")
    .onWrite(async (change, context) => {
    const uid = context.params.uid;
    // Get the new document data
    const after = change.after.exists ? change.after.data() : null;
    if (!after) {
        // User document deleted - clear claims
        await admin.auth().setCustomUserClaims(uid, {
            sub_active: false,
            sub_tier: "free",
            sub_exp: null,
        });
        console.log(`✅ Cleared claims for deleted user ${uid}`);
        return;
    }
    const ent = after.entitlements;
    // Extract subscription data
    const sub_active = !!(ent === null || ent === void 0 ? void 0 : ent.active);
    const sub_tier = ((ent === null || ent === void 0 ? void 0 : ent.tier) || "free").toLowerCase();
    // Handle both Firestore Timestamp and plain objects
    let sub_exp = null;
    if (ent === null || ent === void 0 ? void 0 : ent.periodEnd) {
        if (typeof ent.periodEnd._seconds === "number") {
            // Firestore Timestamp format
            sub_exp = ent.periodEnd._seconds;
        }
        else if (ent.periodEnd.seconds) {
            // Alternative Timestamp format
            sub_exp = ent.periodEnd.seconds;
        }
        else if (typeof ent.periodEnd === "number") {
            // Already a number
            sub_exp = ent.periodEnd;
        }
    }
    // Set custom claims
    try {
        await admin.auth().setCustomUserClaims(uid, {
            sub_active,
            sub_tier,
            sub_exp,
        });
        console.log(`✅ Updated claims for user ${uid}:`, {
            sub_active,
            sub_tier,
            sub_exp: sub_exp ? new Date(sub_exp * 1000).toISOString() : null,
        });
    }
    catch (error) {
        console.error(`❌ Error updating claims for user ${uid}:`, error.message);
        throw error;
    }
});
//# sourceMappingURL=claims.js.map