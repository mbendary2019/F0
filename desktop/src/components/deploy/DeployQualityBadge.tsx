// desktop/src/components/deploy/DeployQualityBadge.tsx
// Phase 134.1: Deploy Quality Badge for Header

'use client';

import React from 'react';
import clsx from 'clsx';
import { useDeployQuality } from '../../state/deployQualityContext';
import {
  getDeployLevelColors,
  getDeployLevelLabel,
} from '../../lib/deploy/deployQualityTypes';

interface DeployQualityBadgeProps {
  /** Locale for labels */
  locale?: 'en' | 'ar';
  /** Click handler - typically opens pre-deploy modal */
  onClick?: () => void;
  /** Show compact version (icon only) */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * DeployQualityBadge
 * Shows current deploy quality status in the header
 * Clicking opens the pre-deploy checklist modal
 */
export const DeployQualityBadge: React.FC<DeployQualityBadgeProps> = ({
  locale = 'en',
  onClick,
  compact = false,
  className,
}) => {
  const { snapshot, isLoading } = useDeployQuality();

  // Loading state
  if (isLoading) {
    return (
      <div
        className={clsx(
          'flex items-center gap-1.5 rounded-md px-2 py-1',
          'bg-zinc-700/50 animate-pulse',
          className
        )}
      >
        <span className="text-xs text-zinc-400">⏳</span>
        {!compact && (
          <span className="text-xs text-zinc-400">Checking...</span>
        )}
      </div>
    );
  }

  // No snapshot yet
  if (!snapshot) {
    return (
      <div
        className={clsx(
          'flex items-center gap-1.5 rounded-md px-2 py-1',
          'bg-zinc-700/30 border border-zinc-600/30',
          'cursor-pointer hover:bg-zinc-700/50 transition-colors',
          className
        )}
        onClick={onClick}
        title="No quality data available"
      >
        <span className="text-xs">❓</span>
        {!compact && (
          <span className="text-xs text-zinc-400">No Data</span>
        )}
      </div>
    );
  }

  const colors = getDeployLevelColors(snapshot.level);
  const label = getDeployLevelLabel(snapshot.level, locale);

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 rounded-md px-2 py-1',
        'border transition-all duration-200',
        colors.bg,
        colors.border,
        'hover:brightness-110 cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-zinc-900',
        snapshot.level === 'clean' && 'focus:ring-emerald-500/50',
        snapshot.level === 'risky' && 'focus:ring-amber-500/50',
        snapshot.level === 'blocked' && 'focus:ring-red-500/50',
        className
      )}
      title={`${label} - ${snapshot.reasons.length} issue(s)`}
    >
      {/* Icon */}
      <span className="text-sm">{colors.icon}</span>

      {/* Label (if not compact) */}
      {!compact && (
        <span className={clsx('text-xs font-medium', colors.text)}>
          {label}
        </span>
      )}

      {/* Issue count badge */}
      {snapshot.reasons.length > 0 && (
        <span
          className={clsx(
            'ml-0.5 min-w-[16px] rounded-full px-1 py-0.5',
            'text-[10px] font-bold text-center',
            snapshot.level === 'blocked'
              ? 'bg-red-500/40 text-red-100'
              : 'bg-amber-500/40 text-amber-100'
          )}
        >
          {snapshot.reasons.length}
        </span>
      )}
    </button>
  );
};

export default DeployQualityBadge;
