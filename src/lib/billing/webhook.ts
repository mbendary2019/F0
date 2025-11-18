// F0 Billing v2 - Stripe Webhook Handler

import Stripe from 'stripe';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { creditsManager } from './credits';
import type { Plan } from './types';

const db = getFirestore();

/**
 * Process Stripe webhook events with idempotency
 */
export async function processStripeWebhook(event: Stripe.Event): Promise<void> {
  // Check if event already processed
  const processedRef = db.collection('billing').doc('processed').collection('events').doc(event.id);
  const processedDoc = await processedRef.get();

  if (processedDoc.exists) {
    console.log(`Event ${event.id} already processed, skipping`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark event as processed
    await processedRef.set({
      eventId: event.id,
      eventType: event.type,
      processedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error(`Error processing event ${event.id}:`, error);
    throw error;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const uid = session.metadata?.uid || session.client_reference_id;
  if (!uid) {
    console.error('No user ID in checkout session metadata');
    return;
  }

  // Extract plan from metadata or line items
  const plan = (session.metadata?.plan as Plan) || 'pro';

  // Update user's plan and refill credits
  await db.collection('users').doc(uid).update({
    'credits.plan': plan,
    subscriptionId: session.subscription,
    customerId: session.customer,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await creditsManager.refillCredits(uid, plan);

  console.log(`Checkout completed for user ${uid}, plan: ${plan}`);
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const uid = subscription.metadata?.uid;
  if (!uid) {
    console.error('No user ID in subscription metadata');
    return;
  }

  const plan = (subscription.metadata?.plan as Plan) || 'pro';

  await db.collection('users').doc(uid).update({
    'credits.plan': plan,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Refill credits on subscription renewal
  if (subscription.status === 'active') {
    await creditsManager.refillCredits(uid, plan);
  }

  console.log(`Subscription updated for user ${uid}, status: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const uid = subscription.metadata?.uid;
  if (!uid) {
    console.error('No user ID in subscription metadata');
    return;
  }

  // Downgrade to free plan
  await db.collection('users').doc(uid).update({
    'credits.plan': 'free',
    subscriptionId: null,
    subscriptionStatus: 'canceled',
    updatedAt: FieldValue.serverTimestamp(),
  });

  await creditsManager.refillCredits(uid, 'free');

  console.log(`Subscription canceled for user ${uid}, downgraded to free`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const uid = invoice.metadata?.uid || invoice.subscription_details?.metadata?.uid;
  if (!uid) {
    return;
  }

  // Log successful payment
  await db.collection('billing').doc('invoices').collection('paid').add({
    uid,
    invoiceId: invoice.id,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    paidAt: FieldValue.serverTimestamp(),
  });

  console.log(`Invoice paid for user ${uid}, amount: ${invoice.amount_paid}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const uid = invoice.metadata?.uid || invoice.subscription_details?.metadata?.uid;
  if (!uid) {
    return;
  }

  // Log failed payment and lock features if necessary
  await db.collection('billing').doc('invoices').collection('failed').add({
    uid,
    invoiceId: invoice.id,
    amount: invoice.amount_due,
    currency: invoice.currency,
    failedAt: FieldValue.serverTimestamp(),
  });

  // Optional: Lock certain features until payment is resolved
  await db.collection('users').doc(uid).update({
    paymentFailed: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Invoice payment failed for user ${uid}, amount: ${invoice.amount_due}`);
}


