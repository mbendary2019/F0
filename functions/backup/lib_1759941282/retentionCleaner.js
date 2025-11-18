"use strict";
/**
 * Dynamic Retention Cleaner
 * Reads retention rules from Firestore config and enforces them
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
exports.triggerRetentionCleanup = exports.retentionCleaner = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
/**
 * Get retention rules from Firestore config
 */
async function getRetentionRules() {
    try {
        const configDoc = await db.collection('config').doc('retention_policies').get();
        if (!configDoc.exists) {
            console.warn('⚠️  No retention_policies config found');
            return [];
        }
        const data = configDoc.data();
        return ((data === null || data === void 0 ? void 0 : data.rules) || []);
    }
    catch (error) {
        console.error('❌ Failed to load retention rules:', error.message);
        return [];
    }
}
/**
 * Clean old documents from a collection
 */
async function cleanCollection(rule) {
    const { collection, days, autoClean } = rule;
    if (!autoClean) {
        console.log(`⏭️  Skipping ${collection} (autoClean=false)`);
        return 0;
    }
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);
    console.log(`🧹 Cleaning ${collection}: retention=${days} days, cutoff=${cutoffDate.toISOString()}`);
    try {
        // Query old documents (max 500 per run to avoid timeouts)
        const snapshot = await db
            .collection(collection)
            .where('createdAt', '<', cutoffTimestamp)
            .limit(500)
            .get();
        if (snapshot.empty) {
            console.log(`✅ No expired documents in ${collection}`);
            return 0;
        }
        // Batch delete
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`✅ Deleted ${snapshot.size} documents from ${collection}`);
        return snapshot.size;
    }
    catch (error) {
        console.error(`❌ Error cleaning ${collection}:`, error.message);
        return 0;
    }
}
/**
 * Scheduled Function: Run retention cleaner every 6 hours
 */
exports.retentionCleaner = functions.pubsub
    .schedule('every 6 hours')
    .timeZone('UTC')
    .onRun(async (context) => {
    console.log('🧹 Starting dynamic retention cleaner...');
    const rules = await getRetentionRules();
    if (rules.length === 0) {
        console.log('⚠️  No retention rules configured');
        return null;
    }
    console.log(`📋 Found ${rules.length} retention rules`);
    let totalDeleted = 0;
    for (const rule of rules) {
        const deleted = await cleanCollection(rule);
        totalDeleted += deleted;
    }
    console.log(`✅ Retention cleaner completed. Total deleted: ${totalDeleted}`);
    // Log to audit
    await db.collection('audit_logs').add({
        ts: admin.firestore.FieldValue.serverTimestamp(),
        actor: 'system',
        action: 'retention.cleanup',
        resource: 'retention_policies',
        status: 'success',
        metadata: {
            rulesProcessed: rules.length,
            documentsDeleted: totalDeleted,
        },
    });
    return null;
});
/**
 * HTTP Callable: Manually trigger retention cleanup
 * (For testing or admin-triggered cleanup)
 */
exports.triggerRetentionCleanup = functions.https.onCall(async (data, context) => {
    var _a, _b;
    // Verify admin
    if (!((_b = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.admin)) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can trigger retention cleanup');
    }
    console.log(`🔧 Manual retention cleanup triggered by ${context.auth.uid}`);
    const rules = await getRetentionRules();
    if (rules.length === 0) {
        return { success: false, message: 'No retention rules configured', deleted: 0 };
    }
    let totalDeleted = 0;
    for (const rule of rules) {
        const deleted = await cleanCollection(rule);
        totalDeleted += deleted;
    }
    // Log audit
    await db.collection('audit_logs').add({
        ts: admin.firestore.FieldValue.serverTimestamp(),
        actor: context.auth.uid,
        action: 'retention.cleanup.manual',
        resource: 'retention_policies',
        status: 'success',
        metadata: {
            rulesProcessed: rules.length,
            documentsDeleted: totalDeleted,
        },
    });
    return {
        success: true,
        message: `Cleaned ${totalDeleted} documents across ${rules.length} collections`,
        deleted: totalDeleted,
        rules: rules.length,
    };
});
//# sourceMappingURL=retentionCleaner.js.map