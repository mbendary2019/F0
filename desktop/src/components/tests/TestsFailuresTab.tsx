// desktop/src/components/tests/TestsFailuresTab.tsx
// Phase 130.4: Tests Failures Tab

import React from 'react';
import type { TestFailure } from '../../lib/tests/testTypes';

interface Props {
  locale: 'ar' | 'en';
  failures: TestFailure[];
  onOpenFile?: (filePath: string, line?: number) => void;
}

export const TestsFailuresTab: React.FC<Props> = ({
  locale,
  failures,
  onOpenFile,
}) => {
  const isRTL = locale === 'ar';

  // Group failures by file
  const groupedFailures = failures.reduce<Record<string, TestFailure[]>>((acc, failure) => {
    const file = failure.file || 'Unknown';
    if (!acc[file]) {
      acc[file] = [];
    }
    acc[file].push(failure);
    return acc;
  }, {});

  const fileGroups = Object.entries(groupedFailures);

  if (failures.length === 0) {
    return (
      <div className="tests-empty">
        <div className="icon">🎉</div>
        <p>{isRTL ? 'لا توجد اختبارات فاشلة!' : 'No failing tests!'}</p>
        <p style={{ fontSize: '0.85rem', color: '#22c55e' }}>
          {isRTL ? 'جميع الاختبارات ناجحة' : 'All tests are passing'}
        </p>
      </div>
    );
  }

  return (
    <div className="tests-failures">
      <div style={{ marginBottom: '0.75rem', color: '#888', fontSize: '0.85rem' }}>
        {isRTL
          ? `${failures.length} اختبار فاشل في ${fileGroups.length} ملف`
          : `${failures.length} failing test${failures.length === 1 ? '' : 's'} in ${fileGroups.length} file${fileGroups.length === 1 ? '' : 's'}`}
      </div>

      {fileGroups.map(([file, fileFailures]) => (
        <div key={file} className="failure-item">
          <div className="failure-header">
            <span className="failure-file">{file}</span>
            <button
              className="failure-open-btn"
              onClick={() => onOpenFile?.(file)}
            >
              {isRTL ? 'فتح' : 'Open'}
            </button>
          </div>
          <div className="failure-body">
            {fileFailures.map((failure, idx) => (
              <div key={idx} style={{ marginBottom: idx < fileFailures.length - 1 ? '0.75rem' : 0 }}>
                <div className="failure-test-name">
                  {failure.suiteName && (
                    <span style={{ color: '#888' }}>{failure.suiteName} › </span>
                  )}
                  {failure.testName}
                </div>
                {failure.message && (
                  <div className="failure-message">
                    {failure.message}
                    {failure.expected && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <span style={{ color: '#22c55e' }}>Expected: </span>
                        {failure.expected}
                      </div>
                    )}
                    {failure.actual && (
                      <div>
                        <span style={{ color: '#ef4444' }}>Received: </span>
                        {failure.actual}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

