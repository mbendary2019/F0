// desktop/src/lib/quality/qualityUtils.ts
// Phase 132.P1: Quality utility functions

export type HealthSeverity = 'good' | 'ok' | 'warning' | 'critical' | 'unknown';

/**
 * Get health severity based on score
 */
export const getHealthSeverity = (score: number | null): HealthSeverity => {
  if (score == null) return 'unknown';
  if (score >= 90) return 'good';
  if (score >= 75) return 'ok';
  if (score >= 60) return 'warning';
  return 'critical';
};

/**
 * Get severity color classes for Tailwind
 */
export const getSeverityColors = (severity: HealthSeverity) => {
  switch (severity) {
    case 'good':
      return {
        ring: 'from-emerald-400/80 via-teal-300/70 to-cyan-300/60',
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/15',
        border: 'border-emerald-500/30',
      };
    case 'ok':
      return {
        ring: 'from-amber-300/80 via-yellow-300/70 to-orange-300/60',
        text: 'text-amber-300',
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/30',
      };
    case 'warning':
      return {
        ring: 'from-orange-400/80 via-amber-400/70 to-yellow-300/60',
        text: 'text-orange-400',
        bg: 'bg-orange-500/15',
        border: 'border-orange-500/30',
      };
    case 'critical':
      return {
        ring: 'from-red-500/90 via-rose-500/80 to-orange-400/80',
        text: 'text-red-400',
        bg: 'bg-red-500/15',
        border: 'border-red-500/30',
      };
    default:
      return {
        ring: 'from-slate-400/60 via-slate-300/50 to-slate-200/40',
        text: 'text-slate-400',
        bg: 'bg-slate-500/15',
        border: 'border-slate-500/30',
      };
  }
};

/**
 * Get severity label
 */
export const getSeverityLabel = (
  severity: HealthSeverity,
  locale: 'en' | 'ar' = 'en'
): string => {
  const labels = {
    good: { en: 'Good', ar: 'ممتاز' },
    ok: { en: 'Stable', ar: 'مستقر' },
    warning: { en: 'Warning', ar: 'تحذير' },
    critical: { en: 'Critical', ar: 'حرج' },
    unknown: { en: 'Unknown', ar: 'غير معروف' },
  };
  return labels[severity][locale];
};
