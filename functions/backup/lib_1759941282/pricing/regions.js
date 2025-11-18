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
exports.loadPricingRegions = loadPricingRegions;
exports.resolveRegionPrice = resolveRegionPrice;
const admin = __importStar(require("firebase-admin"));
let cache = null;
let cacheTs = 0;
async function loadPricingRegions() {
    if (Date.now() - cacheTs < 60000 && cache)
        return cache;
    const snap = await admin.firestore().collection("config").doc("pricing_regions").get();
    cache = (snap.exists ? snap.data() : {}) || {};
    cacheTs = Date.now();
    return cache;
}
function psychologicalRounding(amount) {
    if (amount <= 1)
        return amount;
    const rounded = Math.floor(amount);
    return rounded - 0.01;
}
async function resolveRegionPrice(product, currency, country, fxPrice = 0) {
    var _a;
    const cur = currency.toUpperCase();
    // 1) Product currency override (highest priority)
    if (((_a = product === null || product === void 0 ? void 0 : product.prices) === null || _a === void 0 ? void 0 : _a[cur]) != null) {
        return Number(product.prices[cur]);
    }
    // 2) Load region rules
    const rules = await loadPricingRegions();
    const regions = rules.regions || {};
    const defaults = rules.defaults || {};
    // 3) Check region-specific rules
    if (country && regions[country]) {
        const region = regions[country];
        // If region has a fixed price for this product tier/ID
        if (region.fixed && product.tier && region.fixed[product.tier]) {
            return Number(region.fixed[product.tier]);
        }
        if (region.fixed && product.id && region.fixed[product.id]) {
            return Number(region.fixed[product.id]);
        }
        // If region has currency-specific multiplier
        if (region.currency === cur && region.multiplier) {
            const baseUsd = Number(product.priceUsd || 0);
            let price = baseUsd * region.multiplier;
            if (region.round === "psychological") {
                price = psychologicalRounding(price);
            }
            return Math.round(price * 100) / 100;
        }
    }
    // 4) Check currency defaults
    if (defaults[cur] && defaults[cur].multiplier) {
        const baseUsd = Number(product.priceUsd || 0);
        let price = baseUsd * defaults[cur].multiplier;
        if (defaults[cur].round === "psychological") {
            price = psychologicalRounding(price);
        }
        return Math.round(price * 100) / 100;
    }
    // 5) Fallback to FX price
    return fxPrice || Number(product.priceUsd || 0);
}
//# sourceMappingURL=regions.js.map