"use strict";
/**
 * DSAR Utilities for Cloud Functions
 * Re-exported from main server utilities for Function use
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
exports.startExport = startExport;
exports.executeDeletion = executeDeletion;
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const storage = admin.storage();
// PII Map - defines all collections containing user data
const PII_MAP = [
    {
        name: 'users',
        fields: ['uid', 'email', 'displayName', 'phoneNumber', 'photoURL', 'createdAt', 'updatedAt', 'stripeCustomerId'],
        uidField: 'uid',
        subcollections: [
            { name: 'mfa_devices', fields: ['deviceId', 'deviceName', 'enrolledAt'] },
            { name: 'backup_codes', fields: ['code', 'usedAt', 'createdAt'] },
            { name: 'passkeys', fields: ['credentialId', 'publicKey', 'counter', 'transports', 'createdAt', 'lastUsedAt'] },
            { name: 'webauthn_state', fields: ['challenge', 'createdAt'] },
            { name: 'subscriptionHistory', fields: ['status', 'tier', 'startedAt', 'endedAt', 'provider'] },
        ],
    },
    {
        name: 'audit_logs',
        fields: ['uid', 'action', 'resource', 'ts', 'ip', 'ua', 'status', 'metadata'],
        uidField: 'uid',
    },
    {
        name: 'usage_events',
        fields: ['uid', 'kind', 'amount', 'ts', 'wsId', 'metadata'],
        uidField: 'uid',
    },
    {
        name: 'usage_daily',
        fields: ['uid', 'dateKey', 'total', 'byKind', 'createdAt', 'updatedAt'],
        uidField: 'uid',
    },
    {
        name: 'user_quotas',
        fields: ['uid', 'tier', 'dailyQuota', 'usedToday', 'dateKey', 'lastReset'],
        uidField: 'uid',
    },
    {
        name: 'workspaces',
        fields: ['ownerId', 'name', 'createdAt', 'updatedAt'],
        uidField: 'ownerId',
        subcollections: [
            { name: 'members', fields: ['uid', 'role', 'joinedAt', 'invitedBy'] },
        ],
    },
    {
        name: 'invites',
        fields: ['workspaceId', 'email', 'role', 'invitedBy', 'createdAt', 'expiresAt', 'status'],
        uidField: 'invitedBy',
    },
    {
        name: 'dsar_requests',
        fields: ['uid', 'type', 'status', 'requestedAt', 'processedAt', 'metadata'],
        uidField: 'uid',
    },
];
/**
 * Start data export process for a user
 */
async function startExport(uid, reqId) {
    try {
        await db.collection('dsar_requests').doc(reqId).update({
            status: 'processing',
            processedAt: new Date(),
        });
        const userData = {};
        for (const collection of PII_MAP) {
            const collectionData = [];
            const query = db.collection(collection.name).where(collection.uidField, '==', uid);
            const snapshot = await query.get();
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const extractedData = { id: doc.id };
                for (const field of collection.fields) {
                    if (data[field] !== undefined) {
                        extractedData[field] = data[field];
                    }
                }
                if (collection.subcollections) {
                    for (const subCol of collection.subcollections) {
                        const subSnapshot = await db
                            .collection(collection.name)
                            .doc(doc.id)
                            .collection(subCol.name)
                            .get();
                        extractedData[subCol.name] = subSnapshot.docs.map((subDoc) => {
                            const subData = subDoc.data();
                            const extracted = { id: subDoc.id };
                            for (const field of subCol.fields) {
                                if (subData[field] !== undefined) {
                                    extracted[field] = subData[field];
                                }
                            }
                            return extracted;
                        });
                    }
                }
                collectionData.push(extractedData);
            }
            userData[collection.name] = collectionData;
        }
        const exportData = {
            exportedAt: new Date().toISOString(),
            uid,
            requestId: reqId,
            collections: userData,
        };
        const jsonContent = JSON.stringify(exportData, null, 2);
        const buffer = Buffer.from(jsonContent, 'utf-8');
        const bucketName = process.env.EXPORT_STORAGE_BUCKET || 'f0-exports';
        const bucket = storage.bucket(bucketName);
        const fileName = `dsar-exports/${uid}/${reqId}/user-data-${Date.now()}.json`;
        const file = bucket.file(fileName);
        await file.save(buffer, {
            contentType: 'application/json',
            metadata: {
                uid,
                requestId: reqId,
                exportedAt: new Date().toISOString(),
            },
        });
        const ttlSeconds = Number(process.env.EXPORT_SIGNED_URL_TTL_SECONDS || 86400);
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + ttlSeconds * 1000,
        });
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
        const exportId = db.collection('dsar_exports').doc().id;
        await db.collection('dsar_exports').doc(exportId).set({
            id: exportId,
            uid,
            requestId: reqId,
            fileUrl: signedUrl,
            expiresAt,
            createdAt: new Date(),
            sizeBytes: buffer.length,
        });
        await db.collection('dsar_requests').doc(reqId).update({
            status: 'ready',
            exportUrl: signedUrl,
            exportExpiresAt: expiresAt,
        });
        console.log(`✅ Data export completed for user ${uid}, request ${reqId}`);
    }
    catch (error) {
        console.error('❌ Error starting export:', error);
        await db.collection('dsar_requests').doc(reqId).update({
            status: 'denied',
            denialReason: `Export failed: ${error.message}`,
        });
        throw error;
    }
}
/**
 * Execute permanent deletion
 */
async function executeDeletion(taskId) {
    const taskDoc = await db.collection('deletion_queue').doc(taskId).get();
    if (!taskDoc.exists) {
        throw new Error(`Deletion task ${taskId} not found`);
    }
    const task = taskDoc.data();
    if (task.status !== 'pending') {
        console.log(`⏭️  Deletion task ${taskId} already ${task.status}, skipping`);
        return;
    }
    if (new Date() < task.scheduledFor.toDate()) {
        console.log(`⏰ Deletion task ${taskId} not due yet`);
        return;
    }
    const { uid } = task;
    try {
        for (const collection of PII_MAP) {
            const query = db.collection(collection.name).where(collection.uidField, '==', uid);
            const snapshot = await query.get();
            for (const doc of snapshot.docs) {
                if (collection.subcollections) {
                    for (const subCol of collection.subcollections) {
                        const subSnapshot = await db
                            .collection(collection.name)
                            .doc(doc.id)
                            .collection(subCol.name)
                            .get();
                        for (const subDoc of subSnapshot.docs) {
                            await subDoc.ref.delete();
                        }
                    }
                }
                await doc.ref.delete();
            }
            console.log(`✅ Deleted ${snapshot.size} documents from ${collection.name}`);
        }
        try {
            await admin.auth().deleteUser(uid);
            console.log(`✅ Deleted Firebase Auth user ${uid}`);
        }
        catch (error) {
            console.warn(`⚠️  Could not delete Auth user ${uid}:`, error.message);
        }
        await db.collection('deletion_queue').doc(taskId).update({
            status: 'completed',
            completedAt: new Date(),
        });
        await db.collection('dsar_requests').doc(task.requestId).update({
            status: 'completed',
            completedAt: new Date(),
        });
        console.log(`✅ Permanent deletion completed for user ${uid}`);
    }
    catch (error) {
        console.error('❌ Error executing deletion:', error);
        await db.collection('deletion_queue').doc(taskId).update({
            status: 'pending',
            lastError: error.message,
            lastErrorAt: new Date(),
        });
        throw error;
    }
}
//# sourceMappingURL=dsar.js.map