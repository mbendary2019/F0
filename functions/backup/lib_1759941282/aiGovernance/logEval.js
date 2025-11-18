"use strict";
/**
 * AI Governance - Log Evaluation Cloud Function
 * Callable function to log and evaluate AI outputs from client or server
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
exports.logAiEval = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const evaluator_1 = require("./evaluator");
const config_1 = require("./config");
/**
 * Cloud Function (HTTPS Callable)
 * Logs and evaluates an AI output
 *
 * Usage from client:
 * ```typescript
 * const fn = httpsCallable(getFunctions(), 'logAiEval');
 * const result = await fn({ model, prompt, output, latencyMs, costUsd });
 * ```
 */
exports.logAiEval = functions.https.onCall(async (payload, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required to log AI evaluations');
    }
    const uid = context.auth.uid;
    const db = admin.firestore();
    // Get dynamic configuration
    const cfg = await (0, config_1.getAIGovConfig)(db);
    // Check if AI evaluation is enabled
    if (!cfg.enabled) {
        console.log('⏭️  AI evaluation disabled via config, skipping');
        return { skipped: true };
    }
    // Apply sampling rate (0 = never, 1 = always)
    const sampleRate = Math.max(0, Math.min(1, cfg.sampleRate));
    if (Math.random() > sampleRate) {
        console.log(`📊 Sampled out (rate=${sampleRate})`);
        return { sampledOut: true };
    }
    // Validate payload
    const { model, prompt, output, latencyMs = 0, costUsd = 0 } = payload || {};
    if (!model || typeof model !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'model (string) is required');
    }
    if (!prompt || typeof prompt !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'prompt (string) is required');
    }
    if (!output || typeof output !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'output (string) is required');
    }
    try {
        const input = {
            uid,
            model,
            prompt,
            output,
            latencyMs: Number(latencyMs) || 0,
            costUsd: Number(costUsd) || 0,
            thresholds: cfg.thresholds,
        };
        const { id, result } = await (0, evaluator_1.evaluateAndPersist)(db, input);
        return Object.assign(Object.assign({ id }, result), { thresholds: cfg.thresholds });
    }
    catch (error) {
        console.error('❌ Error logging AI evaluation:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=logEval.js.map