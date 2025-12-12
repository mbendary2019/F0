// desktop/src/components/tests/TestsStatusButton.tsx
// Phase 130.8: Tests Status Button with Badge

import React from 'react';
import { useTests } from '../../state/testResultsContext';
import type { TestStatus } from '../../lib/tests/testTypes';

interface Props {
  onClick: () => void;
  locale?: 'ar' | 'en';
}

/**
 * Get badge color based on test status
 */
function getBadgeColor(status: TestStatus | null): string {
  switch (status) {
    case 'passed': return '#22c55e'; // green
    case 'failed': return '#ef4444'; // red
    case 'partial': return '#f59e0b'; // amber
    case 'error': return '#ef4444'; // red
    case 'skipped': return '#6b7280'; // gray
    default: return 'transparent';
  }
}

/**
 * Tests Status Button - Shows test status badge
 */
export const TestsStatusButton: React.FC<Props> = ({ onClick, locale = 'ar' }) => {
  const { lastStatus, isRunning, lastRun, hasTests } = useTests();
  const isArabic = locale === 'ar';

  // Get badge content
  const showBadge = hasTests && (lastStatus !== null || isRunning);
  const badgeColor = getBadgeColor(lastStatus);
  const badgeText = isRunning ? '...' : (lastRun?.failureCount ?? 0) > 0 ? lastRun?.failureCount : '';

  return (
    <button
      className={`f0-tests-btn ${isRunning ? 'running' : ''} ${lastStatus ? `status-${lastStatus}` : ''}`}
      onClick={onClick}
      title={isArabic ? 'الاختبارات' : 'Tests'}
    >
      🧪
      {showBadge && (
        <span
          className="f0-tests-badge"
          style={{ backgroundColor: badgeColor }}
        >
          {badgeText}
        </span>
      )}
      {isRunning && <span className="f0-tests-spinner" />}
    </button>
  );
};

export default TestsStatusButton;
