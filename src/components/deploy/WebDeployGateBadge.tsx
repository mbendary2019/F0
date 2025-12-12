// src/components/deploy/WebDeployGateBadge.tsx
// =============================================================================
// Phase 150.4.2 – Web Deploy Gate Badge
// Phase 150.6.2 – Loading skeleton support
// Shows current gate status with click to open modal
// =============================================================================
'use client';

import React from 'react';
import {
  type GateStatus,
  getStatusLabel,
} from '@/shared/quality/deployGateEngine';

interface WebDeployGateBadgeProps {
  status: GateStatus;
  onClick?: () => void;
  locale?: 'en' | 'ar';
  className?: string;
  /** Phase 150.6.2: Show loading skeleton */
  loading?: boolean;
}

// =============================================================================
// Phase 150.6.2: Skeleton for loading state
// =============================================================================
function GateBadgeSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded-full px-3 py-1
        border border-white/10 bg-white/5 animate-pulse
        ${className}
      `}
    >
      <div className="h-3 w-3 rounded-full bg-white/10" />
      <div className="h-3 w-12 rounded bg-white/10" />
    </div>
  );
}

/**
 * Badge component showing deploy gate status
 */
export function WebDeployGateBadge({
  status,
  onClick,
  locale = 'en',
  className = '',
  loading,
}: WebDeployGateBadgeProps) {
  // Phase 150.6.2: Show skeleton while loading
  if (loading) {
    return <GateBadgeSkeleton className={className} />;
  }

  const label = getStatusLabel(status, locale);

  const statusConfig = {
    ready: {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-300',
      border: 'border-emerald-500/30',
      icon: '✅',
      glow: 'shadow-emerald-500/20',
    },
    warning: {
      bg: 'bg-amber-500/15',
      text: 'text-amber-300',
      border: 'border-amber-500/30',
      icon: '⚠️',
      glow: 'shadow-amber-500/20',
    },
    blocked: {
      bg: 'bg-red-500/15',
      text: 'text-red-300',
      border: 'border-red-500/30',
      icon: '🚫',
      glow: 'shadow-red-500/20',
    },
  };

  const config = statusConfig[status];

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium
        border transition-all duration-200
        hover:scale-105 hover:shadow-md
        ${config.bg} ${config.text} ${config.border} ${config.glow}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        ${className}
      `}
      title={locale === 'ar' ? 'اضغط لعرض التفاصيل' : 'Click to view details'}
    >
      <span>{config.icon}</span>
      <span>{label}</span>
    </button>
  );
}

// Export skeleton for external use
export { GateBadgeSkeleton };
export default WebDeployGateBadge;
