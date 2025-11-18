/**
 * Phase 45 - Stripe Server-Side Helper
 */

import Stripe from 'stripe';

// Initialize Stripe with appropriate key based on environment
const getStripeKey = () => {
  if (process.env.STRIPE_SECRET_KEY) {
    return process.env.STRIPE_SECRET_KEY;
  }

  // Fallback to test key if no key is set
  console.warn('[stripe] No STRIPE_SECRET_KEY found, using empty key');
  return '';
};

export const stripe = new Stripe(getStripeKey(), {
  apiVersion: '2024-06-20',
});

/**
 * Check if we're in test mode
 */
export const isTestMode = () => {
  const key = getStripeKey();
  return key.startsWith('sk_test_');
};

/**
 * Get publishable key for client-side
 */
export const getPublishableKey = () => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
};
