"use strict";
/**
 * AI Governance - Configuration Management
 * Handles feature flags, sampling rates, and thresholds with caching
 */
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
exports.getAIGovConfig = getAIGovConfig;
exports.clearConfigCache = clearConfigCache;
const admin = __importStar(require("firebase-admin"));
// Cache with 60s TTL to reduce Firestore reads
let cache = null;
/**
 * Get AI Governance configuration with fallback to environment variables
 * Results are cached for 60 seconds
 */
async function getAIGovConfig(db = admin.firestore()) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const now = Date.now();
    // Return cached config if still valid
    if (cache && now - cache.ts < 60000) {
        return cache.v;
    }
    // Fetch from Firestore
    const snap = await db.collection('config').doc('ai_governance').get();
    const d = snap.exists ? snap.data() : {};
    // Build config with fallback to env vars
    const v = {
        enabled: (_a = d.enabled) !== null && _a !== void 0 ? _a : (process.env.AI_EVAL_ENABLED === 'true'),
        sampleRate: (_b = d.sampleRate) !== null && _b !== void 0 ? _b : Number((_c = process.env.AI_EVAL_SAMPLE_RATE) !== null && _c !== void 0 ? _c : 1),
        thresholds: {
            toxicity: (_e = (_d = d.thresholds) === null || _d === void 0 ? void 0 : _d.toxicity) !== null && _e !== void 0 ? _e : Number((_f = process.env.AI_TOXICITY_THRESHOLD) !== null && _f !== void 0 ? _f : 50),
            bias: (_h = (_g = d.thresholds) === null || _g === void 0 ? void 0 : _g.bias) !== null && _h !== void 0 ? _h : Number((_j = process.env.AI_BIAS_THRESHOLD) !== null && _j !== void 0 ? _j : 30),
        },
        alertFlagRatePct: (_k = d.alertFlagRatePct) !== null && _k !== void 0 ? _k : 10,
    };
    // Update cache
    cache = { v, ts: now };
    return v;
}
/**
 * Clear the config cache (useful for testing or immediate config updates)
 */
function clearConfigCache() {
    cache = null;
}
//# sourceMappingURL=config.js.map