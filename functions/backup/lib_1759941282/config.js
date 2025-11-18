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
exports.getConfig = getConfig;
// functions/src/config.ts
const dotenv = __importStar(require("dotenv"));
dotenv.config(); // Reads functions/.env in emulator
function getConfig() {
    var _a, _b, _c, _d;
    // Priority: process.env → functions params/config
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ((_a = process.env.stripe) === null || _a === void 0 ? void 0 : _a.secret_key);
    const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ((_b = process.env.stripe) === null || _b === void 0 ? void 0 : _b.webhook_secret);
    const PORTAL_RETURN_URL = process.env.PORTAL_RETURN_URL || ((_c = process.env.portal) === null || _c === void 0 ? void 0 : _c.return_url) || "http://localhost:3000/developers";
    const API_KEY_HASH_SECRET = process.env.API_KEY_HASH_SECRET || ((_d = process.env.api) === null || _d === void 0 ? void 0 : _d.hash_secret);
    const PROJECT_ID = process.env.GCLOUD_PROJECT ||
        (process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId : undefined) ||
        process.env.PROJECT_ID ||
        "demo-project";
    const REGION = process.env.FUNCTIONS_REGION || "us-central1";
    // Validate required secrets
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !API_KEY_HASH_SECRET) {
        console.warn("⚠️ Missing required secrets - using demo values");
    }
    return {
        STRIPE_SECRET_KEY: STRIPE_SECRET_KEY || "sk_test_demo",
        STRIPE_WEBHOOK_SECRET: STRIPE_WEBHOOK_SECRET || "whsec_demo",
        PORTAL_RETURN_URL,
        API_KEY_HASH_SECRET: API_KEY_HASH_SECRET || "demo_secret",
        PROJECT_ID,
        REGION,
    };
}
//# sourceMappingURL=config.js.map