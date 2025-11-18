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
exports.bundlePriceForCurrency = bundlePriceForCurrency;
exports.issueBundleLicenses = issueBundleLicenses;
const admin = __importStar(require("firebase-admin"));
const regions_1 = require("../pricing/regions");
async function bundlePriceForCurrency(bundle, currency, country, fxRates) {
    var _a;
    // Check for bundle-level currency override first
    if (((_a = bundle === null || bundle === void 0 ? void 0 : bundle.prices) === null || _a === void 0 ? void 0 : _a[currency.toUpperCase()]) != null) {
        return Number(bundle.prices[currency.toUpperCase()]);
    }
    // Calculate sum of product prices
    const db = admin.firestore();
    const productIds = bundle.productIds || [];
    if (!productIds.length)
        return 0;
    let total = 0;
    for (const pid of productIds) {
        const prodSnap = await db.collection("products").doc(pid).get();
        if (!prodSnap.exists)
            continue;
        const product = prodSnap.data();
        // Calculate FX price if needed
        let fxPrice = Number(product.priceUsd || 0);
        if (currency.toUpperCase() !== "USD" && (fxRates === null || fxRates === void 0 ? void 0 : fxRates.rates)) {
            const rate = fxRates.rates[currency.toUpperCase()] || 1;
            fxPrice = fxPrice * rate;
        }
        // Resolve price using region rules
        const price = await (0, regions_1.resolveRegionPrice)(product, currency, country, fxPrice);
        total += price;
    }
    // Apply bundle discount
    const discount = Number(bundle.discountPercent || 0);
    const finalPrice = total * (1 - discount / 100);
    return Math.round(finalPrice * 100) / 100;
}
async function issueBundleLicenses(order, bundle) {
    const db = admin.firestore();
    const batch = db.batch();
    const productIds = bundle.productIds || [];
    for (const pid of productIds) {
        const licRef = db.collection("licenses").doc();
        batch.set(licRef, {
            uid: order.uid,
            productId: pid,
            orderId: order.id,
            bundleId: bundle.id || order.bundleId,
            createdAt: Date.now(),
            revoked: false,
        });
    }
    await batch.commit();
    console.log(`Issued ${productIds.length} licenses for bundle order ${order.id}`);
}
//# sourceMappingURL=bundles.js.map