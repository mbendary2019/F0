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
exports.revokeApiKey = exports.listApiKeys = exports.createApiKey = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const crypto_1 = require("crypto");
const config_1 = require("./config");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
/** Generate API key hash */
function hashKey(key) {
    const { API_KEY_HASH_SECRET } = (0, config_1.getConfig)();
    return (0, crypto_1.createHmac)("sha256", API_KEY_HASH_SECRET).update(key).digest("hex");
}
/** Callable: Create new API key for current user */
exports.createApiKey = (0, https_1.onCall)(async (req) => {
    var _a;
    const uid = ((_a = req.auth) === null || _a === void 0 ? void 0 : _a.uid) || "demo-user";
    const { name, scopes } = req.data;
    // Generate unique API key
    const plainKey = `f0_${(0, crypto_1.randomBytes)(16).toString("hex")}_${(0, crypto_1.randomBytes)(8).toString("hex")}`;
    const hash = hashKey(plainKey);
    // Save to Firestore
    const docRef = await db.collection("api_keys").add({
        uid,
        name: name || "Unnamed Key",
        scopes: scopes || ["read"],
        hash,
        active: true,
        createdAt: new Date(),
        lastUsed: null,
    });
    return {
        id: docRef.id,
        apiKey: plainKey,
        name: name || "Unnamed Key",
        scopes: scopes || ["read"],
    };
});
/** Callable: List all API keys for current user */
exports.listApiKeys = (0, https_1.onCall)(async (req) => {
    var _a;
    const uid = ((_a = req.auth) === null || _a === void 0 ? void 0 : _a.uid) || "demo-user";
    const snapshot = await db.collection("api_keys")
        .where("uid", "==", uid)
        .where("active", "==", true)
        .orderBy("createdAt", "desc")
        .get();
    return snapshot.docs.map(doc => {
        var _a, _b, _c, _d;
        return ({
            id: doc.id,
            name: doc.get("name"),
            scopes: doc.get("scopes"),
            createdAt: ((_b = (_a = doc.get("createdAt")) === null || _a === void 0 ? void 0 : _a.toDate()) === null || _b === void 0 ? void 0 : _b.toISOString()) || null,
            lastUsed: ((_d = (_c = doc.get("lastUsed")) === null || _c === void 0 ? void 0 : _c.toDate()) === null || _d === void 0 ? void 0 : _d.toISOString()) || null,
        });
    });
});
/** Callable: Revoke (soft delete) an API key */
exports.revokeApiKey = (0, https_1.onCall)(async (req) => {
    var _a;
    const uid = ((_a = req.auth) === null || _a === void 0 ? void 0 : _a.uid) || "demo-user";
    const { keyId } = req.data;
    if (!keyId) {
        throw new https_1.HttpsError("invalid-argument", "keyId is required");
    }
    const docRef = db.collection("api_keys").doc(keyId);
    const doc = await docRef.get();
    if (!doc.exists) {
        throw new https_1.HttpsError("not-found", "API key not found");
    }
    if (doc.get("uid") !== uid) {
        throw new https_1.HttpsError("permission-denied", "Not your key");
    }
    await docRef.update({
        active: false,
        revokedAt: new Date(),
    });
    return { ok: true, id: keyId };
});
//# sourceMappingURL=apiKeys.js.map