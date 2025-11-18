/**
 * Usage Aggregation Cloud Functions
 * Daily aggregation of usage events and optional Stripe metered billing
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Get current date string in YYYYMMDD format (UTC)
 */
function getDateKey(): string {
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
export const aggregateDailyUsage = onSchedule(
  {
    schedule: '*/15 * * * *', // Every 15 minutes
    timeZone: 'UTC',
  },
  async (event) => {
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
      const userEvents: Record<
        string,
        Array<{ kind: string; amount: number; wsId?: string }>
      > = {};

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
      const processedEventIds: string[] = [];

      for (const [uid, events] of Object.entries(userEvents)) {
        // Calculate totals
        let total = 0;
        const byKind: Record<string, number> = {};

        events.forEach((event) => {
          total += event.amount;
          byKind[event.kind] = (byKind[event.kind] || 0) + event.amount;
        });

        // Get user's plan tier from custom claims
        let planTier: 'free' | 'pro' | 'enterprise' = 'free';
        try {
          const userRecord = await admin.auth().getUser(uid);
          planTier = (userRecord.customClaims?.sub_tier || 'free').toLowerCase() as
            | 'free'
            | 'pro'
            | 'enterprise';
        } catch (err) {
          console.warn(`[aggregateDailyUsage] Could not get user ${uid}:`, err);
        }

        // Update usage_daily/{uid}/{dateKey}
        const dailyRef = db.doc(`usage_daily/${uid}/${dateKey}`);
        batch.set(
          dailyRef,
          {
            total: admin.firestore.FieldValue.increment(total),
            byKind: Object.keys(byKind).reduce(
              (acc, kind) => {
                acc[kind] = admin.firestore.FieldValue.increment(byKind[kind]);
                return acc;
              },
              {} as Record<string, admin.firestore.FieldValue>
            ),
            planTier,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Update user_quotas/{uid}
        const quotaRef = db.doc(`user_quotas/${uid}`);
        batch.set(
          quotaRef,
          {
            used: admin.firestore.FieldValue.increment(total),
            perKind: Object.keys(byKind).reduce(
              (acc, kind) => {
                acc[kind] = admin.firestore.FieldValue.increment(byKind[kind]);
                return acc;
              },
              {} as Record<string, admin.firestore.FieldValue>
            ),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Update admin_usage_stats/days/{dateKey}
        const adminStatsRef = db.doc(`admin_usage_stats/days/${dateKey}`);
        batch.set(
          adminStatsRef,
          {
            total: admin.firestore.FieldValue.increment(total),
            byKind: Object.keys(byKind).reduce(
              (acc, kind) => {
                acc[kind] = admin.firestore.FieldValue.increment(byKind[kind]);
                return acc;
              },
              {} as Record<string, admin.firestore.FieldValue>
            ),
            [`byPlan.${planTier}`]: admin.firestore.FieldValue.increment(total),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
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
    } catch (error: any) {
      console.error('[aggregateDailyUsage] Error:', error);
      throw error;
    }
  }
);

/**
 * Report usage to Stripe metered billing (optional)
 */
async function reportToStripeMetered(
  userEvents: Record<string, Array<{ kind: string; amount: number }>>
): Promise<void> {
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
      const customerId = userData?.stripeCustomerId;

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

      const meteredSub = subscriptions.data.find((sub) =>
        sub.items.data.some((item) => item.price.id === meteredPriceId)
      );

      if (!meteredSub) {
        continue; // User doesn't have metered billing subscription
      }

      // Find subscription item with metered price
      const subItem = meteredSub.items.data.find(
        (item) => item.price.id === meteredPriceId
      );

      if (!subItem) {
        continue;
      }

      // Calculate total usage for this billing period
      const totalUsage = events.reduce((sum, e) => sum + e.amount, 0);

      // Report usage to Stripe
      await (stripe.subscriptionItems as any).createUsageRecord(subItem.id, {
        quantity: totalUsage,
        timestamp: Math.floor(Date.now() / 1000),
        action: 'increment',
      });

      console.log(
        `[reportToStripeMetered] Reported ${totalUsage} units for user ${uid}`
      );
    } catch (error: any) {
      console.error(`[reportToStripeMetered] Error for user ${uid}:`, error);
      // Continue processing other users
    }
  }
}

/**
 * Reset daily quotas at midnight UTC
 * Runs once per day at 00:05 UTC
 */
export const resetDailyQuotas = onSchedule(
  {
    schedule: '5 0 * * *', // 00:05 UTC daily
    timeZone: 'UTC',
  },
  async (event) => {
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
      const tomorrow = new Date(Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate() + 1,
        0, 0, 0, 0
      ));

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
    } catch (error: any) {
      console.error('[resetDailyQuotas] Error:', error);
      throw error;
    }
  }
);
