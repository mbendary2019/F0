/**
 * Phase 45 - Stripe Customer Portal
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import Stripe from 'stripe';

const db = admin.firestore();

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  return new Stripe(secretKey, { apiVersion: '2023-10-16' });
}

/**
 * Create Stripe customer portal session
 */
export const createPortalSession = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required');
  }

  const uid = request.auth.uid;

  // Get Stripe customer ID
  const userPlanDoc = await db.collection('ops_user_plans').doc(uid).get();
  const customerId = userPlanDoc.data()?.stripe?.customerId;

  if (!customerId) {
    throw new HttpsError('failed-precondition', 'No Stripe customer found');
  }

  const stripe = getStripeClient();
  const appUrl = process.env.APP_URL || 'https://from-zero-84253.web.app';
  const returnUrl = request.data?.returnUrl || `${appUrl}/account/plan`;

  // Create portal session
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  console.log(`[portal] Created portal session for user ${uid}`);

  return {
    url: session.url,
  };
});
