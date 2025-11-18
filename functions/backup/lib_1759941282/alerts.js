"use strict";
/**
 * Alert Monitoring Cloud Functions
 * Scheduled functions to monitor system health and trigger alerts
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
exports.watchFunctionErrors = exports.watchQuotaBreach = exports.watchAuthFails = exports.watchErrorRate = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
/**
 * Get date key in YYYYMMDD format
 */
function getDateKey() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}
/**
 * Monitor error rate from audit logs
 * Triggers alert if error rate exceeds threshold
 * Runs every 5 minutes
 */
exports.watchErrorRate = functions.pubsub
    .schedule('every 5 minutes')
    .timeZone('UTC')
    .onRun(async (context) => {
    console.log('[watchErrorRate] Starting error rate check');
    try {
        const since = new Date(Date.now() - 5 * 60 * 1000); // Last 5 minutes
        const threshold = Number(process.env.ALERT_THRESHOLD_ERROR_RATE || 0.05);
        // Get audit logs from last 5 minutes
        const auditsSnapshot = await db
            .collection('audit_logs')
            .where('ts', '>=', since)
            .get();
        if (auditsSnapshot.empty) {
            console.log('[watchErrorRate] No audit logs in last 5 minutes');
            return null;
        }
        // Count total requests and errors
        let total = 0;
        let errors = 0;
        auditsSnapshot.forEach((doc) => {
            const data = doc.data();
            total++;
            const status = data.status || 200;
            if (status >= 500) {
                errors++;
            }
        });
        const errorRate = total > 0 ? errors / total : 0;
        console.log(`[watchErrorRate] Total: ${total}, Errors: ${errors}, Rate: ${(errorRate * 100).toFixed(2)}%`);
        // Trigger alert if error rate exceeds threshold and we have enough samples
        if (errorRate >= threshold && total >= 50) {
            await db.collection('alerts').add({
                severity: 'critical',
                kind: 'error_rate',
                message: `High error rate detected: ${(errorRate * 100).toFixed(1)}% in last 5 minutes`,
                context: {
                    total,
                    errors,
                    errorRate: Number((errorRate * 100).toFixed(2)),
                    threshold: Number((threshold * 100).toFixed(2)),
                },
                status: 'open',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log('[watchErrorRate] Critical alert created!');
        }
        return null;
    }
    catch (error) {
        console.error('[watchErrorRate] Error:', error);
        throw error;
    }
});
/**
 * Monitor authentication failures
 * Triggers alert for high auth failure rate from same IP
 * Runs every 5 minutes
 */
exports.watchAuthFails = functions.pubsub
    .schedule('every 5 minutes')
    .timeZone('UTC')
    .onRun(async (context) => {
    console.log('[watchAuthFails] Starting auth failure check');
    try {
        const since = new Date(Date.now() - 5 * 60 * 1000); // Last 5 minutes
        const threshold = Number(process.env.ALERT_THRESHOLD_AUTH_FAILS || 20);
        // Get audit logs with auth failures
        const auditsSnapshot = await db
            .collection('audit_logs')
            .where('ts', '>=', since)
            .get();
        if (auditsSnapshot.empty) {
            console.log('[watchAuthFails] No audit logs in last 5 minutes');
            return null;
        }
        // Count auth failures by IP hash
        const failuresByIp = {};
        auditsSnapshot.forEach((doc) => {
            const data = doc.data();
            const status = data.status || 200;
            // Check for auth failures (401, 403)
            if (status === 401 || status === 403) {
                const ipHash = data.ip_hash || 'unknown';
                failuresByIp[ipHash] = (failuresByIp[ipHash] || 0) + 1;
            }
        });
        // Create alerts for IPs exceeding threshold
        const alertsCreated = [];
        for (const [ipHash, count] of Object.entries(failuresByIp)) {
            if (count >= threshold) {
                await db.collection('alerts').add({
                    severity: 'warning',
                    kind: 'auth_fail',
                    message: `High authentication failures from ${ipHash}: ${count} attempts in 5 minutes`,
                    context: {
                        ip_hash: ipHash,
                        count,
                        threshold,
                        period: '5 minutes',
                    },
                    status: 'open',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                alertsCreated.push(ipHash);
                console.log(`[watchAuthFails] Alert created for IP ${ipHash} (${count} failures)`);
            }
        }
        if (alertsCreated.length > 0) {
            console.log(`[watchAuthFails] Created ${alertsCreated.length} alert(s)`);
        }
        else {
            console.log('[watchAuthFails] No alerts triggered');
        }
        return null;
    }
    catch (error) {
        console.error('[watchAuthFails] Error:', error);
        throw error;
    }
});
/**
 * Monitor quota breaches
 * Triggers alert when users are close to their daily quota
 * Runs every 15 minutes
 */
exports.watchQuotaBreach = functions.pubsub
    .schedule('every 15 minutes')
    .timeZone('UTC')
    .onRun(async (context) => {
    console.log('[watchQuotaBreach] Starting quota breach check');
    try {
        const thresholdPercent = Number(process.env.ALERT_THRESHOLD_QUOTA_PERCENT || 0.95);
        const dateKey = getDateKey();
        // Get all user quotas
        const quotasSnapshot = await db.collection('user_quotas').get();
        if (quotasSnapshot.empty) {
            console.log('[watchQuotaBreach] No user quotas found');
            return null;
        }
        const quotaLimits = {
            free: Number(process.env.QUOTA_FREE_DAILY || 1000),
            pro: Number(process.env.QUOTA_PRO_DAILY || 10000),
            enterprise: Number(process.env.QUOTA_ENTERPRISE_DAILY || 100000),
        };
        let alertsCreated = 0;
        for (const doc of quotasSnapshot.docs) {
            const data = doc.data();
            const uid = doc.id;
            const used = data.used || 0;
            const tier = (data.planTier || 'free').toLowerCase();
            const limit = quotaLimits[tier] || quotaLimits.free;
            const usagePercent = used / limit;
            // Check if user is close to quota
            if (usagePercent >= thresholdPercent) {
                // Check if we already alerted for this user today
                const existingAlert = await db
                    .collection('alerts')
                    .where('kind', '==', 'quota_breach')
                    .where('context.uid', '==', uid)
                    .where('context.dateKey', '==', dateKey)
                    .where('status', '==', 'open')
                    .limit(1)
                    .get();
                if (existingAlert.empty) {
                    // Create new alert
                    await db.collection('alerts').add({
                        severity: 'warning',
                        kind: 'quota_breach',
                        message: `User ${uid} approaching quota limit: ${(usagePercent * 100).toFixed(0)}% used`,
                        context: {
                            uid,
                            dateKey,
                            tier,
                            used,
                            limit,
                            usagePercent: Number((usagePercent * 100).toFixed(2)),
                        },
                        status: 'open',
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    alertsCreated++;
                    console.log(`[watchQuotaBreach] Alert created for user ${uid} (${(usagePercent * 100).toFixed(0)}% used)`);
                }
            }
        }
        console.log(`[watchQuotaBreach] Created ${alertsCreated} alert(s)`);
        return null;
    }
    catch (error) {
        console.error('[watchQuotaBreach] Error:', error);
        throw error;
    }
});
/**
 * Monitor Cloud Functions errors
 * Triggers alert if functions are failing frequently
 * Runs every 10 minutes
 */
exports.watchFunctionErrors = functions.pubsub
    .schedule('every 10 minutes')
    .timeZone('UTC')
    .onRun(async (context) => {
    console.log('[watchFunctionErrors] Starting function error check');
    try {
        // This would typically query Cloud Logging API or Firestore collection
        // that tracks function executions. For now, we'll create a placeholder.
        // In production, you'd implement:
        // 1. Query Cloud Logging API for function errors
        // 2. Count errors by function name
        // 3. Create alerts if error rate exceeds threshold
        console.log('[watchFunctionErrors] Function monitoring not yet fully implemented');
        return null;
    }
    catch (error) {
        console.error('[watchFunctionErrors] Error:', error);
        throw error;
    }
});
//# sourceMappingURL=alerts.js.map