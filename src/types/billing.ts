/**
 * Billing System Types
 * Stripe integration with 4-tier pricing (free, starter, pro, ultimate)
 */

export type BillingPlan = 'free' | 'starter' | 'pro' | 'ultimate';

/**
 * Entitlements: What each plan allows
 */
export interface PlanEntitlements {
  maxProjects: number;
  maxIdeJobsPerDay: number;
  maxTokensPerMonth: number;
}

/**
 * Plan configuration with Stripe price IDs
 */
export interface PlanConfig {
  id: BillingPlan;
  name: string;
  nameAr: string;
  priceMonthly: number; // USD cents (e.g., 900 = $9.00)
  stripePriceId: string | null; // null for free plan
  entitlements: PlanEntitlements;
}

/**
 * User billing document stored in Firestore
 * Collection: users/{uid}/billing
 */
export interface UserBilling {
  uid: string;
  plan: BillingPlan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string; // ISO date
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create checkout session
 */
export interface CreateCheckoutSessionRequest {
  plan: Exclude<BillingPlan, 'free'>; // Can't checkout for free plan
  successUrl: string;
  cancelUrl: string;
}

/**
 * Response from create checkout session
 */
export interface CreateCheckoutSessionResponse {
  sessionId: string;
  url: string; // Stripe checkout URL
}

/**
 * Request to confirm billing after checkout
 */
export interface ConfirmBillingRequest {
  sessionId: string;
}

/**
 * Response from confirm billing
 */
export interface ConfirmBillingResponse {
  success: boolean;
  plan: BillingPlan;
  message?: string;
}
