// desktop/src/components/deploy/PreDeployQualityStory.tsx
// Phase 140.7: Pre-Deploy Quality Story Component
// Phase 140.8: Enhanced with unified layout - Timeline + Events + Weekly Summary
// Phase 140.9: Micro Polish & Animations - Glassmorphism, hover effects, cleaner layouts
// Phase 140.10: Quality Narrative Engine integration
// Phase 140.11: Enhanced polish - Icons, dividers, f0-quality-bar-last animation
// Phase 145.6: ACE Agent Activity section with telemetry data
// Phase 145.P.1: ACE Activity Card Polish - Narratives, Badges, Animations
// Phase 145.P.3: Telemetry Timestamp Formatting - Relative time display
// Phase 145.P.4: Quality Story Layout + Tooltip - Auto-Fix Engine title
// Phase 145.P.5: Performance Polish - React.memo + useMemo optimizations
// Phase 146.5: Diagnostics Hotspots Card - Worst files by risk score
// Self-contained component with all sub-components

'use client';

import * as React from 'react';
import { useRef, useCallback } from 'react';
import clsx from 'clsx';
import { useQualityStoryEvents } from '../../hooks/useQualityStoryEvents';
import { buildQualityNarrative } from '../../features/quality/qualityNarrativeEngine';
import type { QualityStatus, QualityNarrativeSection, NarrativeHighlight } from '../../types/qualityStory';
// Phase 145.6: ACE Telemetry
import { useAceTelemetry, type AceRun } from '../../contexts/aceTelemetryContext';
// Phase 146.5: Diagnostics Context for file-level risk
import { useDiagnosticsSafe } from '../../contexts/diagnosticsContext';
import type { FileDiagnostics, RiskLevel } from '../../lib/quality/diagnosticsTypes';

type QualityStorySnapshot = any;

// ============================================
// Phase 145.P.3: Telemetry Timestamp Formatting
// Human-readable relative time display
// ============================================

function formatAceTimestamp(isoString: string, locale: Locale): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    return locale === 'ar' ? 'غير معروف' : 'Unknown';
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

  // Within last hour
  if (diffMins < 60) {
    if (diffMins < 1) {
      return locale === 'ar' ? 'الآن' : 'Just now';
    }
    return locale === 'ar'
      ? `منذ ${diffMins} دقيقة`
      : `${diffMins}m ago`;
  }

  // Within last 24 hours
  if (diffHours < 24) {
    return locale === 'ar'
      ? `منذ ${diffHours} ساعة`
      : `${diffHours}h ago`;
  }

  // Fallback: show time only
  return date.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

type QualityStoryEvent = {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: string | Date;
  health?: number | null;
  coverage?: number | null;
  issues?: number | null;
  securityLevel?: 'none' | 'warning' | 'blocking';
};

type Locale = 'en' | 'ar';

interface PreDeployQualityStoryProps {
  locale?: Locale;
  status?: QualityStatus;
}

export const PreDeployQualityStory: React.FC<PreDeployQualityStoryProps> = ({
  locale = 'en',
  status = 'OK',
}) => {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const { snapshots: storySnapshots, events } = useQualityStoryEvents();
  const hasData = storySnapshots && storySnapshots.length > 0;

  // Phase 145.6: Get ACE telemetry runs
  const { runs: aceRuns } = useAceTelemetry();

  // Phase 145.6: Filter ACE runs from last 48 hours
  const aceRunsLast48h = React.useMemo(() => {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000; // 48 hours ago
    return aceRuns.filter((run) => {
      const runTime = new Date(run.finishedAt).getTime();
      return runTime >= cutoff;
    });
  }, [aceRuns]);

  // Phase 145.6: Compute ACE activity stats
  const aceStats = React.useMemo(() => {
    const totalRuns = aceRunsLast48h.length;
    const totalApplied = aceRunsLast48h.reduce((sum, r) => sum + (r.totalApplied || 0), 0);
    const totalErrors = aceRunsLast48h.reduce((sum, r) => sum + (r.totalErrors || 0), 0);
    const totalFilesProcessed = aceRunsLast48h.reduce((sum, r) => sum + (r.filesProcessed || 0), 0);
    const lastRun = aceRunsLast48h[0] || null;
    return { totalRuns, totalApplied, totalErrors, totalFilesProcessed, lastRun };
  }, [aceRunsLast48h]);

  // Build narrative from quality data
  const narrative = React.useMemo(() => {
    return buildQualityNarrative({
      status,
      snapshots: storySnapshots,
      events: events as any,
      locale,
    });
  }, [status, storySnapshots, events, locale]);

  return (
    <section
      dir={dir}
      className="mt-4 rounded-3xl border border-red-500/15 bg-gradient-to-b from-[#24000c] via-[#19000a] to-[#120009] px-4 py-4 overflow-hidden"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-200 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            {locale === 'ar' ? 'قصة الجودة' : 'Quality story'}
          </span>
          <QualityStatusBadge status={status} locale={locale} />
          <span className="rounded-full bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-100 shrink-0 hidden sm:inline">
            F0
          </span>
        </div>
        {hasData && (
          <span className="shrink-0 text-[10px] text-neutral-300/70 whitespace-nowrap">
            {events.length} {locale === 'ar' ? 'حدث' : 'events'}
          </span>
        )}
      </div>

      {/* Full-width stacked layout */}
      <div className="space-y-3">
        {/* Timeline - Full width */}
        <QualityTimelineCard
          snapshots={storySnapshots}
          events={events}
          locale={locale}
        />

        {/* Events + Narrative side by side */}
        <div className="grid gap-3 lg:grid-cols-2">
          <QualityStoryEventsList events={events} locale={locale} />
          <QualityNarrativePanel
            narrative={narrative}
            status={status}
            locale={locale}
          />
        </div>

        {/* Weekly Summary - Full width */}
        <QualityWeeklySummary snapshots={storySnapshots} events={events} locale={locale} />

        {/* Phase 145.6: ACE Agent Activity - Full width */}
        <AceAgentActivityCard aceStats={aceStats} aceRunsLast48h={aceRunsLast48h} locale={locale} />

        {/* Phase 146.5: Diagnostics Hotspots - Top 5 worst files by risk */}
        <DiagnosticsHotspotsCard locale={locale} />
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/*  Status Badge                                                               */
/* -------------------------------------------------------------------------- */

interface QualityStatusBadgeProps {
  status: QualityStatus;
  locale: Locale;
}

const QualityStatusBadge: React.FC<QualityStatusBadgeProps> = ({ status, locale }) => {
  const config = {
    OK: {
      label: locale === 'ar' ? 'جاهز' : 'Ready',
      className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
    },
    CAUTION: {
      label: locale === 'ar' ? 'تحذير' : 'Caution',
      className: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
    },
    BLOCK: {
      label: locale === 'ar' ? 'محظور' : 'Blocked',
      className: 'bg-red-500/15 text-red-200 border-red-500/30 animate-pulse',
    },
  };

  const { label, className } = config[status] || config.OK;

  return (
    <span
      className={clsx(
        'rounded-full border px-1.5 py-0.5 text-[10px] font-semibold shrink-0',
        className
      )}
    >
      {label}
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/*  Narrative Panel - Phase 140.10 + Phase 140.11 (Icons, Dividers)           */
/* -------------------------------------------------------------------------- */

// Section type to icon mapping
const sectionIcons: Record<string, string> = {
  overview: '📌',
  health_trend: '📈',
  coverage_trend: '📊',
  security_risks: '🔐',
  testing_activity: '🧪',
  auto_improve: '⚡',
  deploy_activity: '🚀',
  recommendation: '💡',
};

interface QualityNarrativePanelProps {
  narrative: {
    status: QualityStatus;
    sections: QualityNarrativeSection[];
    generatedAt: string;
  };
  status: QualityStatus;
  locale: Locale;
}

const QualityNarrativePanel: React.FC<QualityNarrativePanelProps> = ({
  narrative,
  status,
  locale,
}) => {
  const highlightColors: Record<NarrativeHighlight, string> = {
    danger: 'border-l-red-500',
    warning: 'border-l-amber-500',
    info: 'border-l-blue-500',
    success: 'border-l-emerald-500',
  };

  return (
    <div className="f0-quality-card px-3.5 py-3.5 overflow-hidden">
      <div className="mb-2">
        {/* Title row with status badge inline */}
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-xs font-semibold text-red-50">
            {locale === 'ar' ? 'تقرير الجودة' : 'Quality Report'}
          </p>
          <QualityStatusBadge status={status} locale={locale} />
        </div>
        <p className="text-[10px] text-neutral-400/70">
          {locale === 'ar'
            ? 'ملخص مُنسّق من لقطات الجودة الأخيرة'
            : 'Curated summary from recent quality snapshots'}
        </p>
      </div>

      <div className="max-h-[280px] space-y-3 overflow-y-auto pr-1">
        {narrative.sections.map((section, idx) => (
          <React.Fragment key={section.id}>
            <div
              className={clsx(
                'rounded-lg bg-red-900/10 px-3 py-2 border-l-2',
                highlightColors[section.highlight || 'info']
              )}
            >
              {/* Section title with icon */}
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-sm">
                  {sectionIcons[section.type] || '•'}
                </span>
                <p className="text-[11px] font-semibold text-red-50/90">
                  {section.title}
                </p>
              </div>
              <p className="text-[11px] leading-relaxed text-neutral-100/80">
                {section.body}
              </p>
            </div>
            {/* Divider between sections (except last) */}
            {idx < narrative.sections.length - 1 && (
              <div className="f0-quality-divider" />
            )}
          </React.Fragment>
        ))}
      </div>

      <p className="mt-2 text-[9px] text-neutral-400/60 text-center">
        {locale === 'ar'
          ? 'تقرير مُولّد تلقائيًا من سجل الجودة'
          : 'Auto-generated from quality history'}
      </p>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Timeline Card - Phase 140.9 Glassmorphism                                 */
/* -------------------------------------------------------------------------- */

interface QualityTimelineCardProps {
  snapshots: QualityStorySnapshot[];
  events: QualityStoryEvent[];
  locale: Locale;
}

const QualityTimelineCard: React.FC<QualityTimelineCardProps> = ({
  snapshots,
  events,
  locale,
}) => {
  const hasSnapshots = snapshots && snapshots.length > 0;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const lastSnapshots = React.useMemo(
    () => (hasSnapshots ? snapshots.slice(-20) : []),
    [snapshots, hasSnapshots],
  );

  return (
    <div className="f0-quality-card h-full px-4 py-3 overflow-hidden">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-red-50 truncate flex-1 min-w-0">
          {locale === 'ar' ? 'جودة المشروع عبر الزمن' : 'Project quality over time'}
        </p>
        {hasSnapshots && (
          <p className="shrink-0 text-[11px] text-neutral-300/70">
            {locale === 'ar'
              ? `آخر ${lastSnapshots.length} نقطة`
              : `Last ${lastSnapshots.length}`}
          </p>
        )}
      </div>

      {!hasSnapshots ? (
        <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-red-500/25 bg-red-900/10 px-3 text-center">
          <p className="text-xs font-medium text-red-50/80">
            {locale === 'ar'
              ? 'لا توجد لقطات جودة كافية بعد.'
              : 'No quality snapshots collected yet.'}
          </p>
          <p className="text-[11px] text-red-100/70">
            {locale === 'ar'
              ? 'شغّل فحص الكود والاختبارات حتى يبدأ المخطط في الامتلاء.'
              : 'Run Code Health + tests to start filling this chart.'}
          </p>
        </div>
      ) : (
        <div className={clsx('space-y-3 overflow-hidden', dir === 'rtl' && 'text-right')}>
          {/* Bar chart */}
          <div className="relative h-32 overflow-hidden rounded-xl bg-[#120008]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.35),_transparent_60%)] opacity-60" />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,_rgba(148,27,45,0.4),_transparent)]" />

            <div className="relative flex h-full items-end gap-0.5 px-3 pb-3">
              {lastSnapshots.map((snap: any, idx: number) => {
                const health = typeof snap.health === 'number' ? snap.health : 0;
                const normalized = Math.max(6, Math.min(100, health));
                const isLast = idx === lastSnapshots.length - 1;

                return (
                  <div
                    key={snap.id ?? idx}
                    className={clsx(
                      'flex-1 rounded-full bg-gradient-to-t from-red-700/40 via-red-500/70 to-rose-300 transition-all duration-300',
                      isLast ? 'f0-quality-bar-last' : 'opacity-60 hover:opacity-80',
                    )}
                    style={{ height: `${normalized}%` }}
                  />
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-neutral-200/80">
            <div className="flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400/90" />
                <span className="truncate">{locale === 'ar' ? 'الصحة' : 'Health'}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-1.5 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400/90" />
                <span className="truncate">{locale === 'ar' ? 'التغيّر' : 'Change'}</span>
              </span>
            </div>
            <span className="shrink-0 text-[10px] text-neutral-400">
              {events.length} {locale === 'ar' ? 'حدث' : 'events'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Events List - Phase 140.9 Chip Hover Effects                              */
/* -------------------------------------------------------------------------- */

interface QualityStoryEventsListProps {
  events: QualityStoryEvent[];
  locale: Locale;
}

const QualityStoryEventsList: React.FC<QualityStoryEventsListProps> = ({
  events,
  locale,
}) => {
  const hasEvents = events && events.length > 0;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className={clsx('f0-quality-card px-3 py-3 overflow-hidden', dir === 'rtl' && 'text-right')}>
      <div className="mb-2 flex items-center justify-between gap-2 overflow-hidden">
        <p className="text-xs font-semibold text-red-50 truncate min-w-0 flex-1">
          {locale === 'ar' ? 'تفاصيل ما حدث' : 'What happened'}
        </p>
        {hasEvents && (
          <span className="shrink-0 text-[10px] text-neutral-300/75 whitespace-nowrap">
            {events.length} {locale === 'ar' ? 'حدث' : 'items'}
          </span>
        )}
      </div>

      {!hasEvents ? (
        <p className="rounded-xl bg-red-900/10 px-3 py-2 text-[11px] text-red-50/80">
          {locale === 'ar'
            ? 'لا توجد أحداث جودة حتى الآن — بعد أول فحص كود وتشغيل اختبارات، سيظهر هنا سجل الأحداث.'
            : 'No quality events yet — once you run Code Health + tests, a detailed history will appear here.'}
        </p>
      ) : (
        <div className="max-h-60 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
          {events.map((event, idx) => (
            <QualityStoryEventChip
              key={event.id ?? idx}
              event={event}
              locale={locale}
              isFirst={idx === 0}
              isLast={idx === events.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface QualityStoryEventChipProps {
  event: QualityStoryEvent;
  locale: Locale;
  isFirst: boolean;
  isLast: boolean;
}

const QualityStoryEventChip: React.FC<QualityStoryEventChipProps> = ({
  event,
  locale,
  isFirst,
  isLast,
}) => {
  const ts =
    typeof event.timestamp === 'string'
      ? new Date(event.timestamp)
      : (event.timestamp as Date);
  const timeLabel = isNaN(ts.getTime())
    ? ''
    : ts.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

  const typeLabelMap: Record<string, { en: string; ar: string }> = {
    security_blocking: { en: 'Blocking security issue', ar: 'مشكلة أمان حرجة' },
    security_warning: { en: 'Security warning', ar: 'تحذير أمني' },
    health_change: { en: 'Health changed', ar: 'تغيّر في الصحة' },
    coverage_change: { en: 'Coverage changed', ar: 'تغيّر في التغطية' },
    issues_change: { en: 'Issues changed', ar: 'تغيّر في المشاكل' },
    deploy: { en: 'Deploy', ar: 'عملية نشر' },
    atp_run: { en: 'Autonomous Test Pipeline', ar: 'بايبلاين الاختبارات' },
    auto_improve: { en: 'Auto-improve project', ar: 'تحسين آلي للمشروع' },
  };

  const baseLabel =
    typeLabelMap[event.type]?.[locale === 'ar' ? 'ar' : 'en'] ??
    (locale === 'ar' ? 'حدث جودة' : 'Quality event');

  const accent =
    event.type === 'security_blocking'
      ? 'from-red-500 via-red-400 to-rose-300'
      : event.type === 'security_warning'
      ? 'from-amber-500 via-amber-400 to-amber-200'
      : event.type === 'deploy'
      ? 'from-emerald-500 via-emerald-400 to-emerald-200'
      : 'from-purple-500 via-pink-400 to-fuchsia-300';

  return (
    <div className="flex min-w-0 gap-2 group">
      {/* Timeline rail */}
      <div className="flex flex-col items-center">
        <div
          className={clsx(
            'w-px flex-1 bg-gradient-to-b from-red-500/0 via-red-500/40 to-red-500/0',
            isFirst && 'opacity-0',
          )}
        />
        <div
          className={clsx(
            'h-3 w-3 rounded-full bg-gradient-to-tr transition-transform duration-200 group-hover:scale-125',
            accent,
            'shadow-[0_0_0_3px_rgba(248,113,113,0.25)]',
          )}
        />
        <div
          className={clsx(
            'w-px flex-1 bg-gradient-to-b from-red-500/0 via-red-500/40 to-red-500/0',
            isLast && 'opacity-0',
          )}
        />
      </div>

      {/* Card - uses f0-quality-chip for hover */}
      <div className="f0-quality-chip flex-1 min-w-0 overflow-hidden rounded-xl border border-red-500/20 bg-red-950/40 px-3 py-2.5">
        <div className="mb-1 flex min-w-0 flex-wrap items-center justify-between gap-1">
          <p className="min-w-0 flex-1 text-xs font-semibold text-red-50 truncate">
            {event.title || baseLabel}
          </p>
          {timeLabel && (
            <span className="shrink-0 text-[11px] text-neutral-300/70">{timeLabel}</span>
          )}
        </div>

        {event.description && (
          <p className="mb-1 text-[11px] leading-snug text-neutral-100/85 line-clamp-2">
            {event.description}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          {typeof event.health === 'number' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-red-100">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              {locale === 'ar' ? `الصحة: ${event.health}%` : `Health: ${event.health}%`}
            </span>
          )}
          {typeof event.coverage === 'number' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-purple-100">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
              {locale === 'ar' ? `التغطية: ${event.coverage}%` : `Coverage: ${event.coverage}%`}
            </span>
          )}
          {typeof event.issues === 'number' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-100">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              {locale === 'ar' ? `المشاكل: ${event.issues}` : `Issues: ${event.issues}`}
            </span>
          )}
          {event.securityLevel === 'blocking' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-50 animate-pulse">
              {locale === 'ar' ? 'أمان حرج' : 'BLOCKING'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Weekly Summary - Phase 140.9 Glassmorphism + Polish                       */
/* -------------------------------------------------------------------------- */

interface QualityWeeklySummaryProps {
  snapshots: QualityStorySnapshot[];
  events: QualityStoryEvent[];
  locale: Locale;
}

const QualityWeeklySummary: React.FC<QualityWeeklySummaryProps> = ({
  snapshots,
  events,
  locale,
}) => {
  const hasSnapshots = snapshots && snapshots.length > 1;

  const summary = React.useMemo(() => {
    if (!hasSnapshots) return null;
    const first = snapshots[0] as any;
    const last = snapshots[snapshots.length - 1] as any;

    const deltaHealth =
      typeof first.health === 'number' && typeof last.health === 'number'
        ? last.health - first.health
        : 0;

    const deltaCoverage =
      typeof first.coverage === 'number' && typeof last.coverage === 'number'
        ? last.coverage - first.coverage
        : 0;

    const blockingSecurity = events.filter(
      (e) => e.type === 'security_blocking' || e.type === 'SECURITY_ALERT',
    ).length;

    const deploys = events.filter((e) => e.type === 'deploy' || e.type === 'DEPLOY').length;
    const atpRuns = events.filter((e) => e.type === 'atp_run' || e.type === 'ATP_RUN').length;
    const autoImproveRuns = events.filter(
      (e) => e.type === 'auto_improve' || e.type === 'AUTO_IMPROVE',
    ).length;

    return { deltaHealth, deltaCoverage, blockingSecurity, deploys, atpRuns, autoImproveRuns };
  }, [snapshots, events, hasSnapshots]);

  return (
    <div className="f0-quality-card px-3.5 py-3.5">
      <p className="mb-2 text-xs font-semibold text-red-50">
        {locale === 'ar' ? 'ملخص آخر ٧ أيام' : 'Last 7 days'}
      </p>

      {!summary ? (
        <p className="rounded-xl bg-red-900/10 px-3 py-2 text-[11px] text-red-50/80">
          {locale === 'ar'
            ? 'نحتاج على الأقل لقطة جودة واحدة أخرى لعرض الملخص.'
            : 'We need at least one more snapshot to show a weekly summary.'}
        </p>
      ) : (
        <div className="space-y-2 text-[11px] text-neutral-100/90">
          {/* Health / Coverage row */}
          <div className="flex flex-col gap-1 rounded-xl bg-red-900/10 px-3 py-2">
            <SummaryRow
              label={locale === 'ar' ? 'تغيّر الصحة' : 'Health change'}
              value={`${summary.deltaHealth > 0 ? '+' : ''}${summary.deltaHealth.toFixed(1)} pts`}
              positive={summary.deltaHealth > 0}
              negative={summary.deltaHealth < 0}
            />
            <SummaryRow
              label={locale === 'ar' ? 'تغيّر التغطية' : 'Coverage change'}
              value={`${summary.deltaCoverage > 0 ? '+' : ''}${summary.deltaCoverage.toFixed(1)}%`}
              positive={summary.deltaCoverage > 0}
              negative={summary.deltaCoverage < 0}
            />
          </div>

          {/* Runs row */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-red-900/5 px-3 py-2">
            <MiniStat label={locale === 'ar' ? 'ATP' : 'ATP runs'} value={summary.atpRuns} />
            <MiniStat
              label={locale === 'ar' ? 'تحسين آلي' : 'Auto-improve'}
              value={summary.autoImproveRuns}
            />
            <MiniStat label={locale === 'ar' ? 'نشر' : 'Deploys'} value={summary.deploys} />
            <MiniStat
              label={locale === 'ar' ? 'أمان حرج' : 'Blocking'}
              value={summary.blockingSecurity}
              danger={summary.blockingSecurity > 0}
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface SummaryRowProps {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}

const SummaryRow: React.FC<SummaryRowProps> = ({ label, value, positive, negative }) => {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-neutral-100/90">{label}</span>
      <span
        className={clsx(
          'rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors duration-200',
          positive && 'bg-emerald-500/10 text-emerald-200',
          negative && 'bg-red-500/10 text-red-200',
          !positive && !negative && 'bg-neutral-500/10 text-neutral-200',
        )}
      >
        {value}
      </span>
    </div>
  );
};

interface MiniStatProps {
  label: string;
  value: number;
  danger?: boolean;
}

const MiniStat: React.FC<MiniStatProps> = ({ label, value, danger }) => {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-neutral-400">{label}</span>
      <span
        className={clsx(
          'w-min rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors duration-200',
          danger ? 'bg-red-500/15 text-red-100 animate-pulse' : 'bg-neutral-500/10 text-neutral-100',
        )}
      >
        {value}
      </span>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Phase 145.6: ACE Agent Activity Card                                       */
/*  Phase 145.P.5: Performance Polish - React.memo wrapper                     */
/* -------------------------------------------------------------------------- */

interface AceAgentActivityCardProps {
  aceStats: {
    totalRuns: number;
    totalApplied: number;
    totalErrors: number;
    totalFilesProcessed: number;
    lastRun: AceRun | null;
  };
  aceRunsLast48h: AceRun[];
  locale: Locale;
}

// Phase 145.P.5: Memoized component to prevent unnecessary re-renders
const AceAgentActivityCard: React.FC<AceAgentActivityCardProps> = React.memo(({
  aceStats,
  aceRunsLast48h,
  locale,
}) => {
  const { totalRuns, totalApplied, totalErrors, totalFilesProcessed, lastRun } = aceStats;
  const hasActivity = totalRuns > 0;

  // Phase 145.P.1.A: Build smart narrative with professional human-readable text
  const narrative = React.useMemo(() => {
    if (totalRuns === 0) {
      return {
        titleEn: 'No ACE activity detected',
        titleAr: 'لم يُكتشف أي نشاط لـ ACE',
        bodyEn: "ACE hasn't been run in the last 48 hours. Run ACE to improve code quality before deploying.",
        bodyAr: 'لم يتم تشغيل ACE خلال آخر 48 ساعة. شغّل ACE لتحسين جودة الكود قبل النشر.',
        tone: 'neutral' as const,
      };
    }

    if (totalApplied === 0) {
      return {
        titleEn: 'ACE attempted improvements',
        titleAr: 'حاول ACE إجراء تحسينات',
        bodyEn: "ACE tried to apply safe fixes but didn't find any necessary changes in the selected files.",
        bodyAr: 'حاول ACE تطبيق إصلاحات آمنة لكنه لم يجد تغييرات ضرورية في الملفات المحددة.',
        tone: 'info' as const,
      };
    }

    if (totalErrors > totalApplied) {
      return {
        titleEn: 'Partial improvements applied',
        titleAr: 'تم تطبيق تحسينات جزئية',
        bodyEn: `ACE improved several files but encountered ${totalErrors} issue${totalErrors > 1 ? 's' : ''} during processing.`,
        bodyAr: `حسّن ACE عدة ملفات لكنه واجه ${totalErrors} مشكلة أثناء المعالجة.`,
        tone: 'warning' as const,
      };
    }

    return {
      titleEn: 'ACE successfully improved your code',
      titleAr: 'نجح ACE في تحسين الكود',
      bodyEn: `ACE applied ${totalApplied} safe fix${totalApplied > 1 ? 'es' : ''} across ${totalFilesProcessed} file${totalFilesProcessed > 1 ? 's' : ''}. Code quality has improved.`,
      bodyAr: `طبّق ACE ${totalApplied} إصلاح${totalApplied > 1 ? 'ات' : ''} آمنة في ${totalFilesProcessed} ملف. تحسّنت جودة الكود.`,
      tone: 'success' as const,
    };
  }, [totalRuns, totalApplied, totalErrors, totalFilesProcessed]);

  // Phase 145.P.3: Format last run time using relative timestamp
  const lastRunTime = React.useMemo(() => {
    if (!lastRun) return null;
    return formatAceTimestamp(lastRun.finishedAt, locale);
  }, [lastRun, locale]);

  // Phase 145.P.1.B: Enhanced tone styles with semantic colors
  const toneStyles = {
    neutral: 'border-l-slate-500',
    info: 'border-l-blue-500',
    warning: 'border-l-amber-500',
    success: 'border-l-emerald-500',
  };

  const iconStyles = {
    neutral: '⚡',
    info: '💡',
    warning: '⚠️',
    success: '✨',
  };

  return (
    <div className="f0-quality-card px-3.5 py-3.5 animate-fadeInUp">
      {/* Phase 145.P.4: Improved header with tooltip */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{iconStyles[narrative.tone]}</span>
          <p className="text-xs font-semibold text-red-50">
            {locale === 'ar' ? 'محرك الإصلاح التلقائي' : 'Auto-Fix Engine'}
          </p>
          {/* Tooltip for ACE explanation */}
          <span
            className="group relative cursor-help text-[10px] text-neutral-400 hover:text-neutral-300"
            title={locale === 'ar'
              ? 'ACE يحلل ويُصلح الكود تلقائيًا باستخدام الذكاء الاصطناعي'
              : 'ACE analyzes and auto-fixes your code using AI'}
          >
            ?
            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-48 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-[10px] text-neutral-200 shadow-lg group-hover:block">
              {locale === 'ar'
                ? 'ACE (محرك تحسين الكود التلقائي) يحلل الكود، يكتشف المشاكل، ويُطبّق إصلاحات آمنة تلقائيًا.'
                : 'ACE (Auto Code Evolution) analyzes your code, detects issues, and applies safe fixes automatically.'}
              <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            </span>
          </span>
          <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-100">
            48h
          </span>
        </div>
        {lastRunTime && (
          <span className="text-[10px] text-neutral-300/70">
            {locale === 'ar' ? 'آخر تشغيل: ' : 'Last: '}{lastRunTime}
          </span>
        )}
      </div>

      {/* Phase 145.P.1.C: Narrative Card with animation */}
      <div
        className={clsx(
          'animate-fadeInUp rounded-lg bg-red-900/10 px-3 py-2 border-l-2 mb-3',
          toneStyles[narrative.tone]
        )}
      >
        <p className="text-[11px] font-semibold text-red-50/90 mb-1">
          {locale === 'ar' ? narrative.titleAr : narrative.titleEn}
        </p>
        <p className="text-[11px] leading-relaxed text-neutral-100/80">
          {locale === 'ar' ? narrative.bodyAr : narrative.bodyEn}
        </p>
      </div>

      {/* Phase 145.P.1.B: Stats Grid with Premium Badge Styling */}
      {hasActivity && (
        <div className="animate-fadeInUp grid grid-cols-4 gap-2 text-[11px]">
          {/* Runs - Purple/Activity */}
          <div className="flex flex-col items-center gap-1 rounded-lg bg-violet-500/10 px-2 py-2 transition-all duration-200 hover:bg-violet-500/15">
            <span className="text-[10px] text-neutral-400">
              {locale === 'ar' ? 'تشغيلات' : 'Runs'}
            </span>
            <span className="px-2 py-0.5 rounded-lg text-sm font-medium bg-violet-500/20 text-violet-200">
              {totalRuns}
            </span>
          </div>
          {/* Fixes - Green/Success */}
          <div className="flex flex-col items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-2 transition-all duration-200 hover:bg-emerald-500/15">
            <span className="text-[10px] text-neutral-400">
              {locale === 'ar' ? 'إصلاحات' : 'Fixes'}
            </span>
            <span className="px-2 py-0.5 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300">
              {totalApplied}
            </span>
          </div>
          {/* Files - Blue/Info */}
          <div className="flex flex-col items-center gap-1 rounded-lg bg-blue-500/10 px-2 py-2 transition-all duration-200 hover:bg-blue-500/15">
            <span className="text-[10px] text-neutral-400">
              {locale === 'ar' ? 'ملفات' : 'Files'}
            </span>
            <span className="px-2 py-0.5 rounded-lg text-sm font-medium bg-blue-500/20 text-blue-300">
              {totalFilesProcessed}
            </span>
          </div>
          {/* Errors - Red/Danger */}
          <div className={clsx(
            'flex flex-col items-center gap-1 rounded-lg px-2 py-2 transition-all duration-200',
            totalErrors > 0 ? 'bg-red-500/10 hover:bg-red-500/15' : 'bg-neutral-500/10 hover:bg-neutral-500/15'
          )}>
            <span className="text-[10px] text-neutral-400">
              {locale === 'ar' ? 'أخطاء' : 'Errors'}
            </span>
            <span className={clsx(
              'px-2 py-0.5 rounded-lg text-sm font-medium',
              totalErrors > 0 ? 'bg-red-500/20 text-red-300' : 'bg-neutral-500/20 text-neutral-300'
            )}>
              {totalErrors}
            </span>
          </div>
        </div>
      )}

      {/* Recent runs list (collapsed by default, show last 3) */}
      {aceRunsLast48h.length > 1 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[10px] text-neutral-400 hover:text-neutral-300">
            {locale === 'ar'
              ? `عرض ${aceRunsLast48h.length} تشغيلات حديثة`
              : `View ${aceRunsLast48h.length} recent runs`}
          </summary>
          <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
            {aceRunsLast48h.slice(0, 5).map((run) => {
              // Phase 145.P.3: Use relative timestamp format
              const timeStr = formatAceTimestamp(run.finishedAt, locale);
              return (
                <div
                  key={run.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-red-900/5 px-2 py-1.5 text-[10px]"
                >
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'h-1.5 w-1.5 rounded-full',
                      run.totalApplied > 0 ? 'bg-emerald-400' : 'bg-neutral-400'
                    )} />
                    <span className="text-neutral-300">
                      {run.totalApplied > 0
                        ? locale === 'ar'
                          ? `${run.totalApplied} إصلاح`
                          : `${run.totalApplied} fix${run.totalApplied > 1 ? 'es' : ''}`
                        : locale === 'ar'
                          ? 'لا تغييرات'
                          : 'No changes'}
                    </span>
                    {run.totalErrors > 0 && (
                      <span className="text-red-300">
                        ({run.totalErrors} {locale === 'ar' ? 'خطأ' : 'err'})
                      </span>
                    )}
                  </div>
                  <span className="text-neutral-500">{timeStr}</span>
                </div>
              );
            })}
          </div>
        </details>
      )}

      <p className="mt-2 text-[9px] text-neutral-400/60 text-center">
        {locale === 'ar'
          ? 'ACE يُحسّن الكود تلقائيًا باستخدام الذكاء الاصطناعي'
          : 'ACE auto-improves code using AI-powered analysis'}
      </p>
    </div>
  );
});

// Phase 145.P.5: Display name for debugging
AceAgentActivityCard.displayName = 'AceAgentActivityCard';

/* -------------------------------------------------------------------------- */
/*  Phase 146.5: Diagnostics Hotspots Card                                     */
/*  Shows top 5 worst files by risk score from DiagnosticsContext              */
/* -------------------------------------------------------------------------- */

interface DiagnosticsHotspotsCardProps {
  locale: Locale;
}

const DiagnosticsHotspotsCard: React.FC<DiagnosticsHotspotsCardProps> = React.memo(({
  locale,
}) => {
  const diagnostics = useDiagnosticsSafe();

  // Safely extract data with null checks
  const worstFiles = diagnostics?.worstFiles ?? [];
  const highRiskFiles = diagnostics?.highRiskFiles ?? [];
  const summaryStats = diagnostics?.summaryStats ?? null;

  // Take top 5 worst files for display
  const top5Worst = React.useMemo(() => worstFiles.slice(0, 5), [worstFiles]);

  // Risk level colors
  const riskColors: Record<RiskLevel, string> = {
    critical: 'bg-red-500/15 text-red-200 border-red-500/30',
    high: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
    medium: 'bg-yellow-500/15 text-yellow-200 border-yellow-500/30',
    low: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  };

  const riskLabels: Record<RiskLevel, { en: string; ar: string }> = {
    critical: { en: 'Critical', ar: 'حرج' },
    high: { en: 'High', ar: 'عالي' },
    medium: { en: 'Medium', ar: 'متوسط' },
    low: { en: 'Low', ar: 'منخفض' },
  };

  // Extract just the filename from path
  const getFileName = (path: string): string => {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  };

  return (
    <div className="f0-quality-card px-3.5 py-3.5 animate-fadeInUp">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔥</span>
          <p className="text-xs font-semibold text-red-50">
            {locale === 'ar' ? 'نقاط ساخنة في الكود' : 'Code Hotspots'}
          </p>
          <span
            className="group relative cursor-help text-[10px] text-neutral-400 hover:text-neutral-300"
            title={locale === 'ar'
              ? 'الملفات الأكثر عرضة للمخاطر بناءً على المشاكل والأمان والتغطية'
              : 'Files with highest risk based on issues, security, and coverage'}
          >
            ?
            <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-48 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-[10px] text-neutral-200 shadow-lg group-hover:block">
              {locale === 'ar'
                ? 'تحليل تلقائي للملفات الأكثر عرضة للمشاكل بناءً على الأخطاء، التحذيرات الأمنية، ونقص التغطية'
                : 'Automated analysis of files most likely to cause issues based on errors, security warnings, and coverage gaps'}
              <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            </span>
          </span>
        </div>
        {summaryStats && (
          <div className="flex items-center gap-1.5 text-[10px]">
            {summaryStats.criticalCount > 0 && (
              <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-red-200 animate-pulse">
                {summaryStats.criticalCount} {locale === 'ar' ? 'حرج' : 'critical'}
              </span>
            )}
            {summaryStats.highCount > 0 && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                {summaryStats.highCount} {locale === 'ar' ? 'عالي' : 'high'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {top5Worst.length === 0 ? (
        <div className="rounded-lg bg-emerald-900/10 px-3 py-2 border-l-2 border-l-emerald-500">
          <p className="text-[11px] font-semibold text-emerald-200/90 mb-1">
            {locale === 'ar' ? 'لا توجد نقاط ساخنة!' : 'No hotspots detected!'}
          </p>
          <p className="text-[11px] leading-relaxed text-neutral-100/80">
            {locale === 'ar'
              ? 'الكود في حالة جيدة - لم يتم اكتشاف ملفات عالية المخاطر.'
              : 'Code is in good shape - no high-risk files detected.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {top5Worst.map((file, idx) => (
            <div
              key={file.path}
              className="flex items-center justify-between gap-2 rounded-lg bg-red-900/10 px-3 py-2 transition-all duration-200 hover:bg-red-900/15"
            >
              {/* File info */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[10px] text-neutral-500">#{idx + 1}</span>
                <span className="truncate text-[11px] text-neutral-200" title={file.path}>
                  {getFileName(file.path)}
                </span>
              </div>

              {/* Risk info */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Risk score */}
                <span className="text-[10px] text-neutral-400">
                  {file.riskScore}
                </span>
                {/* Risk badge */}
                <span
                  className={clsx(
                    'rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
                    riskColors[file.riskLevel]
                  )}
                >
                  {riskLabels[file.riskLevel][locale === 'ar' ? 'ar' : 'en']}
                </span>
              </div>
            </div>
          ))}

          {/* Show more indicator if there are more files */}
          {worstFiles.length > 5 && (
            <div className="text-center text-[10px] text-neutral-500 pt-1">
              {locale === 'ar'
                ? `و ${worstFiles.length - 5} ملف آخر...`
                : `and ${worstFiles.length - 5} more files...`}
            </div>
          )}
        </div>
      )}

      {/* Summary stats row */}
      {summaryStats && summaryStats.totalFiles > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-neutral-500/10 px-2 py-1.5">
            <span className="text-neutral-400">{locale === 'ar' ? 'إجمالي' : 'Total'}</span>
            <span className="font-medium text-neutral-200">{summaryStats.totalFiles}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-amber-500/10 px-2 py-1.5">
            <span className="text-neutral-400">{locale === 'ar' ? 'عالي المخاطر' : 'High Risk'}</span>
            <span className="font-medium text-amber-200">{highRiskFiles.length}</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-lg bg-blue-500/10 px-2 py-1.5">
            <span className="text-neutral-400">{locale === 'ar' ? 'متوسط النقاط' : 'Avg Score'}</span>
            <span className="font-medium text-blue-200">{summaryStats.averageRiskScore}</span>
          </div>
        </div>
      )}

      <p className="mt-2 text-[9px] text-neutral-400/60 text-center">
        {locale === 'ar'
          ? 'تحليل تلقائي للملفات الأكثر عرضة للمخاطر'
          : 'Automated risk analysis of project files'}
      </p>
    </div>
  );
});

DiagnosticsHotspotsCard.displayName = 'DiagnosticsHotspotsCard';

export default PreDeployQualityStory;
