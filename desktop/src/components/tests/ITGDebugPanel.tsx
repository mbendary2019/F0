// desktop/src/components/tests/ITGDebugPanel.tsx
// Phase 139.6: ITG Debug Panel for diagnostics
// Shows debug snapshot with Show/Hide toggle

import React, { useState, useMemo } from 'react';
import { useTestLab } from '../../state/testLabContext';

/**
 * Check if debug mode is enabled via env flag
 */
function isDebugModeEnabled(): boolean {
  if (typeof process !== 'undefined') {
    return (
      process.env?.NEXT_PUBLIC_ITG_DEBUG === '1' ||
      process.env?.NEXT_PUBLIC_ITG_DEBUG === 'true'
    );
  }
  return false;
}

/**
 * ITG Debug Panel Component
 * Displays debug snapshot info with a collapsible UI
 */
export const ITGDebugPanel: React.FC = () => {
  const { itgDebugSnapshot, itgStatus } = useTestLab();

  // Auto-show if env flag is set, otherwise default to collapsed
  const [isExpanded, setIsExpanded] = useState(() => isDebugModeEnabled());

  // Don't show panel if no debug snapshot
  if (!itgDebugSnapshot) {
    return null;
  }

  const {
    indexFileCount,
    analyzableFileCount,
    excludedFileCount,
    maxFilesConfigured,
    maxSuggestionsConfigured,
    riskEntriesCount,
    suggestionsCount,
    baselineCoverage,
    projectedCoverage,
    notes,
  } = itgDebugSnapshot;

  return (
    <div className="border border-zinc-700 rounded-lg bg-zinc-900/50 mt-4">
      {/* Header with toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/50 transition-colors text-left"
      >
        <span className="text-xs font-medium text-zinc-400 flex items-center gap-2">
          <span className="text-amber-500">🔍</span>
          ITG Debug Info
          {itgStatus === 'running' && (
            <span className="text-xs text-blue-400">(running...)</span>
          )}
        </span>
        <span className="text-zinc-500 text-xs">
          {isExpanded ? '▼ Hide' : '▶ Show'}
        </span>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-zinc-700/50">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <DebugStat label="Index Files" value={indexFileCount} />
            <DebugStat label="Analyzable" value={analyzableFileCount} />
            <DebugStat label="Excluded" value={excludedFileCount} />
            <DebugStat label="Risk Entries" value={riskEntriesCount} />
            <DebugStat label="Suggestions" value={suggestionsCount} />
            <DebugStat label="Max Files" value={maxFilesConfigured} />
            <DebugStat label="Max Suggestions" value={maxSuggestionsConfigured} />
          </div>

          {/* Coverage stats */}
          {(baselineCoverage !== undefined || projectedCoverage !== undefined) && (
            <div className="flex gap-4 text-xs text-zinc-400 pt-2 border-t border-zinc-700/30">
              {baselineCoverage !== undefined && (
                <span>Baseline: <span className="text-zinc-200">{baselineCoverage}%</span></span>
              )}
              {projectedCoverage !== undefined && (
                <span>Projected: <span className="text-green-400">{projectedCoverage}%</span></span>
              )}
            </div>
          )}

          {/* Notes */}
          {notes && notes.length > 0 && (
            <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-700/30">
              <div className="font-medium text-zinc-400 mb-1">Notes:</div>
              <ul className="list-disc list-inside space-y-0.5">
                {notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Debug stat display component
 */
const DebugStat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-zinc-500">{label}</span>
    <span className="text-zinc-300 font-mono">{value}</span>
  </div>
);

export default ITGDebugPanel;
