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
exports.safeRegenerate = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * ملاحظة: إن كان لديك مزوّد LLM داخلي، استبدل callSafeModel() باستدعائك الخاص.
 * في حالة عدم الضبط، نستخدم Fallback Sanitizer: تعقيم كلمات سامة + تقصير + استدعاء redactPII داخلي.
 */
const TOXIC_WORDS = ["idiot", "stupid", "kill", "hate", "bomb", "rape"];
async function callSafeModel(prompt) {
    // TODO: integrate with your LLM provider here (OpenAI/Vertex/etc.)
    // Return null to fall back if not configured.
    return null;
}
function heuristicSanitize(input, maxLen = 1200) {
    let t = input;
    for (const w of TOXIC_WORDS) {
        const re = new RegExp(`\\b${w}\\b`, "gi");
        t = t.replace(re, "[REDACTED]");
    }
    if (t.length > maxLen)
        t = t.slice(0, maxLen) + "…";
    return t;
}
exports.safeRegenerate = functions.https.onCall(async (payload, context) => {
    var _a, _b, _c, _d;
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    const text = ((_a = payload === null || payload === void 0 ? void 0 : payload.text) !== null && _a !== void 0 ? _a : "");
    const prompt = ((_b = payload === null || payload === void 0 ? void 0 : payload.prompt) !== null && _b !== void 0 ? _b : "");
    const maxLen = Number((_d = (_c = payload === null || payload === void 0 ? void 0 : payload.policy) === null || _c === void 0 ? void 0 : _c.maxLen) !== null && _d !== void 0 ? _d : 1200);
    if (!text && !prompt) {
        throw new functions.https.HttpsError("invalid-argument", "text or prompt required");
    }
    // 1) حاول استخدام مزوّد LLM (لو متاح)
    const modelOut = await callSafeModel(`You are a safety rewriter. Remove PII, mask sensitive tokens, avoid toxicity, keep meaning.\nInput:\n${text || prompt}\nOutput (plain):`);
    let safeText = modelOut !== null && modelOut !== void 0 ? modelOut : heuristicSanitize(text || prompt, maxLen);
    // 2) PII pass (إعادة تمرير عبر تعمية بسيطة)
    // بديل سريع عن استدعاء callable redactPII: Regex محلي
    safeText = safeText
        .replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "[EMAIL]")
        .replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}/g, "[PHONE]")
        .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[CARD]")
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");
    // 3) اختياري: قيّم النص الآمن وسجّل نتيجة (يعتمد على Sprint 13)
    try {
        const db = admin.firestore();
        await db.collection("audit_logs").add({
            ts: Date.now(),
            actor: context.auth.uid,
            kind: "hitl_safe_regen",
            meta: { len: safeText.length }
        });
    }
    catch ( /* ignore */_e) { /* ignore */ }
    return {
        safeText,
        used: modelOut ? "model" : "fallback"
    };
});
//# sourceMappingURL=safeRegenerate.js.map