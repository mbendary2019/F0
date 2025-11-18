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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncFxRates = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
exports.syncFxRates = (0, scheduler_1.onSchedule)("every 1 hours", async () => {
    const db = admin.firestore();
    try {
        // Fetch exchange rates from Stripe
        // Note: Stripe provides exchange rates via their API
        // For this implementation, we'll fetch rates for common currencies
        const currencies = ["EUR", "GBP", "AED", "CAD", "AUD", "JPY", "INR", "SGD"];
        const rates = {};
        // Stripe doesn't have a direct exchange rates API, so we use a fallback
        // In production, you'd use Stripe's actual rates or a dedicated FX service
        // For now, we'll set default rates (these should be updated with real data)
        const defaultRates = {
            EUR: 0.92,
            GBP: 0.78,
            AED: 3.67,
            CAD: 1.35,
            AUD: 1.52,
            JPY: 149.50,
            INR: 83.20,
            SGD: 1.34
        };
        // In a real implementation, you would fetch from Stripe or another FX service
        // For example, using an external API like exchangerate-api.com or openexchangerates.org
        for (const currency of currencies) {
            rates[currency] = defaultRates[currency] || 1.0;
        }
        // Store in Firestore
        await db.collection("fx_rates").doc("latest").set({
            base: "USD",
            ts: Date.now(),
            rates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[syncFxRates] Updated rates for ${Object.keys(rates).length} currencies`);
    }
    catch (err) {
        console.error("[syncFxRates] Error:", err);
        throw err;
    }
});
//# sourceMappingURL=syncRates.js.map