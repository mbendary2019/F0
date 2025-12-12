// src/features/projects/FileDiffViewer.tsx
// Phase 82 Part 2: File Diff Viewer - Side-by-side before/after comparison

'use client';

import { useMemo } from 'react';

interface FileDiffViewerProps {
  filePath: string;
  oldContent: string;
  newContent: string;
  locale?: 'ar' | 'en';
}

interface DiffLine {
  lineNumber: number | null;
  type: 'unchanged' | 'added' | 'removed';
  content: string;
}

interface SideBySideDiff {
  left: DiffLine[];
  right: DiffLine[];
}

/**
 * Simple diff algorithm - creates side-by-side view
 * For production, consider using diff-match-patch or similar library
 */
function createSideBySideDiff(oldContent: string, newContent: string): SideBySideDiff {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const left: DiffLine[] = [];
  const right: DiffLine[] = [];

  // Simple line-by-line comparison
  // This is a basic implementation - can be enhanced with proper diff algorithm
  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      // Line added
      left.push({ lineNumber: null, type: 'unchanged', content: '' });
      right.push({ lineNumber: i + 1, type: 'added', content: newLine });
    } else if (newLine === undefined) {
      // Line removed
      left.push({ lineNumber: i + 1, type: 'removed', content: oldLine });
      right.push({ lineNumber: null, type: 'unchanged', content: '' });
    } else if (oldLine === newLine) {
      // Line unchanged
      left.push({ lineNumber: i + 1, type: 'unchanged', content: oldLine });
      right.push({ lineNumber: i + 1, type: 'unchanged', content: newLine });
    } else {
      // Line modified
      left.push({ lineNumber: i + 1, type: 'removed', content: oldLine });
      right.push({ lineNumber: i + 1, type: 'added', content: newLine });
    }
  }

  return { left, right };
}

export function FileDiffViewer({
  filePath,
  oldContent,
  newContent,
  locale = 'en',
}: FileDiffViewerProps) {
  const diff = useMemo(
    () => createSideBySideDiff(oldContent, newContent),
    [oldContent, newContent]
  );

  const labels =
    locale === 'ar'
      ? {
          before: 'قبل',
          after: 'بعد',
          lineNumber: 'رقم السطر',
        }
      : {
          before: 'Before',
          after: 'After',
          lineNumber: 'Line',
        };

  const renderDiffSide = (lines: DiffLine[], title: string) => (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
        <div className="text-sm font-semibold text-gray-300">{title}</div>
      </div>

      {/* Lines */}
      <div className="font-mono text-sm overflow-x-auto">
        {lines.map((line, idx) => {
          const bgColor =
            line.type === 'added'
              ? 'bg-green-900/30'
              : line.type === 'removed'
              ? 'bg-red-900/30'
              : 'bg-gray-900';

          const lineNumColor =
            line.type === 'added'
              ? 'text-green-400'
              : line.type === 'removed'
              ? 'text-red-400'
              : 'text-gray-500';

          const textColor =
            line.type === 'added'
              ? 'text-green-200'
              : line.type === 'removed'
              ? 'text-red-200'
              : 'text-gray-300';

          return (
            <div key={idx} className={`flex ${bgColor} hover:bg-gray-800/50`}>
              {/* Line number */}
              <div
                className={`px-4 py-1 text-right min-w-[60px] border-r border-gray-700 ${lineNumColor} select-none`}
              >
                {line.lineNumber || ''}
              </div>

              {/* Line content */}
              <div className={`px-4 py-1 flex-1 whitespace-pre ${textColor}`}>
                {line.content || ' '}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
      {/* File header */}
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
        <div className="text-sm font-mono text-blue-400">{filePath}</div>
      </div>

      {/* Side-by-side diff */}
      <div className="flex">
        {renderDiffSide(diff.left, labels.before)}
        <div className="w-px bg-gray-700"></div>
        {renderDiffSide(diff.right, labels.after)}
      </div>
    </div>
  );
}
