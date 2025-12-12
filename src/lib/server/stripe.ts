/**
 * Phase 45 - Stripe Server-Side Helper
 * Updated with Billing System integration
 */

import Stripe from 'stripe';
import type { BillingPlan, PlanConfig } from '@/types/billing';

// Lazy initialization of Stripe to avoid build-time errors
let _stripe: Stripe | null = null;

function getStripeInstance(): Stripe {
  if (_stripe) {
    return _stripe;
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('[stripe] STRIPE_SECRET_KEY is not configured');
  }

  _stripe = new Stripe(key, {
    apiVersion: '2024-12-18.acacia',
    typescript: true,
  });

  return _stripe;
}

// Export stripe as a getter to enable lazy initialization
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    const instance = getStripeInstance();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

/**
 * Check if we're in test mode
 */
export const isTestMode = () => {
  const key = process.env.STRIPE_SECRET_KEY || '';
  return key.startsWith('sk_test_');
};

/**
 * Get publishable key for client-side
 */
export const getPublishableKey = () => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
};

/**
 * Plan configurations with entitlements
 */
export const PLAN_CONFIGS: Record<BillingPlan, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    nameAr: 'مجاني',
    priceMonthly: 0,
    stripePriceId: null,
    entitlements: {
      maxProjects: 1,
      maxIdeJobsPerDay: 5,
      maxTokensPerMonth: 10000,
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    nameAr: 'المبتدئ',
    priceMonthly: 900, // $9.00
    stripePriceId: process.env.F0_STRIPE_PRICE_STARTER || '',
    entitlements: {
      maxProjects: 5,
      maxIdeJobsPerDay: 50,
      maxTokensPerMonth: 100000,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    nameAr: 'المحترف',
    priceMonthly: 2900, // $29.00
    stripePriceId: process.env.F0_STRIPE_PRICE_PRO || '',
    entitlements: {
      maxProjects: 20,
      maxIdeJobsPerDay: 200,
      maxTokensPerMonth: 500000,
    },
  },
  ultimate: {
    id: 'ultimate',
    name: 'Ultimate',
    nameAr: 'النهائي',
    priceMonthly: 9900, // $99.00
    stripePriceId: process.env.F0_STRIPE_PRICE_ULTIMATE || '',
    entitlements: {
      maxProjects: 999,
      maxIdeJobsPerDay: 1000,
      maxTokensPerMonth: 5000000,
    },
  },
};

/**
 * Get plan configuration by ID
 */
export function getPlanConfig(planId: BillingPlan): PlanConfig {
  return PLAN_CONFIGS[planId];
}

/**
 * Create a Stripe checkout session
 */
export async function createCheckoutSession(params: {
  plan: Exclude<BillingPlan, 'free'>;
  userId: string;
  userEmail?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const { plan, userId, userEmail, successUrl, cancelUrl } = params;

  const planConfig = getPlanConfig(plan);

  if (!planConfig.stripePriceId) {
    throw new Error(`No Stripe price ID configured for plan: ${plan}`);
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: planConfig.stripePriceId,
        quantity: 1,
      },
    ],
    customer_email: userEmail,
    client_reference_id: userId, // Link session to user
    metadata: {
      userId,
      plan,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  });

  return session;
}

/**
 * Retrieve a checkout session by ID
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'customer'],
  });
}

/**
 * Extract billing info from completed checkout session
 */
export function extractBillingFromSession(session: Stripe.Checkout.Session): {
  plan: BillingPlan;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currentPeriodEnd: string;
} {
  const plan = session.metadata?.plan as BillingPlan;
  const subscription = session.subscription as Stripe.Subscription;

  if (!plan) {
    throw new Error('No plan found in session metadata');
  }

  if (!subscription) {
    throw new Error('No subscription found in session');
  }

  const stripeCustomerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id || '';

  const stripeSubscriptionId =
    typeof subscription === 'string' ? subscription : subscription.id;

  const currentPeriodEnd = new Date(
    subscription.current_period_end * 1000
  ).toISOString();

  return {
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    currentPeriodEnd,
  };
}
