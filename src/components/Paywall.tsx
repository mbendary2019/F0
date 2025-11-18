'use client';

/**
 * Phase 45 - Paywall Component
 * Shows upgrade prompt when quota exceeded
 */

import { ReactNode } from 'react';
import Link from 'next/link';

interface PaywallProps {
  quotaExceeded: boolean;
  dailyQuota: number;
  usedToday: number;
  children: ReactNode;
}

export default function Paywall({
  quotaExceeded,
  dailyQuota,
  usedToday,
  children,
}: PaywallProps) {
  if (!quotaExceeded) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="max-w-md p-8 bg-white rounded-lg shadow-lg border-2 border-purple-200">
        <div className="text-center mb-6">
          <div className="inline-block p-3 bg-purple-100 rounded-full mb-4">
            <svg
              className="w-12 h-12 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Daily Quota Exceeded
          </h2>
          <p className="text-gray-600">
            You've used {usedToday} out of {dailyQuota} tokens today.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/pricing"
            className="block w-full py-3 px-6 text-center bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            View Pricing Plans
          </Link>

          <p className="text-sm text-gray-500 text-center">
            Your quota will reset at midnight Kuwait time (Asia/Kuwait)
          </p>
        </div>
      </div>
    </div>
  );
}
