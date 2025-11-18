/**
 * Phase 45 - Shared Stripe Client
 */

import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });
  }
  return stripeInstance;
}

export function getAppUrl(): string {
  return process.env.APP_URL || 'https://from-zero-84253.web.app';
}
