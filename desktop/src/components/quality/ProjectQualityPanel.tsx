// desktop/src/components/quality/ProjectQualityPanel.tsx
// Phase 132.P2: Polished Project Quality Timeline Panel with Tabs
// Phase 133.4: Added Test Insights card with coverage and failing suites

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useQualityMonitor } from '../../state/qualityMonitorContext';
import { useTestLab } from '../../state/testLabContext';
import { useTestGeneration } from '../../state/testGenerationContext';
import {
  QualityEvent,
  QualityEventType,
  getEventIcon,
  formatRelativeTime,
} from '../../lib/quality/qualityMonitorTypes';
import { getHealthSeverity } from '../../lib/quality/qualityUtils';

interface ProjectQualityPanelProps {
  locale?: 'ar' | 'en';
  onClose?: () => void;
  /** Phase 133.4: Callback when panel width changes (for sibling panel positioning) */
  onWidthChange?: (width: number) => void;
}

type TabId = 'all' | QualityEventType;

const TABS: { id: TabId; label: { en: string; ar: string } }[] = [
  { id: 'all', label: { en: 'All', ar: 'الكل' } },
  { id: 'scan', label: { en: 'Scans', ar: 'فحوصات' } },
  { id: 'ace', label: { en: 'ACE', ar: 'ACE' } },
  { id: 'tests', label: { en: 'Tests', ar: 'اختبارات' } },
  { id: 'cleanup', label: { en: 'Cleanup', ar: 'تنظيف' } },
];

const getTypeBadgeClasses = (type: QualityEventType) => {
  switch (type) {
    case 'scan':
      return 'bg-sky-500/15 text-sky-300 border border-sky-500/30';
    case 'ace':
      return 'bg-violet-500/15 text-violet-300 border border-violet-500/30';
    case 'tests':
      return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
    case 'cleanup':
      return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
    default:
      return 'bg-slate-500/15 text-slate-300 border border-slate-500/30';
  }
};

const getEventTitle = (type: QualityEventType, locale: 'en' | 'ar') => {
  const titles = {
    scan: { en: 'Code Health Scan', ar: 'فحص صحة الكود' },
    ace: { en: 'ACE Evolution', ar: 'تطور ACE' },
    tests: { en: 'Test Run', ar: 'تشغيل اختبارات' },
    cleanup: { en: 'Cleanup Session', ar: 'جلسة تنظيف' },
  };
  return titles[type][locale];
};

const getHealthLabel = (score: number | null, locale: 'en' | 'ar') => {
  const severity = getHealthSeverity(score);
  const labels = {
    good: { en: 'Healthy', ar: 'ممتاز' },
    ok: { en: 'Stable', ar: 'مستقر' },
    warning: { en: 'Degrading', ar: 'متراجع' },
    critical: { en: 'Critical', ar: 'حرج' },
    unknown: { en: 'Unknown', ar: 'غير معروف' },
  };
  return labels[severity][locale];
};

const getHealthRingClasses = (score: number | null) => {
  const severity = getHealthSeverity(score);
  switch (severity) {
    case 'good':
      return 'from-emerald-400/70 via-teal-300/60 to-cyan-300/60';
    case 'ok':
      return 'from-amber-300/70 via-yellow-300/60 to-orange-300/60';
    case 'warning':
      return 'from-orange-400/80 via-amber-400/70 to-yellow-300/60';
    case 'critical':
      return 'from-red-500/90 via-rose-500/80 to-orange-400/80';
    default:
      return 'from-slate-500/60 via-slate-400/50 to-slate-300/40';
  }
};

/**
 * Project Quality Panel
 * Timeline view with tabs for filtering quality events
 */
// Min/max dimensions
const MIN_WIDTH = 340;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 900;

export const ProjectQualityPanel: React.FC<ProjectQualityPanelProps> = ({
  locale = 'en',
  onClose,
  onWidthChange,
}) => {
  const { summary, refresh } = useQualityMonitor();
  const isArabic = locale === 'ar';
  const [activeTab, setActiveTab] = useState<TabId>('all');

  // Phase 133.4: Test Lab integration for insights
  const { state: testLabState, refresh: refreshTestLab } = useTestLab();
  const { requestTestGeneration } = useTestGeneration();

  // Phase 133.4: Compute test insights
  const testInsights = useMemo(() => {
    const testSummary = testLabState.summary;
    const passRate = testSummary.totalSuites > 0
      ? Math.round((testSummary.passingSuites / testSummary.totalSuites) * 100)
      : 0;

    // Get failing suites
    const failingSuites = testLabState.suites.filter(s => s.lastRun?.status === 'failing');

    // Get files that have no test coverage (simplified: files not in sourceToTests)
    const uncoveredFiles = Object.entries(testLabState.sourceToTests)
      .filter(([_, tests]) => tests.length === 0)
      .map(([path]) => path);

    return {
      totalSuites: testSummary.totalSuites,
      passingSuites: testSummary.passingSuites,
      failingSuites: testSummary.failingSuites,
      passRate,
      failingSuitesList: failingSuites,
      uncoveredFiles,
      lastRunAt: testSummary.lastRunAt,
    };
  }, [testLabState]);

  // Resizable state
  const [size, setSize] = useState({ width: 476, height: 588 });
  const panelRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef<'right' | 'top' | 'corner' | null>(null);
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Phase 133.4: Notify parent when width changes (for TestsPanel positioning)
  useEffect(() => {
    onWidthChange?.(size.width);
  }, [size.width, onWidthChange]);

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: 'right' | 'top' | 'corner') => {
      e.preventDefault();
      e.stopPropagation();
      isResizing.current = direction;
      startPos.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;

        const deltaX = moveEvent.clientX - startPos.current.x;
        const deltaY = startPos.current.y - moveEvent.clientY; // Inverted for top resize

        let newWidth = startPos.current.width;
        let newHeight = startPos.current.height;

        if (isResizing.current === 'right' || isResizing.current === 'corner') {
          newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startPos.current.width + deltaX));
        }
        if (isResizing.current === 'top' || isResizing.current === 'corner') {
          newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startPos.current.height + deltaY));
        }

        setSize({ width: newWidth, height: newHeight });
      };

      const handleMouseUp = () => {
        isResizing.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor =
        direction === 'corner' ? 'ne-resize' : direction === 'right' ? 'ew-resize' : 'ns-resize';
      document.body.style.userSelect = 'none';
    },
    [size]
  );

  // Filter events by active tab
  const filteredEvents = useMemo(() => {
    if (activeTab === 'all') return summary.events;
    return summary.events.filter((e) => e.type === activeTab);
  }, [summary.events, activeTab]);

  // Render event details based on type
  const renderEventDetails = (event: QualityEvent) => {
    switch (event.type) {
      case 'scan': {
        // Get color based on health score
        const healthSeverity = getHealthSeverity(event.healthAfter ?? null);
        const healthTextColor =
          healthSeverity === 'good'
            ? 'text-emerald-400'
            : healthSeverity === 'ok'
            ? 'text-amber-300'
            : healthSeverity === 'warning'
            ? 'text-orange-400'
            : healthSeverity === 'critical'
            ? 'text-red-400'
            : 'text-white/70';
        return (
          <div className="mt-1.5 text-[11px] text-white/70">
            {event.healthAfter != null && (
              <span className={healthTextColor}>
                {isArabic ? 'الصحة: ' : 'Health: '}
                {event.healthAfter}%
              </span>
            )}
            {event.issuesFound != null && (
              <span className="ml-3 opacity-70">
                {event.issuesFound} {isArabic ? 'مشكلة' : 'issues'}
              </span>
            )}
            {event.filesScanned != null && (
              <span className="ml-3 opacity-70">
                {event.filesScanned} {isArabic ? 'ملف' : 'files'}
              </span>
            )}
          </div>
        );
      }

      case 'ace':
        return (
          <div className="mt-1.5 text-[11px] text-white/70">
            {event.phaseSummary || (isArabic ? 'تحليل ACE' : 'ACE analysis')}
            {event.suggestionsCount != null && (
              <span className="ml-3 text-violet-300/80">
                {event.suggestionsCount} {isArabic ? 'اقتراح' : 'suggestions'}
              </span>
            )}
          </div>
        );

      case 'tests':
        return (
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-white/70">
            {event.status === 'passing' ? (
              <span className="text-emerald-400">
                ✅ {isArabic ? 'ناجحة' : 'Passing'}
              </span>
            ) : event.status === 'failing' ? (
              <span className="text-red-400">
                ❌ {isArabic ? 'فاشلة' : 'Failing'}
              </span>
            ) : (
              <span className="text-white/50">
                – {isArabic ? 'لم تُشغّل' : 'Not run'}
              </span>
            )}
            {typeof event.passed === 'number' && (
              <span className="text-emerald-400/80">✓ {event.passed}</span>
            )}
            {typeof event.failed === 'number' && event.failed > 0 && (
              <span className="text-red-400/80">✗ {event.failed}</span>
            )}
            {event.durationMs != null && (
              <span className="opacity-50">
                ({(event.durationMs / 1000).toFixed(1)}s)
              </span>
            )}
          </div>
        );

      case 'cleanup':
        return (
          <div className="mt-1.5 text-[11px] text-white/70">
            {event.healthBefore != null && event.healthAfter != null && (
              <span>
                {event.healthBefore}% → {event.healthAfter}%
              </span>
            )}
            {event.filesTouched != null && (
              <span className="ml-3 opacity-70">
                {event.filesTouched} {isArabic ? 'ملف' : 'files'}
              </span>
            )}
            {event.issuesFixed != null && (
              <span className="ml-3 text-emerald-400/80">
                {event.issuesFixed} {isArabic ? 'إصلاح' : 'fixed'}
              </span>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={panelRef}
      className="fixed bottom-4 left-4 z-50 flex flex-col bg-[#050016] text-white rounded-2xl overflow-hidden border border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.25),0_0_40px_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.5)]"
      style={{ width: size.width, height: size.height }}
    >
      {/* Resize Handles */}
      {/* Right edge */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-purple-500/20 transition-colors z-10"
        onMouseDown={(e) => handleResizeStart(e, 'right')}
      />
      {/* Top edge */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-purple-500/20 transition-colors z-10"
        onMouseDown={(e) => handleResizeStart(e, 'top')}
      />
      {/* Top-right corner */}
      <div
        className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize hover:bg-purple-500/30 transition-colors z-20"
        onMouseDown={(e) => handleResizeStart(e, 'corner')}
      />

      {/* Header */}
      <div className="relative border-b border-[#2f1a6b] bg-gradient-to-r from-[#160337] via-[#220a57] to-[#160337] px-4 py-3 shadow-[0_0_24px_rgba(123,92,255,0.55)] rounded-t-2xl ring-1 ring-[#5b3cff]/40">
        {/* Neon glow behind header */}
        <div className="pointer-events-none absolute -inset-x-6 -top-4 h-10 bg-[radial-gradient(circle_at_top,_rgba(123,92,255,0.55),_transparent_60%)] opacity-80 blur-xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">
              {isArabic ? 'جودة المشروع' : 'Project Quality'}
            </h2>
            <p className="mt-0.5 text-[11px] text-white/65">
              {isArabic
                ? 'عرض شامل للفحوصات وACE والاختبارات والتنظيف'
                : 'Combined view of scans, ACE runs, tests, and cleanup sessions'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] text-white/80 transition-colors hover:border-white/35 hover:bg-white/5"
            >
              {isArabic ? 'تحديث' : 'Refresh'}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-white/50 transition-all hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1.5 text-[11px]">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white shadow-[0_0_12px_rgba(255,255,255,0.18)]'
                    : 'bg-white/3 text-white/60 hover:bg-white/8 hover:text-white/80'
                }`}
              >
                {tab.label[locale]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary Row - Dashboard Stats */}
      <div className="border-b border-[#24124f] bg-[#070019] px-4 py-3">
        <div className="grid grid-cols-4 gap-3 text-xs">
          {/* Health */}
          <div className="flex items-center gap-2 rounded-xl bg-white/3 px-2.5 py-2">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <div
                className={`absolute inset-0 rounded-full bg-gradient-to-br ${getHealthRingClasses(
                  summary.healthScore
                )} opacity-90`}
              />
              <div className="absolute inset-[3px] rounded-full bg-[#050012]" />
              <span className="relative text-[11px] font-semibold">
                {summary.healthScore != null ? `${summary.healthScore}%` : '--'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-white/50">
                {isArabic ? 'الصحة' : 'Health'}
              </span>
              <span className="text-[11px] font-semibold">
                {getHealthLabel(summary.healthScore, locale)}
              </span>
            </div>
          </div>

          {/* Tests */}
          <div className="flex items-center gap-2 rounded-xl bg-white/3 px-2.5 py-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-base ${
                summary.testsStatus === 'passing'
                  ? 'bg-[#062819]'
                  : summary.testsStatus === 'failing'
                  ? 'bg-[#2a0410]'
                  : 'bg-[#1a1a2e]'
              }`}
            >
              {summary.testsStatus === 'passing'
                ? '✅'
                : summary.testsStatus === 'failing'
                ? '❌'
                : '🧪'}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-white/50">
                {isArabic ? 'الاختبارات' : 'Tests'}
              </span>
              <span className="text-[11px] font-semibold">
                {summary.testsStatus === 'passing'
                  ? isArabic
                    ? 'ناجحة'
                    : 'Passing'
                  : summary.testsStatus === 'failing'
                  ? isArabic
                    ? 'فاشلة'
                    : 'Failing'
                  : isArabic
                  ? 'لم تُشغّل'
                  : 'Not run'}
              </span>
            </div>
          </div>

          {/* Issues */}
          <div className="flex items-center gap-2 rounded-xl bg-white/3 px-2.5 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2a0410] text-sm">
              🧩
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-white/50">
                {isArabic ? 'المشاكل' : 'Issues'}
              </span>
              <span className="text-[11px] font-semibold">
                {summary.totalIssues != null ? summary.totalIssues : '—'}
              </span>
            </div>
          </div>

          {/* Last Scan */}
          <div className="flex items-center gap-2 rounded-xl bg-white/3 px-2.5 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#07152b] text-sm">
              ⏱️
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-white/50">
                {isArabic ? 'آخر فحص' : 'Last scan'}
              </span>
              <span className="text-[11px] font-semibold">
                {summary.lastScanAt
                  ? new Date(summary.lastScanAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : isArabic
                  ? 'لا يوجد'
                  : 'No scans'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline with custom scrollbar */}
      <div className="flex-1 overflow-y-auto px-4 py-3 text-xs scrollbar-thin">
        {/* Phase 133.4: Test Insights Card - shown only in Tests tab */}
        {activeTab === 'tests' && (
          <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-[#031a12] via-[#031b1a] to-[#020f0a] px-4 py-3 shadow-[0_0_24px_rgba(16,185,129,0.18)]">
            {/* Header with stats */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-emerald-100 uppercase tracking-[0.15em]">
                    {isArabic ? 'رؤى الاختبارات' : 'Test Insights'}
                  </h3>
                  <p className="text-[10px] text-emerald-100/60 mt-0.5">
                    {isArabic ? 'نظرة على التغطية والاستقرار' : 'Coverage and stability snapshot'}
                  </p>
                </div>
                <button
                  onClick={() => refreshTestLab()}
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-100/80 hover:bg-emerald-500/20 transition-colors"
                  title={isArabic ? 'تحديث' : 'Refresh'}
                >
                  {testLabState.isLoading ? '...' : '↻'}
                </button>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <div className="text-right">
                  <div className="text-emerald-100 font-semibold">{testInsights.passRate}%</div>
                  <div className="text-emerald-100/50 text-[9px]">{isArabic ? 'معدل النجاح' : 'Pass rate'}</div>
                </div>
                <div className="h-6 w-px bg-emerald-500/30" />
                <div className="text-right">
                  <div className="text-emerald-100 font-semibold">{testInsights.totalSuites}</div>
                  <div className="text-emerald-100/50 text-[9px]">{isArabic ? 'مجموعات' : 'Suites'}</div>
                </div>
                <div className="text-right">
                  <div className="text-red-300 font-semibold">{testInsights.failingSuites}</div>
                  <div className="text-red-300/60 text-[9px]">{isArabic ? 'فاشلة' : 'Failing'}</div>
                </div>
              </div>
            </div>

            {/* Two-column grid: Uncovered files + Failing suites */}
            <div className="grid gap-3 md:grid-cols-2">
              {/* Uncovered files */}
              <div className="rounded-xl border border-emerald-500/15 bg-black/20 px-3 py-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-emerald-50">
                    {isArabic ? 'ملفات بدون اختبارات' : 'Files with no tests'}
                  </span>
                  <span className="text-[9px] text-emerald-100/50">
                    {testInsights.uncoveredFiles.length} {isArabic ? 'ملف' : 'files'}
                  </span>
                </div>

                {testInsights.uncoveredFiles.length === 0 ? (
                  <p className="text-[10px] text-emerald-100/50">
                    {isArabic
                      ? 'خريطة التغطية لم تُهيّأ بعد. شغّل الاختبارات مرة واحدة على الأقل أو اضغط ↻'
                      : 'Coverage map not initialized. Click ↻ to scan project files.'}
                  </p>
                ) : (
                  <div className="space-y-1 max-h-28 overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-500/30">
                    {testInsights.uncoveredFiles.slice(0, 5).map((filePath) => {
                      const fileName = filePath.split('/').pop() || filePath;
                      return (
                        <div
                          key={filePath}
                          className="flex items-center justify-between rounded-lg bg-emerald-900/20 px-2 py-1.5"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-emerald-50 truncate" title={filePath}>
                              {fileName}
                            </span>
                            <span className="text-[9px] text-emerald-200/50">No tests</span>
                          </div>
                          <button
                            onClick={() => requestTestGeneration(filePath, '')}
                            className="shrink-0 ml-2 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-[2px] text-[9px] font-medium text-emerald-50 hover:bg-emerald-500/20 transition-colors"
                          >
                            {isArabic ? 'توليد' : 'Generate'}
                          </button>
                        </div>
                      );
                    })}
                    {testInsights.uncoveredFiles.length > 5 && (
                      <p className="text-[9px] text-emerald-100/50 mt-1">
                        +{testInsights.uncoveredFiles.length - 5} {isArabic ? 'ملفات أخرى' : 'more files'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Failing suites */}
              <div className="rounded-xl border border-red-500/20 bg-[#1b0509]/50 px-3 py-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-red-50">
                    {isArabic ? 'مجموعات فاشلة' : 'Failing suites'}
                  </span>
                  <span className="text-[9px] text-red-100/60">
                    {testInsights.failingSuitesList.length} {isArabic ? 'فاشلة' : 'failing'}
                  </span>
                </div>

                {testInsights.failingSuitesList.length === 0 ? (
                  <p className="text-[10px] text-red-100/60">
                    {testInsights.totalSuites === 0
                      ? (isArabic ? 'لم يتم اكتشاف مجموعات اختبار بعد' : 'No test suites discovered yet')
                      : (isArabic ? 'لا توجد مجموعات فاشلة ✓' : 'No failing suites ✓')}
                  </p>
                ) : (
                  <div className="space-y-1 max-h-28 overflow-y-auto scrollbar-thin scrollbar-thumb-red-500/30">
                    {testInsights.failingSuitesList.slice(0, 5).map((suite) => {
                      const suiteName = suite.testFilePath.split('/').pop() || suite.name;
                      return (
                        <div
                          key={suite.id}
                          className="flex items-center justify-between rounded-lg bg-red-900/30 px-2 py-1.5"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] text-red-50 truncate" title={suite.testFilePath}>
                              {suiteName}
                            </span>
                            <span className="text-[9px] text-red-200/60">
                              {suite.lastRun?.finishedAt
                                ? new Date(suite.lastRun.finishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : isArabic ? 'غير معروف' : 'unknown'}
                            </span>
                          </div>
                          <span className="shrink-0 ml-2 rounded-full bg-red-500/20 px-1.5 py-[1px] text-[9px] text-red-100">
                            ✗ {isArabic ? 'فشل' : 'Fail'}
                          </span>
                        </div>
                      );
                    })}
                    {testInsights.failingSuitesList.length > 5 && (
                      <p className="text-[9px] text-red-100/50 mt-1">
                        +{testInsights.failingSuitesList.length - 5} {isArabic ? 'مجموعات أخرى' : 'more suites'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {filteredEvents.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-2 text-center text-white/55">
            <div className="text-2xl opacity-40">🫧</div>
            <div className="text-[13px] font-medium">
              {isArabic ? 'لا توجد أحداث في هذا العرض' : 'No events in this view yet'}
            </div>
            <div className="text-[11px] text-white/45">
              {isArabic
                ? 'قم بتشغيل فحص صحة الكود أو ACE أو الاختبارات أو التنظيف'
                : 'Try running a Code Health scan, ACE evolution, tests, or a cleanup session'}
            </div>
          </div>
        ) : (
          <ol className="space-y-3">
            {filteredEvents.map((event) => (
              <li key={event.id} className="flex gap-3">
                {/* Timeline dot and line */}
                <div className="flex flex-col items-center">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#24124f] text-base shadow-[0_0_10px_rgba(76,29,149,0.5)]">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="h-full w-px flex-1 bg-gradient-to-b from-[#3b2a7f] to-transparent" />
                </div>

                {/* Event card */}
                <div className="flex-1 rounded-xl bg-[#0b0122] px-3 py-2.5 shadow-sm ring-1 ring-white/5 transition-colors hover:ring-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-1.5 py-[1px] text-[9px] uppercase tracking-wide ${getTypeBadgeClasses(
                          event.type
                        )}`}
                      >
                        {event.type.toUpperCase()}
                      </span>
                      <span className="text-[11px] font-semibold text-white/90">
                        {getEventTitle(event.type, locale)}
                      </span>
                    </div>
                    <div className="text-[10px] text-white/45">
                      {formatRelativeTime(event.createdAt)}
                    </div>
                  </div>

                  {/* Event-specific details */}
                  {renderEventDetails(event)}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#24124f] px-4 py-2 text-[10px] text-white/40">
        {isArabic
          ? `${filteredEvents.length} حدث مسجل`
          : `${filteredEvents.length} events recorded`}
      </div>
    </div>
  );
};

export default ProjectQualityPanel;
