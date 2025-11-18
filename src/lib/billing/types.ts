// F0 Billing v2 - Type Definitions

export type Plan = 'free' | 'pro' | 'team' | 'enterprise';

export interface PlanDetails {
  id: Plan;
  name: string;
  monthlyCredits: number;
  overageRate: number; // $ per credit
  basePrice: number; // $ per month
  stripePriceId?: string;
  features: string[];
}

export const PLANS: Record<Plan, PlanDetails> = {
  free: {
    id: 'free',
    name: 'Free',
    monthlyCredits: 1000,
    overageRate: 0,
    basePrice: 0,
    features: ['1,000 credits/month', 'Basic AI features', 'Community support'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyCredits: 25000,
    overageRate: 0.0002,
    basePrice: 29,
    features: [
      '25,000 credits/month',
      '$0.0002/credit overage',
      'Advanced AI features',
      'Priority support',
      'Deploy automation',
    ],
  },
  team: {
    id: 'team',
    name: 'Team',
    monthlyCredits: 120000,
    overageRate: 0.00016,
    basePrice: 99,
    features: [
      '120,000 credits/month',
      '$0.00016/credit overage',
      'All Pro features',
      'Team collaboration',
      'Advanced analytics',
      'Dedicated support',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyCredits: 1000000,
    overageRate: 0.0001,
    basePrice: 0, // Custom pricing
    features: [
      'Custom credits',
      'Volume discounts',
      'White-label options',
      'SLA guarantee',
      'On-premise deployment',
      '24/7 phone support',
    ],
  },
};

export interface CreditSink {
  id: string;
  name: string;
  creditCost: number;
  unit?: string; // e.g., "per 1k tokens", "per image", "per deploy"
}

export const CREDIT_SINKS: Record<string, CreditSink> = {
  'generate.code': {
    id: 'generate.code',
    name: 'Code Generation',
    creditCost: 30,
    unit: 'per 1k tokens',
  },
  'generate.image': {
    id: 'generate.image',
    name: 'Image Generation',
    creditCost: 200,
    unit: 'per image',
  },
  'deploy.run': {
    id: 'deploy.run',
    name: 'Deployment Execution',
    creditCost: 50,
    unit: 'per deploy',
  },
  'ai.review': {
    id: 'ai.review',
    name: 'AI Code Review',
    creditCost: 100,
    unit: 'per review',
  },
  'ai.chat': {
    id: 'ai.chat',
    name: 'AI Chat',
    creditCost: 10,
    unit: 'per message',
  },
  'extension.run': {
    id: 'extension.run',
    name: 'Extension Execution',
    creditCost: 25,
    unit: 'per run',
  },
};

export interface UserCredits {
  available: number;
  used: number;
  renewedAt: number; // timestamp
  plan: Plan;
}

export interface UsageCounter {
  sinkId: string;
  count: number;
  credits: number;
}

export interface DailyUsage {
  date: string; // YYYYMMDD
  counters: Record<string, UsageCounter>;
  totalCredits: number;
}


