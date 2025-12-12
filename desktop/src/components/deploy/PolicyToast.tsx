// desktop/src/components/deploy/PolicyToast.tsx
// Phase 135.2: Toast notification for policy violations

import React, { useEffect, useState } from 'react';
import type { PolicyStatus, PolicyReason } from '../../lib/quality/policyEngine';
import { getStatusIcon } from '../../lib/quality/policyEngine';

interface Props {
  /** The policy status to display */
  status: PolicyStatus | null;
  /** Reasons for the status */
  reasons: PolicyReason[];
  /** Summary message */
  summary: string;
  summaryAr: string;
  /** Locale for labels */
  locale?: 'ar' | 'en';
  /** Duration in ms before auto-dismiss (0 = no auto-dismiss) */
  duration?: number;
  /** Callback when toast is dismissed */
  onDismiss: () => void;
  /** Callback when toast is clicked to view details */
  onViewDetails?: () => void;
}

/**
 * Toast notification for policy violations
 * Shows when policy evaluation results in CAUTION or BLOCK
 */
export const PolicyToast: React.FC<Props> = ({
  status,
  reasons,
  summary,
  summaryAr,
  locale = 'en',
  duration = 6000,
  onDismiss,
  onViewDetails,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const isArabic = locale === 'ar';

  // Labels
  const labels = {
    viewDetails: isArabic ? 'عرض التفاصيل' : 'View Details',
    dismiss: isArabic ? 'إغلاق' : 'Dismiss',
    caution: isArabic ? 'تحذير' : 'Caution',
    blocked: isArabic ? 'محظور' : 'Blocked',
  };

  // Show/hide animation
  useEffect(() => {
    if (status && status !== 'OK') {
      setIsVisible(true);
      setIsExiting(false);
    }
  }, [status, reasons]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!status || status === 'OK' || duration === 0) return;

    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [status, duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 300);
  };

  const handleViewDetails = () => {
    handleDismiss();
    onViewDetails?.();
  };

  if (!status || status === 'OK' || !isVisible) return null;

  const icon = getStatusIcon(status);
  const displaySummary = isArabic ? summaryAr : summary;

  // Get color classes based on status
  const colorClasses = status === 'BLOCK'
    ? {
        bg: 'bg-gradient-to-br from-red-950/95 to-red-900/90',
        border: 'border-red-500/50',
        glow: 'shadow-[0_0_30px_rgba(239,68,68,0.4)]',
        badge: 'bg-red-500/20 text-red-200 border-red-500/40',
        button: 'bg-red-500/20 hover:bg-red-500/30 text-red-100',
      }
    : {
        bg: 'bg-gradient-to-br from-amber-950/95 to-amber-900/90',
        border: 'border-amber-500/50',
        glow: 'shadow-[0_0_30px_rgba(251,191,36,0.4)]',
        badge: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
        button: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-100',
      };

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-[9999] max-w-sm
        ${colorClasses.bg} ${colorClasses.border} ${colorClasses.glow}
        border rounded-2xl backdrop-blur-md
        transform transition-all duration-300 ease-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      dir={isArabic ? 'rtl' : 'ltr'}
      role="alert"
      aria-live="assertive"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-white">
                {isArabic ? 'فحص الجودة' : 'Quality Check'}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${colorClasses.badge}`}>
                {status === 'BLOCK' ? labels.blocked : labels.caution}
              </span>
            </div>
            <p className="text-[11px] text-white/80 leading-relaxed">
              {displaySummary}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/50 hover:text-white transition-colors p-1"
            aria-label={labels.dismiss}
          >
            ✕
          </button>
        </div>

        {/* Reasons preview (max 2) */}
        {reasons.length > 0 && (
          <div className="space-y-1 mb-3">
            {reasons.slice(0, 2).map((reason, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-[10px] text-white/70"
              >
                <span>{reason.severity === 'critical' ? '🚫' : '⚠️'}</span>
                <span className="truncate">
                  {isArabic ? reason.labelAr : reason.label}
                </span>
              </div>
            ))}
            {reasons.length > 2 && (
              <div className="text-[10px] text-white/50 pl-5">
                {isArabic
                  ? `+${reasons.length - 2} أسباب أخرى`
                  : `+${reasons.length - 2} more reasons`}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onViewDetails && (
            <button
              onClick={handleViewDetails}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${colorClasses.button}`}
            >
              {labels.viewDetails}
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg text-[11px] text-white/60 hover:text-white/80 transition-colors"
          >
            {labels.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PolicyToast;
