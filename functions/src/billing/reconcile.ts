/**
 * Phase 45.2 - Nightly Subscription Reconciliation
 * Ensures Firebase entitlements match Stripe subscription state
 * Updated to Firebase Functions v2
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { getStripeClient } from './stripeClient';
import { getPlanByPriceId } from './plans';
import { grantPlan, revokeSubscription, setStripeState } from './entitlements';

const db = admin.firestore();

/**
 * Scheduled reconciliation - runs nightly at 3 AM Asia/Kuwait
 */
export const reconcileSubscriptions = onSchedule({
  schedule: '0 3 * * *',
  timeZone: 'Asia/Kuwait',
  retryCount: 3,
  memory: '256MiB',
  timeoutSeconds: 540, // 9 minutes
}, async () => {
  const stripe = getStripeClient();
  logger.info('[reconcile] Starting nightly reconciliation');

  let reconciled = 0;
  let errors = 0;

  // Get all users with Stripe state
  const snapshot = await db
    .collection('ops_user_plans')
    .where('stripe.subscriptionId', '!=', null)
    .get();

  for (const doc of snapshot.docs) {
    const uid = doc.id;
    const data = doc.data();
    const subscriptionId = data.stripe?.subscriptionId;

    if (!subscriptionId) continue;

    try {
      // Fetch current subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price.id;
      const status = subscription.status;
      const isActive = ['active', 'trialing'].includes(status);

      logger.info('[reconcile] User subscription check', {
        uid,
        subscriptionId,
        status,
      });

      if (isActive && priceId) {
        // Should have entitlements
        const plan = await getPlanByPriceId(priceId);
        if (!plan) {
          logger.error('[reconcile] Unknown price ID', { priceId, uid });
          errors++;
          continue;
        }

        // Check if entitlements match
        const currentPlan = data.plan;
        if (currentPlan !== plan.id) {
          logger.info('[reconcile] Fixing plan mismatch', {
            uid,
            currentPlan,
            newPlan: plan.id,
          });
          await grantPlan(uid, plan);
        }

        // Update Stripe state
        await setStripeState(uid, {
          customerId: subscription.customer as string,
          subscriptionId: subscription.id,
          priceId,
          status,
        });

        reconciled++;
      } else {
        // Should NOT have entitlements
        if (data.plan !== 'trial') {
          logger.info('[reconcile] Revoking inactive subscription', { uid });
          await revokeSubscription(uid);
        }

        // Update status
        await setStripeState(uid, {
          customerId: subscription.customer as string,
          subscriptionId: subscription.id,
          status,
        });

        reconciled++;
      }
    } catch (err: any) {
      logger.error('[reconcile] Error processing user', {
        uid,
        error: err.message,
      });
      errors++;
    }
  }

  logger.info('[reconcile] Reconciliation complete', {
    reconciled,
    errors,
  });

  // Log reconciliation event
  await db.collection('ops_audit').add({
    action: 'reconcile_subscriptions',
    reconciled,
    errors,
    ts: admin.firestore.FieldValue.serverTimestamp(),
  });
});
