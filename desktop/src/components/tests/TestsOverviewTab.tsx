// desktop/src/components/tests/TestsOverviewTab.tsx
// Phase 130.4: Tests Overview Tab
// Phase 133.2: Improved layout with separate cards/banners

import React from 'react';
import type { TestSuite, TestStatus, TestRunSummary } from '../../lib/tests/testTypes';

interface Props {
  locale: 'ar' | 'en';
  suites: TestSuite[];
  lastRun: TestRunSummary | null;
  passRate: number;
  totalRuns: number;
  lastStatus: TestStatus | null;
  isRunning: boolean;
  onRunSuite: (suiteId: string) => void;
}

export const TestsOverviewTab: React.FC<Props> = ({
  locale,
  suites,
  lastRun,
  passRate,
  totalRuns,
  lastStatus,
  isRunning,
  onRunSuite,
}) => {
  const isRTL = locale === 'ar';

  const getStatusIcon = (status: TestStatus | null): string => {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'partial': return '⚠️';
      case 'running': return '🔄';
      default: return '❓';
    }
  };

  const getStatusText = (status: TestStatus | null): string => {
    if (isRTL) {
      switch (status) {
        case 'passed': return 'جميع الاختبارات ناجحة';
        case 'failed': return 'بعض الاختبارات فشلت';
        case 'partial': return 'اختبارات جزئية';
        case 'running': return 'جارٍ التشغيل...';
        default: return 'لم تُشغَّل بعد';
      }
    }
    switch (status) {
      case 'passed': return 'All Tests Passing';
      case 'failed': return 'Some Tests Failing';
      case 'partial': return 'Partial Success';
      case 'running': return 'Running...';
      default: return 'Not Run Yet';
    }
  };

  const getStatusColors = (status: TestStatus | null): { bg: string; ring: string; text: string } => {
    switch (status) {
      case 'passed':
        return { bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30', text: 'text-emerald-400' };
      case 'failed':
        return { bg: 'bg-red-500/10', ring: 'ring-red-500/30', text: 'text-red-400' };
      case 'partial':
        return { bg: 'bg-amber-500/10', ring: 'ring-amber-500/30', text: 'text-amber-400' };
      default:
        return { bg: 'bg-white/5', ring: 'ring-white/10', text: 'text-white/60' };
    }
  };

  const getFrameworkIcon = (framework: string): string => {
    switch (framework) {
      case 'jest': return '🃏';
      case 'vitest': return '⚡';
      case 'playwright': return '🎭';
      case 'cypress': return '🌲';
      default: return '🧪';
    }
  };

  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (isRTL) {
      if (diffMins < 1) return 'الآن';
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      return `منذ ${diffDays} يوم`;
    }

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (suites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="text-4xl mb-3 opacity-50">🧪</div>
        <h3 className="text-sm font-semibold text-white/90 mb-1">
          {isRTL ? 'لا توجد اختبارات' : 'No Tests Found'}
        </h3>
        <p className="text-[11px] text-white/50 max-w-[250px]">
          {isRTL
            ? 'لم نجد أي test suites في هذا المشروع. تأكد من وجود Jest أو Vitest أو Playwright.'
            : 'No test suites were discovered. Make sure you have Jest, Vitest, or Playwright configured.'}
        </p>
      </div>
    );
  }

  const statusColors = getStatusColors(lastStatus);

  return (
    <div className="flex flex-col gap-3">
      {/* Status Banner */}
      <div className={`rounded-xl ${statusColors.bg} ${statusColors.ring} ring-1 p-3`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full ${statusColors.bg} flex items-center justify-center text-2xl`}>
            {getStatusIcon(lastStatus)}
          </div>
          <div className="flex-1">
            <h3 className={`text-sm font-semibold ${statusColors.text}`}>
              {getStatusText(lastStatus)}
            </h3>
            <p className="text-[11px] text-white/50 mt-0.5">
              {lastRun
                ? isRTL
                  ? `آخر تشغيل: ${formatTimeAgo(lastRun.runAt)}`
                  : `Last run: ${formatTimeAgo(lastRun.runAt)}`
                : isRTL
                  ? 'لم تُشغَّل الاختبارات بعد'
                  : 'Tests have not been run yet'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
        <h4 className="text-[10px] uppercase tracking-wide text-white/40 mb-2">
          {isRTL ? 'الإحصائيات' : 'Statistics'}
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {/* Suites */}
          <div className="rounded-lg bg-white/5 p-2.5 text-center">
            <div className="text-lg font-bold text-white">{suites.length}</div>
            <div className="text-[10px] text-white/50">{isRTL ? 'مجموعات' : 'Suites'}</div>
          </div>
          {/* Pass Rate */}
          <div className="rounded-lg bg-white/5 p-2.5 text-center">
            <div className={`text-lg font-bold ${passRate >= 80 ? 'text-emerald-400' : passRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {passRate}%
            </div>
            <div className="text-[10px] text-white/50">{isRTL ? 'نسبة النجاح' : 'Pass Rate'}</div>
          </div>
          {/* Runs */}
          <div className="rounded-lg bg-white/5 p-2.5 text-center">
            <div className="text-lg font-bold text-white">{totalRuns}</div>
            <div className="text-[10px] text-white/50">{isRTL ? 'تشغيلات' : 'Runs'}</div>
          </div>
        </div>
      </div>

      {/* Test Suites List */}
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
        <h4 className="text-[10px] uppercase tracking-wide text-white/40 mb-2">
          {isRTL ? 'مجموعات الاختبار' : 'Test Suites'}
        </h4>
        <div className="flex flex-col gap-1.5">
          {suites.map((suite) => (
            <div
              key={suite.id}
              className="flex items-center justify-between rounded-lg bg-white/5 hover:bg-white/8 transition-colors px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-base flex-shrink-0">{getFrameworkIcon(suite.framework)}</span>
                <span className="text-[12px] text-white/90 truncate">{suite.name}</span>
                <span className="text-[10px] text-white/40 flex-shrink-0">({suite.framework})</span>
              </div>
              <button
                className="flex-shrink-0 ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 hover:border-emerald-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => onRunSuite(suite.id)}
                disabled={isRunning}
              >
                {isRTL ? 'تشغيل' : 'Run'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
