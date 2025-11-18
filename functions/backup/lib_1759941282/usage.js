"use strict";
/**
 * Usage Aggregation Cloud Functions
 * Daily aggregation of usage events and optional Stripe metered billing
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetDailyQuotas = exports.aggregateDailyUsage = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
});
/**
 * Get current date string in YYYYMMDD format (UTC)
 */
function getDateKey() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}
/**
 * Aggregate daily usage from usage_events
 * Runs every 15 minutes to process recent events
 */
exports.aggregateDailyUsage = functions.pubsub
    .schedule('*/15 * * * *') // Every 15 minutes
    .timeZone('UTC')
    .onRun(async (context) => {
    var _a;
    const db = admin.firestore();
    const dateKey = getDateKey();
    console.log(`[aggregateDailyUsage] Starting aggregation for ${dateKey}`);
    try {
        // 1. Get all unprocessed usage events from the last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const eventsSnapshot = await db
            .collection('usage_events')
            .where('ts', '>=', oneHourAgo)
            .orderBy('ts', 'asc')
            .limit(10000) // Process in batches
            .get();
        if (eventsSnapshot.empty) {
            console.log('[aggregateDailyUsage] No events to process');
            return null;
        }
        console.log(`[aggregateDailyUsage] Processing ${eventsSnapshot.size} events`);
        // 2. Group events by user
        const userEvents = {};
        eventsSnapshot.forEach((doc) => {
            const data = doc.data();
            const uid = data.uid;
            if (!userEvents[uid]) {
                userEvents[uid] = [];
            }
            userEvents[uid].push({
                kind: data.kind,
                amount: data.amount || 1,
                wsId: data.wsId,
            });
        });
        // 3. Aggregate per user
        const batch = db.batch();
        const processedEventIds = [];
        for (const [uid, events] of Object.entries(userEvents)) {
            // Calculate totals
            let total = 0;
            const byKind = {};
            events.forEach((event) => {
                total += event.amount;
                byKind[event.kind] = (byKind[event.kind] || 0) + event.amount;
            });
            // Get user's plan tier from custom claims
            let planTier = 'free';
            try {
                const userRecord = await admin.auth().getUser(uid);
                planTier = (((_a = userRecord.customClaims) === null || _a === void 0 ? void 0 : _a.sub_tier) || 'free').toLowerCase();
            }
            catch (err) {
                console.warn(`[aggregateDailyUsage] Could not get user ${uid}:`, err);
            }
            // Update usage_daily/{uid}/{dateKey}
            const dailyRef = db.doc(`usage_daily/${uid}/${dateKey}`);
            batch.set(dailyRef, {
                total: admin.firestore.FieldValue.increment(total),
                byKind: Object.keys(byKind).reduce((acc, kind) => {
                    acc[kind] = admin.firestore.FieldValue.increment(byKind[kind]);
                    return acc;
                }, {}),
                planTier,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            // Update user_quotas/{uid}
            const quotaRef = db.doc(`user_quotas/${uid}`);
            batch.set(quotaRef, {
                used: admin.firestore.FieldValue.increment(total),
                perKind: Object.keys(byKind).reduce((acc, kind) => {
                    acc[kind] = admin.firestore.FieldValue.increment(byKind[kind]);
                    return acc;
                }, {}),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            // Update admin_usage_stats/days/{dateKey}
            const adminStatsRef = db.doc(`admin_usage_stats/days/${dateKey}`);
            batch.set(adminStatsRef, {
                total: admin.firestore.FieldValue.increment(total),
                byKind: Object.keys(byKind).reduce((acc, kind) => {
                    acc[kind] = admin.firestore.FieldValue.increment(byKind[kind]);
                    return acc;
                }, {}),
                [`byPlan.${planTier}`]: admin.firestore.FieldValue.increment(total),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        // 4. Commit aggregation batch
        await batch.commit();
        console.log(`[aggregateDailyUsage] Aggregated ${eventsSnapshot.size} events for ${Object.keys(userEvents).length} users`);
        // 5. Mark events as processed (delete them)
        // In production, consider soft-delete or archiving instead
        const deleteBatch = db.batch();
        eventsSnapshot.forEach((doc) => {
            deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();
        console.log(`[aggregateDailyUsage] Deleted ${eventsSnapshot.size} processed events`);
        // 6. Optional: Report to Stripe metered billing
        if (process.env.STRIPE_METERED_BILLING_ENABLED === 'true') {
            await reportToStripeMetered(userEvents);
        }
        return null;
    }
    catch (error) {
        console.error('[aggregateDailyUsage] Error:', error);
        throw error;
    }
});
/**
 * Report usage to Stripe metered billing (optional)
 */
async function reportToStripeMetered(userEvents) {
    const db = admin.firestore();
    const meteredPriceId = process.env.STRIPE_METERED_PRICE_ID;
    if (!meteredPriceId) {
        console.warn('[reportToStripeMetered] STRIPE_METERED_PRICE_ID not configured');
        return;
    }
    console.log('[reportToStripeMetered] Reporting usage to Stripe');
    for (const [uid, events] of Object.entries(userEvents)) {
        try {
            // Get user's Stripe customer ID
            const userDoc = await db.doc(`users/${uid}`).get();
            const userData = userDoc.data();
            const customerId = userData === null || userData === void 0 ? void 0 : userData.stripeCustomerId;
            if (!customerId) {
                console.warn(`[reportToStripeMetered] No Stripe customer for ${uid}`);
                continue;
            }
            // Get active subscription with metered price
            const subscriptions = await stripe.subscriptions.list({
                customer: customerId,
                status: 'active',
                limit: 10,
            });
            const meteredSub = subscriptions.data.find((sub) => sub.items.data.some((item) => item.price.id === meteredPriceId));
            if (!meteredSub) {
                continue; // User doesn't have metered billing subscription
            }
            // Find subscription item with metered price
            const subItem = meteredSub.items.data.find((item) => item.price.id === meteredPriceId);
            if (!subItem) {
                continue;
            }
            // Calculate total usage for this billing period
            const totalUsage = events.reduce((sum, e) => sum + e.amount, 0);
            // Report usage to Stripe
            await stripe.subscriptionItems.createUsageRecord(subItem.id, {
                quantity: totalUsage,
                timestamp: Math.floor(Date.now() / 1000),
                action: 'increment',
            });
            console.log(`[reportToStripeMetered] Reported ${totalUsage} units for user ${uid}`);
        }
        catch (error) {
            console.error(`[reportToStripeMetered] Error for user ${uid}:`, error);
            // Continue processing other users
        }
    }
}
/**
 * Reset daily quotas at midnight UTC
 * Runs once per day at 00:05 UTC
 */
exports.resetDailyQuotas = functions.pubsub
    .schedule('5 0 * * *') // 00:05 UTC daily
    .timeZone('UTC')
    .onRun(async (context) => {
    const db = admin.firestore();
    const dateKey = getDateKey();
    console.log(`[resetDailyQuotas] Resetting quotas for ${dateKey}`);
    try {
        // Get all user quota documents
        const quotasSnapshot = await db.collection('user_quotas').limit(1000).get();
        if (quotasSnapshot.empty) {
            console.log('[resetDailyQuotas] No quotas to reset');
            return null;
        }
        // Calculate next reset time (tomorrow at midnight UTC)
        const tomorrow = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1, 0, 0, 0, 0));
        // Reset all quotas
        const batch = db.batch();
        quotasSnapshot.forEach((doc) => {
            const data = doc.data();
            batch.update(doc.ref, {
                used: 0,
                perKind: {},
                dateKey,
                resetAt: tomorrow,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        await batch.commit();
        console.log(`[resetDailyQuotas] Reset ${quotasSnapshot.size} quotas`);
        return null;
    }
    catch (error) {
        console.error('[resetDailyQuotas] Error:', error);
        throw error;
    }
});
//# sourceMappingURL=usage.js.map