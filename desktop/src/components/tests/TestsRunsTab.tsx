// desktop/src/components/tests/TestsRunsTab.tsx
// Phase 130.4: Tests Runs History Tab

import React from 'react';
import type { TestRunSummary, TestStatus } from '../../lib/tests/testTypes';

interface Props {
  locale: 'ar' | 'en';
  runs: TestRunSummary[];
  onSelectRun?: (runId: string) => void;
}

export const TestsRunsTab: React.FC<Props> = ({
  locale,
  runs,
  onSelectRun,
}) => {
  const isRTL = locale === 'ar';

  const getStatusIcon = (status: TestStatus): string => {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'partial': return '⚠️';
      case 'skipped': return '⏭️';
      case 'error': return '💥';
      default: return '❓';
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getScopeLabel = (scope: string): string => {
    if (isRTL) {
      switch (scope) {
        case 'all': return 'الكل';
        case 'unit': return 'وحدات';
        case 'integration': return 'تكامل';
        case 'e2e': return 'E2E';
        case 'affected': return 'المتأثرة';
        default: return scope;
      }
    }
    switch (scope) {
      case 'all': return 'All Tests';
      case 'unit': return 'Unit Tests';
      case 'integration': return 'Integration';
      case 'e2e': return 'E2E Tests';
      case 'affected': return 'Affected Files';
      default: return scope;
    }
  };

  const getTriggerLabel = (trigger?: string): string => {
    if (isRTL) {
      switch (trigger) {
        case 'ace': return 'ACE';
        case 'cleanup': return 'تنظيف';
        case 'watch': return 'مراقبة';
        default: return 'يدوي';
      }
    }
    switch (trigger) {
      case 'ace': return 'ACE';
      case 'cleanup': return 'Cleanup';
      case 'watch': return 'Watch';
      default: return 'Manual';
    }
  };

  if (runs.length === 0) {
    return (
      <div className="tests-empty">
        <div className="icon">📋</div>
        <p>{isRTL ? 'لا توجد تشغيلات سابقة' : 'No previous runs'}</p>
        <p style={{ fontSize: '0.85rem' }}>
          {isRTL
            ? 'شغّل الاختبارات لرؤية التاريخ هنا'
            : 'Run tests to see history here'}
        </p>
      </div>
    );
  }

  return (
    <div className="tests-runs-list">
      {runs.map((run) => (
        <div
          key={run.id}
          className="run-item"
          onClick={() => onSelectRun?.(run.id)}
        >
          <span className="run-status">{getStatusIcon(run.status)}</span>
          <div className="run-details">
            <div className="run-scope">{getScopeLabel(run.scope)}</div>
            <div className="run-meta">
              <span>{formatDate(run.runAt)}</span>
              <span>{formatDuration(run.durationMs)}</span>
              <span>{getTriggerLabel(run.triggeredBy)}</span>
            </div>
          </div>
          <div className="run-stats">
            <span className="stat-passed">✓ {run.stats.passed}</span>
            {run.stats.failed > 0 && (
              <span className="stat-failed">✗ {run.stats.failed}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

