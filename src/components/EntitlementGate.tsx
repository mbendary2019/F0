'use client';

/**
 * Phase 45 - Entitlement Gate Component
 * Conditionally renders content based on user entitlements
 */

import { ReactNode } from 'react';
import Link from 'next/link';

interface EntitlementGateProps {
  required: string;
  userEntitlements: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export default function EntitlementGate({
  required,
  userEntitlements,
  children,
  fallback,
}: EntitlementGateProps) {
  const hasAccess = userEntitlements.includes(required);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="max-w-sm p-6 bg-gray-50 rounded-lg border-2 border-gray-200 text-center">
        <div className="inline-block p-3 bg-gray-200 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-gray-600"
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

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Premium Feature
        </h3>

        <p className="text-gray-600 mb-4">
          This feature requires the <strong>{required}</strong> entitlement.
        </p>

        <Link
          href="/pricing"
          className="inline-block py-2 px-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
        >
          Upgrade Plan
        </Link>
      </div>
    </div>
  );
}
