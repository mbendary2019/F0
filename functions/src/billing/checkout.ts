/**
 * Phase 45 - Stripe Checkout Session Creation
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStripeClient, getAppUrl } from './stripeClient';

const db = admin.firestore();

/**
 * Create Stripe checkout session for subscription
 */
export const createCheckoutSession = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required');
  }

  const priceId: string = request.data?.priceId;
  if (!priceId) {
    throw new HttpsError('invalid-argument', 'priceId required');
  }

  const stripe = getStripeClient();
  const uid = request.auth.uid;
  const email = request.auth.token.email || '';

  // Get or create Stripe customer
  let customerId: string | undefined;
  const userPlanDoc = await db.collection('ops_user_plans').doc(uid).get();
  const stripeState = userPlanDoc.data()?.stripe;

  if (stripeState?.customerId) {
    customerId = stripeState.customerId;
  } else {
    const customer = await stripe.customers.create({
      email,
      metadata: { firebaseUID: uid },
    });
    customerId = customer.id;

    // Save customer ID
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

  // Create checkout session
  const appUrl = getAppUrl();
  const successUrl =
    request.data?.successUrl ||
    `${appUrl}/account/plan?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = request.data?.cancelUrl || `${appUrl}/pricing`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      firebaseUID: uid,
    },
    subscription_data: {
      metadata: {
        firebaseUID: uid,
      },
    },
  });

  console.log(
    `[checkout] Created session ${session.id} for user ${uid}, price ${priceId}`
  );

  return {
    sessionId: session.id,
    url: session.url,
  };
});
