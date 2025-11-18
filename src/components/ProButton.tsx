"use client";

import { useEntitlements } from "@/hooks/useEntitlements";
import { ReactNode } from "react";

interface ProButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * ProButton Component
 *
 * A button that is automatically disabled if user doesn't have active subscription
 *
 * @example
 * ```tsx
 * <ProButton onClick={() => launchProFeature()}>
 *   Launch Pro Feature
 * </ProButton>
 * ```
 */
export function ProButton({
  children,
  onClick,
  className = "",
  disabled = false,
}: ProButtonProps) {
  const entitlements = useEntitlements();

  const isDisabled = disabled || !entitlements?.active;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`rounded-xl border px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title={!entitlements?.active ? "Requires active subscription" : undefined}
    >
      {children}
    </button>
  );
}

/**
 * ProFeatureCard Component
 *
 * A card wrapper that shows upgrade prompt if user doesn't have active subscription
 *
 * @example
 * ```tsx
 * <ProFeatureCard>
 *   <MyProFeature />
 * </ProFeatureCard>
 * ```
 */
export function ProFeatureCard({ children }: { children: ReactNode }) {
  const entitlements = useEntitlements();

  if (!entitlements) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <div className="animate-pulse">Loading subscription...</div>
      </div>
    );
  }

  if (!entitlements.active) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">Pro Feature</h3>
            <p className="mt-1 text-sm text-amber-700">
              This feature requires an active subscription to access.
            </p>
            <a
              href="/pricing"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
            >
              View Plans
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * SubscriptionBadge Component
 *
 * Shows current subscription tier as a badge
 *
 * @example
 * ```tsx
 * <SubscriptionBadge />
 * ```
 */
export function SubscriptionBadge() {
  const entitlements = useEntitlements();

  if (!entitlements) return null;

  const tierColors = {
    free: "bg-slate-100 text-slate-700",
    basic: "bg-blue-100 text-blue-700",
    pro: "bg-indigo-100 text-indigo-700",
  };

  const tierColor = tierColors[entitlements.tier as keyof typeof tierColors] || tierColors.free;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${tierColor}`}>
      {entitlements.active && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {entitlements.tier.charAt(0).toUpperCase() + entitlements.tier.slice(1)}
    </span>
  );
}
