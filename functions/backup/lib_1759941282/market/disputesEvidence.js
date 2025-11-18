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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitDisputeEvidence = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const os_1 = require("os");
const path_1 = require("path");
const fs_1 = require("fs");
const stripe = new stripe_1.default(((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret_key) || process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" });
function requireAdmin(ctx) {
    var _a;
    const t = (((_a = ctx.auth) === null || _a === void 0 ? void 0 : _a.token) || {});
    if (!ctx.auth || !t.admin) {
        throw new functions.https.HttpsError("permission-denied", "Admin only");
    }
}
/**
 * Submit evidence for a dispute
 * Admin can provide text and upload files from Storage to Stripe
 * Files are temporarily downloaded from GCS, uploaded to Stripe Files (purpose: dispute_evidence)
 * Then evidence is submitted to the dispute
 */
exports.submitDisputeEvidence = functions.https.onCall(async (payload, ctx) => {
    var _a, _b;
    requireAdmin(ctx);
    const { disputeId, text, filePaths = [] } = (payload || {});
    if (!disputeId) {
        throw new functions.https.HttpsError("invalid-argument", "disputeId required");
    }
    const bucket = admin.storage().bucket();
    const uploaded = [];
    // Upload files from GCS to Stripe
    for (const path of filePaths) {
        try {
            const fileName = path.split("/").pop() || "evidence.bin";
            const tmp = (0, path_1.join)((0, os_1.tmpdir)(), fileName);
            // Download from GCS
            await bucket.file(path).download({ destination: tmp });
            // Read file and upload to Stripe
            const fileBuffer = await fs_1.promises.readFile(tmp);
            const file = await stripe.files.create({
                purpose: "dispute_evidence",
                file: {
                    data: fileBuffer,
                    name: fileName,
                    type: "application/octet-stream",
                },
            });
            uploaded.push(file.id);
            // Cleanup temp file
            await fs_1.promises.unlink(tmp).catch(() => { });
        }
        catch (err) {
            console.error(`Failed to upload file ${path}:`, err.message);
        }
    }
    // Build evidence object
    const evidence = {};
    if (text) {
        evidence.customer_communication = text.slice(0, 60000); // Stripe limit
    }
    if (uploaded.length) {
        evidence.uncategorized_file = uploaded[uploaded.length - 1];
    }
    // Update and submit evidence if we have anything
    if (Object.keys(evidence).length) {
        try {
            await stripe.disputes.update(disputeId, { evidence });
            await stripe.disputes.submit(disputeId);
        }
        catch (err) {
            console.error(`Failed to submit dispute evidence:`, err.message);
            throw new functions.https.HttpsError("internal", `Failed to submit evidence: ${err.message}`);
        }
    }
    // Log evidence submission to Firestore
    const db = admin.firestore();
    await db
        .collection("disputes")
        .doc(disputeId)
        .collection("evidence")
        .add({
        ts: Date.now(),
        by: (_a = ctx.auth) === null || _a === void 0 ? void 0 : _a.uid,
        text: text || null,
        stripeFiles: uploaded,
    });
    await db.collection("audit_logs").add({
        ts: Date.now(),
        kind: "dispute_evidence_submitted",
        actor: (_b = ctx.auth) === null || _b === void 0 ? void 0 : _b.uid,
        meta: { disputeId, filesCount: uploaded.length },
    });
    return { ok: true, uploadedCount: uploaded.length };
});
//# sourceMappingURL=disputesEvidence.js.map