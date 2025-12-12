// desktop/src/components/deploy/QualityOverlay.tsx
// Phase 135.2: Quality Overlay component
// Displays policy status as an overlay on deploy button

import React from 'react';
import type { PolicyStatus } from '../../lib/quality/policyEngine';
import { getStatusIcon, getStatusColorClass, getStatusBgClass } from '../../lib/quality/policyEngine';

interface QualityOverlayProps {
  /** Current policy status */
  status: PolicyStatus;
  /** Locale for labels */
  locale?: 'ar' | 'en';
  /** Whether to show as compact badge */
  compact?: boolean;
  /** Summary text to display */
  summary?: string;
  summaryAr?: string;
  /** Optional click handler */
  onClick?: () => void;
}

/**
 * Quality Overlay - shows policy status as overlay/badge
 * Can be used on deploy button or header
 */
export const QualityOverlay: React.FC<QualityOverlayProps> = ({
  status,
  locale = 'en',
  compact = false,
  summary,
  summaryAr,
  onClick,
}) => {
  const isArabic = locale === 'ar';
  const icon = getStatusIcon(status);

  // Labels
  const labels = {
    OK: isArabic ? 'الجودة ممتازة' : 'Quality OK',
    CAUTION: isArabic ? 'تحذير جودة' : 'Quality Caution',
    BLOCK: isArabic ? 'النشر محظور' : 'Deploy Blocked',
  };

  // Color classes
  const colorClasses = {
    OK: {
      bg: 'bg-emerald-500/20',
      border: 'border-emerald-500/40',
      text: 'text-emerald-200',
      glow: 'shadow-[0_0_12px_rgba(52,211,153,0.3)]',
    },
    CAUTION: {
      bg: 'bg-amber-500/20',
      border: 'border-amber-500/40',
      text: 'text-amber-200',
      glow: 'shadow-[0_0_12px_rgba(251,191,36,0.3)]',
    },
    BLOCK: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/40',
      text: 'text-red-200',
      glow: 'shadow-[0_0_16px_rgba(239,68,68,0.4)]',
      pulse: 'animate-pulse',
    },
  };

  const colors = colorClasses[status];
  const displaySummary = isArabic && summaryAr ? summaryAr : summary;

  if (compact) {
    // Compact badge mode
    return (
      <button
        type="button"
        onClick={onClick}
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
          border transition-all duration-200
          ${colors.bg} ${colors.border} ${colors.text} ${colors.glow}
          ${status === 'BLOCK' ? 'animate-pulse' : ''}
          ${onClick ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
        `}
        disabled={!onClick}
      >
        <span>{icon}</span>
        <span>{labels[status]}</span>
      </button>
    );
  }

  // Full overlay mode
  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-xl border backdrop-blur-sm p-3 transition-all duration-200
        ${colors.bg} ${colors.border} ${colors.glow}
        ${status === 'BLOCK' ? 'animate-pulse' : ''}
        ${onClick ? 'cursor-pointer hover:scale-[1.01]' : ''}
      `}
      role={onClick ? 'button' : 'status'}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className={`text-sm font-semibold ${colors.text}`}>
          {labels[status]}
        </span>
      </div>

      {/* Summary */}
      {displaySummary && (
        <p className={`text-[11px] ${colors.text} opacity-80 leading-relaxed`}>
          {displaySummary}
        </p>
      )}

      {/* Click hint */}
      {onClick && (
        <div className={`mt-2 text-[9px] ${colors.text} opacity-50`}>
          {isArabic ? 'اضغط للتفاصيل' : 'Click for details'}
        </div>
      )}
    </div>
  );
};

/**
 * Deploy Button Overlay - wraps deploy button with quality status
 */
export const DeployButtonOverlay: React.FC<{
  status: PolicyStatus;
  locale?: 'ar' | 'en';
  children: React.ReactNode;
}> = ({ status, locale = 'en', children }) => {
  const isArabic = locale === 'ar';

  // Only show overlay for non-OK status
  if (status === 'OK') {
    return <>{children}</>;
  }

  const overlayColors = status === 'BLOCK'
    ? {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-200',
      }
    : {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-200',
      };

  const icon = getStatusIcon(status);
  const label = status === 'BLOCK'
    ? isArabic ? 'محظور' : 'Blocked'
    : isArabic ? 'تحذير' : 'Caution';

  return (
    <div className="relative">
      {/* Children (the button) */}
      {children}

      {/* Overlay badge */}
      <div
        className={`
          absolute -top-2 -right-2 z-10
          inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium
          border
          ${overlayColors.bg} ${overlayColors.border} ${overlayColors.text}
          ${status === 'BLOCK' ? 'animate-pulse' : ''}
        `}
      >
        <span>{icon}</span>
        <span>{label}</span>
      </div>
    </div>
  );
};

export default QualityOverlay;
