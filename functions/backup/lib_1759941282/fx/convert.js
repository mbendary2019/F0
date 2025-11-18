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
exports.convertPrice = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Fallback rates if fx_rates/latest is not available
const FALLBACK_RATES = {
    EUR: 0.92,
    GBP: 0.78,
    AED: 3.67,
    CAD: 1.35,
    AUD: 1.52,
    JPY: 149.50,
    INR: 83.20,
    SGD: 1.34
};
function psychologicalRounding(amount) {
    // Round to .99 for psychological pricing
    // Examples: 29.00 -> 28.99, 50.00 -> 49.99
    if (amount <= 1)
        return amount; // Don't round very small amounts
    const rounded = Math.floor(amount);
    return rounded - 0.01;
}
exports.convertPrice = functions.https.onCall(async (payload, context) => {
    const { baseUsd, currency } = payload || {};
    if (!baseUsd || !currency) {
        throw new functions.https.HttpsError("invalid-argument", "baseUsd and currency required");
    }
    const targetCurrency = String(currency).toUpperCase();
    // No conversion needed for USD
    if (targetCurrency === "USD") {
        return {
            baseUsd: Number(baseUsd),
            currency: "USD",
            converted: Number(baseUsd),
            rate: 1.0
        };
    }
    const db = admin.firestore();
    let rate = FALLBACK_RATES[targetCurrency] || 1.0;
    let source = "fallback";
    try {
        // Try to get latest rates from Firestore
        const fxSnap = await db.collection("fx_rates").doc("latest").get();
        if (fxSnap.exists) {
            const data = fxSnap.data();
            const rates = (data === null || data === void 0 ? void 0 : data.rates) || {};
            if (rates[targetCurrency]) {
                rate = rates[targetCurrency];
                source = "live";
            }
        }
    }
    catch (err) {
        console.warn("Could not fetch FX rates, using fallback:", err);
    }
    // Convert
    const converted = Number(baseUsd) * rate;
    // Apply psychological rounding
    const rounded = psychologicalRounding(converted);
    return {
        baseUsd: Number(baseUsd),
        currency: targetCurrency,
        converted: Math.round(rounded * 100) / 100,
        rate,
        source
    };
});
//# sourceMappingURL=convert.js.map