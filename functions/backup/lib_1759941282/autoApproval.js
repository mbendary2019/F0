"use strict";
/**
 * Auto-Approval Engine for DSAR Requests
 * Automatically approve/reject requests based on user tier and account age
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
exports.autoProcessDSAR = void 0;
exports.decideDSARApproval = decideDSARApproval;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const dsar_1 = require("./dsar");
const notifications_1 = require("./notifications");
const db = admin.firestore();
/**
 * Determine if DSAR should be auto-approved, auto-rejected, or kept pending
 */
function decideDSARApproval(record) {
    // Rule 1: Premium and Enterprise users get auto-approval
    if ((record.plan === 'premium' || record.plan === 'enterprise') &&
        process.env.AUTO_APPROVE_PREMIUM === 'true') {
        console.log(`✅ Auto-approving ${record.type} for ${record.plan} user ${record.uid}`);
        return 'auto_approved';
    }
    // Rule 2: Reject deletion requests from very new accounts (anti-abuse)
    const minAccountAgeDays = Number(process.env.AUTO_REJECT_NEW_ACCOUNTS_DAYS || 1);
    if (record.type === 'deletion' && record.accountAgeDays < minAccountAgeDays) {
        console.log(`❌ Auto-rejecting deletion for new account ${record.uid} (${record.accountAgeDays} days old)`);
        return 'auto_rejected';
    }
    // Rule 3: Auto-approve exports for all users (low risk)
    if (record.type === 'export') {
        console.log(`✅ Auto-approving export for user ${record.uid}`);
        return 'auto_approved';
    }
    // Default: require manual review for deletion requests
    console.log(`⏸️  Manual review required for ${record.type} from ${record.uid}`);
    return 'pending';
}
/**
 * Get user's plan tier and account age
 */
async function getUserInfo(uid) {
    var _a, _b, _c;
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    // Get plan from subscription or default to free
    const plan = (((_b = (_a = userData === null || userData === void 0 ? void 0 : userData.subscription) === null || _a === void 0 ? void 0 : _a.tier) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || 'free');
    // Calculate account age
    const createdAt = ((_c = userData === null || userData === void 0 ? void 0 : userData.createdAt) === null || _c === void 0 ? void 0 : _c.toDate()) || new Date();
    const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    // Get email
    const email = (userData === null || userData === void 0 ? void 0 : userData.email) || null;
    return { plan, accountAgeDays, email };
}
/**
 * Process auto-approved export
 */
async function processAutoApprovedExport(uid, requestId) {
    try {
        console.log(`🚀 Processing auto-approved export: ${requestId}`);
        // Start export (from Sprint 11)
        await (0, dsar_1.startExport)(uid, requestId);
        // Get the updated request with export URL
        const requestDoc = await db.collection('dsar_requests').doc(requestId).get();
        const requestData = requestDoc.data();
        // Send notification with download link
        if ((requestData === null || requestData === void 0 ? void 0 : requestData.exportUrl) && (requestData === null || requestData === void 0 ? void 0 : requestData.exportExpiresAt)) {
            // Get export size
            const exportDoc = await db
                .collection('dsar_exports')
                .where('requestId', '==', requestId)
                .limit(1)
                .get();
            const sizeBytes = exportDoc.empty ? 0 : exportDoc.docs[0].data().sizeBytes || 0;
            await (0, notifications_1.notifyDataExportReady)({
                uid,
                requestId,
                downloadUrl: requestData.exportUrl,
                sizeBytes,
                expiresAt: requestData.exportExpiresAt.toDate(),
            });
        }
        console.log(`✅ Auto-approved export completed: ${requestId}`);
    }
    catch (error) {
        console.error(`❌ Auto-approved export failed for ${requestId}:`, error.message);
        throw error;
    }
}
/**
 * Process auto-approved deletion
 */
async function processAutoApprovedDeletion(uid, requestId) {
    try {
        console.log(`🚀 Processing auto-approved deletion: ${requestId}`);
        // Start deletion with grace period (from Sprint 11)
        await (0, dsar_1.startDeletion)({
            uid,
            reqId: requestId,
            reason: 'Auto-approved deletion request',
        });
        // Calculate deletion date
        const gracePeriodDays = Number(process.env.DELETION_GRACE_PERIOD_DAYS || 30);
        const deletionDate = new Date();
        deletionDate.setDate(deletionDate.getDate() + gracePeriodDays);
        // Send approval notification
        await (0, notifications_1.notifyDsarApproved)({
            uid,
            requestId,
            type: 'deletion',
            approvedBy: 'system',
            deletionDate,
            gracePeriodDays,
        });
        console.log(`✅ Auto-approved deletion scheduled: ${requestId}`);
    }
    catch (error) {
        console.error(`❌ Auto-approved deletion failed for ${requestId}:`, error.message);
        throw error;
    }
}
/**
 * Firestore trigger: Auto-process DSAR requests when created
 */
exports.autoProcessDSAR = functions.firestore
    .document('dsar_requests/{requestId}')
    .onCreate(async (snap, context) => {
    var _a;
    const requestId = context.params.requestId;
    const data = snap.data();
    console.log(`📋 New DSAR request ${requestId}: ${data.type}`);
    try {
        // Get user info
        const { plan, accountAgeDays, email } = await getUserInfo(data.uid);
        // Build DSAR record
        const record = {
            id: requestId,
            uid: data.uid,
            type: data.type,
            plan,
            createdAt: ((_a = data.requestedAt) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(),
            accountAgeDays,
            status: data.status,
        };
        // Decide approval
        const decision = decideDSARApproval(record);
        // Log audit
        await db.collection('audit_logs').add({
            ts: admin.firestore.FieldValue.serverTimestamp(),
            actor: 'system',
            action: 'dsar.auto_decision',
            resource: `dsar_requests/${requestId}`,
            status: 'success',
            metadata: {
                requestId,
                uid: data.uid,
                type: data.type,
                decision,
                plan,
                accountAgeDays,
            },
        });
        // Handle decision
        if (decision === 'auto_approved') {
            // Update status
            await snap.ref.update({
                status: 'approved',
                approvedBy: 'system',
                approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                metadata: Object.assign(Object.assign({}, data.metadata), { autoApproved: true, decision }),
            });
            // Send initial notification
            await (0, notifications_1.notifyDsarRequest)({
                uid: data.uid,
                requestId,
                type: data.type,
                status: 'approved',
                autoApproved: true,
            });
            // Process based on type
            if (data.type === 'export') {
                await processAutoApprovedExport(data.uid, requestId);
            }
            else if (data.type === 'deletion') {
                await processAutoApprovedDeletion(data.uid, requestId);
            }
        }
        else if (decision === 'auto_rejected') {
            // Update status
            await snap.ref.update({
                status: 'denied',
                deniedBy: 'system',
                deniedAt: admin.firestore.FieldValue.serverTimestamp(),
                denialReason: `Account too new (${accountAgeDays} days old). Minimum age: ${process.env.AUTO_REJECT_NEW_ACCOUNTS_DAYS || 1} days.`,
                metadata: Object.assign(Object.assign({}, data.metadata), { autoRejected: true, decision }),
            });
            // Send rejection notification
            await (0, notifications_1.notifyDsarRequest)({
                uid: data.uid,
                requestId,
                type: data.type,
                status: 'denied',
                autoApproved: false,
            });
        }
        else {
            // Pending - requires manual review
            // Send notification that request is under review
            await (0, notifications_1.notifyDsarRequest)({
                uid: data.uid,
                requestId,
                type: data.type,
                status: 'pending',
                autoApproved: false,
            });
            console.log(`⏸️  Request ${requestId} pending manual review`);
        }
    }
    catch (error) {
        console.error(`❌ Auto-processing failed for ${requestId}:`, error.message);
        // Log error
        await db.collection('audit_logs').add({
            ts: admin.firestore.FieldValue.serverTimestamp(),
            actor: 'system',
            action: 'dsar.auto_decision',
            resource: `dsar_requests/${requestId}`,
            status: 'error',
            metadata: {
                requestId,
                error: error.message,
            },
        });
        // Don't throw - let manual review handle it
    }
});
//# sourceMappingURL=autoApproval.js.map