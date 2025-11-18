// src/config/plans.ts
// Phase 77: Token Usage Tracking & Plan Limits

export type PlanTier = 'free' | 'simple' | 'pro' | 'ultimate';

export type ModelAccess = 'mini' | 'gpt-4o' | 'gpt-4o-mini' | 'local' | 'all';

export interface PlanLimits {
  name: string;
  monthlyTokenLimit: number;
  dailyTokenLimit: number;
  modelAccess: ModelAccess[];
  price: number; // USD per month
  features: string[];
}

export const PLANS: Record<PlanTier, PlanLimits> = {
  free: {
    name: 'Free',
    monthlyTokenLimit: 50_000,
    dailyTokenLimit: 5_000,
    modelAccess: ['gpt-4o-mini', 'local'],
    price: 0,
    features: [
      'Basic AI assistance',
      'GPT-4o Mini model',
      'Local model fallback',
      '50K tokens/month',
      '5K tokens/day',
    ],
  },

  simple: {
    name: 'Simple',
    monthlyTokenLimit: 200_000,
    dailyTokenLimit: 15_000,
    modelAccess: ['gpt-4o-mini', 'local'],
    price: 19,
    features: [
      'Enhanced AI assistance',
      'GPT-4o Mini model',
      'Local model fallback',
      '200K tokens/month',
      '15K tokens/day',
      'Priority support',
    ],
  },

  pro: {
    name: 'Pro',
    monthlyTokenLimit: 800_000,
    dailyTokenLimit: 80_000,
    modelAccess: ['gpt-4o-mini', 'gpt-4o', 'local'],
    price: 49,
    features: [
      'Full AI assistance',
      'GPT-4o + GPT-4o Mini',
      'Local model fallback',
      '800K tokens/month',
      '80K tokens/day',
      'Advanced features',
      'Priority support',
    ],
  },

  ultimate: {
    name: 'Ultimate',
    monthlyTokenLimit: 3_000_000,
    dailyTokenLimit: 300_000,
    modelAccess: ['all'],
    price: 149,
    features: [
      'Unlimited AI models',
      'All GPT models',
      'Claude integration',
      'Local models',
      '3M tokens/month',
      '300K tokens/day',
      'All features',
      'Dedicated support',
    ],
  },
};

/**
 * Get plan tier for a project (default: free)
 */
export function getPlanTier(planName?: string): PlanTier {
  if (!planName) return 'free';
  const normalized = planName.toLowerCase();
  if (normalized in PLANS) return normalized as PlanTier;
  return 'free';
}

/**
 * Get plan limits for a tier
 */
export function getPlanLimits(tier: PlanTier): PlanLimits {
  return PLANS[tier];
}

/**
 * Check if a model is allowed for a plan tier
 */
export function isModelAllowed(tier: PlanTier, model: string): boolean {
  const plan = PLANS[tier];
  if (plan.modelAccess.includes('all')) return true;

  // Map model names to access levels
  if (model.includes('gpt-4o-mini')) return plan.modelAccess.includes('gpt-4o-mini');
  if (model.includes('gpt-4o')) return plan.modelAccess.includes('gpt-4o');
  if (model.includes('local')) return plan.modelAccess.includes('local');

  // Default: allow mini models
  return plan.modelAccess.includes('gpt-4o-mini');
}

/**
 * Get usage percentage
 */
export function getUsagePercentage(used: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min(100, (used / limit) * 100);
}

/**
 * Check if usage is approaching limit (> 80%)
 */
export function isApproachingLimit(used: number, limit: number): boolean {
  return getUsagePercentage(used, limit) > 80;
}

/**
 * Check if usage exceeded limit
 */
export function isLimitExceeded(used: number, limit: number): boolean {
  return used >= limit;
}
