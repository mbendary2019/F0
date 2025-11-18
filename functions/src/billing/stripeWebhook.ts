/**
 * Phase 45 - Stripe Webhook Handler
 */

import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { getStripeClient } from './stripeClient';
import { getPlanByPriceId } from './plans';
import { grantPlan, setStripeState, revokeSubscription } from './entitlements';

const db = admin.firestore();

/**
 * Handle Stripe webhook events
 */
export const stripeWebhook = onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!sig || !endpointSecret) {
    console.error('[webhook] Missing signature or secret');
    res.status(400).send('Webhook signature missing');
    return;
  }

  const stripe = getStripeClient();
  let event: any;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      endpointSecret
    );
  } catch (err: any) {
    console.error(`[webhook] Signature verification failed: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  console.log(`[webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error(`[webhook] Error handling ${event.type}:`, err);
    res.status(500).send(`Webhook handler failed: ${err.message}`);
  }
});

/**
 * Handle successful checkout
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const uid = session.metadata?.firebaseUID;
  if (!uid) {
    console.error('[webhook] No firebaseUID in checkout session metadata');
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  console.log(`[webhook] Checkout completed for user ${uid}, sub ${subscriptionId}`);

  // Subscription will be handled by subscription.created event
  // Just save customer ID if not already saved
  await db
    .collection('ops_user_plans')
    .doc(uid)
    .set(
      {
        stripe: { customerId },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

/**
 * Handle subscription created/updated
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const uid = subscription.metadata?.firebaseUID;
  if (!uid) {
    console.error('[webhook] No firebaseUID in subscription metadata');
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    console.error('[webhook] No price ID in subscription');
    return;
  }

  const plan = await getPlanByPriceId(priceId);
  if (!plan) {
    console.error(`[webhook] Unknown price ID: ${priceId}`);
    return;
  }

  const status = subscription.status;
  const isActive = ['active', 'trialing'].includes(status);

  console.log(
    `[webhook] Subscription ${subscription.id} for user ${uid}: ${status}`
  );

  if (isActive) {
    // Grant plan and entitlements
    await grantPlan(uid, plan);
    await setStripeState(uid, {
      customerId: subscription.customer as string,
      subscriptionId: subscription.id,
      priceId,
      status,
    });

    // Log billing event
    await db.collection('billing_events').add({
      uid,
      type: 'subscription_activated',
      plan: plan.id,
      subscriptionId: subscription.id,
      status,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    // Revoke if not active
    await revokeSubscription(uid);
    await setStripeState(uid, {
      customerId: subscription.customer as string,
      subscriptionId: subscription.id,
      priceId,
      status,
    });

    // Log billing event
    await db.collection('billing_events').add({
      uid,
      type: 'subscription_deactivated',
      plan: plan.id,
      subscriptionId: subscription.id,
      status,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const uid = subscription.metadata?.firebaseUID;
  if (!uid) {
    console.error('[webhook] No firebaseUID in subscription metadata');
    return;
  }

  console.log(`[webhook] Subscription ${subscription.id} deleted for user ${uid}`);

  await revokeSubscription(uid);
  await setStripeState(uid, {
    customerId: subscription.customer as string,
    status: 'canceled',
  });

  // Log billing event
  await db.collection('billing_events').add({
    uid,
    type: 'subscription_canceled',
    subscriptionId: subscription.id,
    status: 'canceled',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const uid = invoice.subscription_details?.metadata?.firebaseUID;
  if (!uid) {
    console.log('[webhook] No firebaseUID in invoice metadata, skipping');
    return;
  }

  console.log(`[webhook] Invoice ${invoice.id} paid for user ${uid}`);

  // Log invoice record
  await db.collection('billing_invoices').doc(invoice.id).set({
    uid,
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription as string,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: 'paid',
    paidAt: admin.firestore.Timestamp.fromMillis(invoice.status_transitions.paid_at! * 1000),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Handle failed invoice payment
 */
async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const uid = invoice.subscription_details?.metadata?.firebaseUID;
  if (!uid) {
    console.log('[webhook] No firebaseUID in invoice metadata, skipping');
    return;
  }

  console.log(`[webhook] Invoice ${invoice.id} payment failed for user ${uid}`);

  // Log invoice record
  await db.collection('billing_invoices').doc(invoice.id).set({
    uid,
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription as string,
    amount: invoice.amount_due,
    currency: invoice.currency,
    status: 'failed',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log billing event
  await db.collection('billing_events').add({
    uid,
    type: 'payment_failed',
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription as string,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
