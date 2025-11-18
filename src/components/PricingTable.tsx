'use client';

/**
 * Phase 45 - Pricing Table Component
 */

import { useState } from 'react';

interface Plan {
  id: string;
  title: string;
  price: number;
  interval: string;
  stripePriceId: string;
  limits: {
    dailyQuota: number;
    marketplacePaid: boolean;
  };
  entitlements: string[];
}

interface PricingTableProps {
  plans: Plan[];
  onSelectPlan: (priceId: string) => void;
  currentPlan?: string;
}

export default function PricingTable({
  plans,
  onSelectPlan,
  currentPlan = 'trial',
}: PricingTableProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelect = async (priceId: string) => {
    setLoading(priceId);
    try {
      await onSelectPlan(priceId);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {plans.map((plan) => {
        const isCurrent = plan.id === currentPlan;
        const isTrial = plan.id === 'trial';

        return (
          <div
            key={plan.id}
            className={`
              rounded-lg border-2 p-6 flex flex-col
              ${isCurrent ? 'border-purple-600 bg-purple-50' : 'border-gray-200'}
            `}
          >
            <div className="mb-4">
              <h3 className="text-2xl font-bold">{plan.title}</h3>
              {isCurrent && (
                <span className="inline-block mt-2 px-3 py-1 text-xs font-semibold text-purple-700 bg-purple-200 rounded-full">
                  Current Plan
                </span>
              )}
            </div>

            <div className="mb-6">
              <div className="text-4xl font-bold">
                ${plan.price}
                <span className="text-lg font-normal text-gray-600">
                  /{plan.interval}
                </span>
              </div>
            </div>

            <ul className="mb-8 space-y-3 flex-grow">
              <li className="flex items-start">
                <svg
                  className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  {plan.limits.dailyQuota.toLocaleString()} tokens/day
                </span>
              </li>

              {plan.limits.marketplacePaid && (
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Access paid marketplace items</span>
                </li>
              )}

              {plan.entitlements.map((ent) => (
                <li key={ent} className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="capitalize">{ent.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelect(plan.stripePriceId)}
              disabled={isCurrent || isTrial || loading === plan.stripePriceId}
              className={`
                w-full py-3 px-6 rounded-lg font-semibold transition-colors
                ${
                  isCurrent || isTrial
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : loading === plan.stripePriceId
                    ? 'bg-purple-400 text-white cursor-wait'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }
              `}
            >
              {loading === plan.stripePriceId
                ? 'Processing...'
                : isCurrent
                ? 'Current Plan'
                : isTrial
                ? 'Free'
                : 'Upgrade'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
