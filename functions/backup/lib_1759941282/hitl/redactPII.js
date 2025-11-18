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
exports.redactPII = void 0;
const functions = __importStar(require("firebase-functions"));
function mask(str, visible = 2) {
    if (!str)
        return str;
    if (str.length <= visible)
        return "*".repeat(str.length);
    return str.slice(0, visible) + "*".repeat(Math.max(0, str.length - visible));
}
exports.redactPII = functions.https.onCall(async (payload, context) => {
    var _a, _b;
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Auth required");
    const text = ((_a = payload === null || payload === void 0 ? void 0 : payload.text) !== null && _a !== void 0 ? _a : "");
    const strategies = ((_b = payload === null || payload === void 0 ? void 0 : payload.strategies) !== null && _b !== void 0 ? _b : {});
    if (!text)
        throw new functions.https.HttpsError("invalid-argument", "text required");
    let out = text;
    let emails = 0, phones = 0, cards = 0, ssns = 0;
    // Email
    out = out.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (_, u, d) => { emails++; return strategies.email === "remove" ? "[EMAIL]" : `${mask(u)}@${d}`; });
    // Phone (basic INTL/US)
    out = out.replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}/g, (m) => { phones++; return strategies.phone === "remove" ? "[PHONE]" : mask(m, 0); });
    // Credit card (13-19 digits)
    out = out.replace(/\b(?:\d[ -]*?){13,19}\b/g, (m) => { cards++; return strategies.cc === "remove" ? "[CARD]" : mask(m.replace(/\s|-/g, "")); });
    // SSN-like (US style)
    out = out.replace(/\b\d{3}-\d{2}-\d{4}\b/g, (m) => { ssns++; return strategies.ssn === "remove" ? "[SSN]" : mask(m, 0); });
    return {
        redactedText: out,
        stats: { emails, phones, cards, ssns }
    };
});
//# sourceMappingURL=redactPII.js.map