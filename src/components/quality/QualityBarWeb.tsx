// src/components/quality/QualityBarWeb.tsx
// =============================================================================
// Phase 150.1 – Web IDE Quality Bar (synced with Desktop Design)
// Phase 150.2 – Wired to shared types
// Phase 150.6.2 – Loading skeleton support
// =============================================================================
'use client';

import React, { useEffect } from 'react';
import { type QualitySnapshot, type QualityStatus, STATUS_CONFIG } from '@/types/quality';

// Re-export for backward compatibility
export type { QualitySnapshot, QualityStatus };

interface QualityBarWebProps {
  snapshot: QualitySnapshot | null;
  locale?: 'en' | 'ar';
  onOpenEvolution?: () => void;
  /** Phase 150.6.2: Show loading skeleton */
  loading?: boolean;
}

const statusConfig: Record<QualityStatus, { label: string; labelAr: string; bg: string; text: string }> = {
  good: {
    label: 'Good',
    labelAr: 'جيد',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-300',
  },
  caution: {
    label: 'Caution',
    labelAr: 'تحذير',
    bg: 'bg-amber-500/10',
    text: 'text-amber-300',
  },
  needs_work: {
    label: 'Needs work',
    labelAr: 'يحتاج عمل',
    bg: 'bg-red-500/10',
    text: 'text-red-300',
  },
  blocked: {
    label: 'Blocked',
    labelAr: 'محظور',
    bg: 'bg-red-600/15',
    text: 'text-red-400',
  },
};

// =============================================================================
// Phase 150.6.2: Skeleton component for loading state
// =============================================================================
function QualityBarSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-gradient-to-r from-[#1b1028] via-[#140b22] to-[#0b0616] px-4 py-2.5 mb-4 shadow-lg shadow-purple-900/30 animate-pulse">
      {/* Left: Score & Status skeleton */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-16 rounded bg-white/10" />
          <div className="h-5 w-10 rounded bg-white/10" />
        </div>
        <div className="h-4 w-14 rounded-full bg-white/10" />
        <div className="h-3 w-12 rounded bg-white/10" />
      </div>

      {/* Right: Button skeleton */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block h-3 w-48 rounded bg-white/10" />
        <div className="h-7 w-24 rounded-lg bg-purple-600/30" />
      </div>
    </div>
  );
}

export function QualityBarWeb({ snapshot, locale = 'en', onOpenEvolution, loading }: QualityBarWebProps) {
  const score = snapshot?.score ?? 0;
  const status = snapshot?.status ?? 'needs_work';
  const totalIssues = snapshot?.totalIssues ?? 0;
  const isArabic = locale === 'ar';

  const config = statusConfig[status];

  // Phase 150.2: Log quality snapshot for debugging
  useEffect(() => {
    if (snapshot) {
      console.log('[150.2][QUALITY_WEB] Loaded quality snapshot for live page', {
        score: snapshot.score,
        status: snapshot.status,
        totalIssues: snapshot.totalIssues,
        lastScanAt: snapshot.lastScanAt,
      });
    }
  }, [snapshot]);

  // Phase 150.6.2: Show skeleton while loading
  if (loading) {
    return <QualityBarSkeleton />;
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-gradient-to-r from-[#1b1028] via-[#140b22] to-[#0b0616] px-4 py-2.5 mb-4 shadow-lg shadow-purple-900/30">
      {/* Left: Score & Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-white/60">
            {isArabic ? 'صحة الكود' : 'Code health'}
          </span>
          <span className="text-lg font-bold text-white tabular-nums">
            {score}%
          </span>
        </div>

        <span className={`text-[10px] px-2.5 py-0.5 rounded-full ${config.bg} ${config.text} font-medium`}>
          {isArabic ? config.labelAr : config.label}
        </span>

        {totalIssues > 0 && (
          <span className="text-[10px] text-white/50">
            {isArabic ? `${totalIssues} مشكلة` : `${totalIssues} issues`}
          </span>
        )}
      </div>

      {/* Right: Evolution Button + Info */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-[11px] text-white/40">
          {isArabic
            ? 'Desktop & Web يستخدمان نفس محرك الجودة (Phase 149)'
            : 'Desktop & Web use same quality engine (Phase 149).'
          }
        </span>

        {onOpenEvolution && (
          <button
            onClick={onOpenEvolution}
            className="rounded-lg bg-purple-600/80 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-purple-700/40 hover:bg-purple-500 transition flex items-center gap-1.5"
          >
            <span className="text-[13px]">🧬</span>
            {isArabic ? 'تطور الكود' : 'Code Evolution'}
          </button>
        )}
      </div>
    </div>
  );
}

// Export skeleton for external use
export { QualityBarSkeleton };
