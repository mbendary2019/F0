// desktop/src/components/tests/IntelligentTestGeneratorPanel.tsx
// Phase 139.3: ITG UI Panel for Test Center
// Phase 139.4: Added Risk Summary Panel & Coverage Delta Badge
// Phase 139.6: Added ITGDebugPanel integration
// Displays test suggestions from the Intelligent Test Generator

'use client';

import React, { useState } from 'react';
import type { ITGTestSuggestion, ITGFileRisk } from '../../lib/testing/itg/itgTypes';
import {
  formatCoverageDelta,
  getCoverageColorClass,
} from '../../lib/testing/itg/itgCoverageHelpers';
import { useTestLab } from '../../state/testLabContext';
import { ITGDebugPanel } from './ITGDebugPanel';

/**
 * Priority badge colors
 */
const priorityColors: Record<string, { bg: string; text: string }> = {
  P0: { bg: 'bg-red-600/30', text: 'text-red-300' },
  P1: { bg: 'bg-yellow-600/30', text: 'text-yellow-300' },
  P2: { bg: 'bg-green-600/30', text: 'text-green-300' },
};

/**
 * Single suggestion card
 */
const ITGSuggestionCard: React.FC<{
  suggestion: ITGTestSuggestion;
  onInsert?: (suggestion: ITGTestSuggestion) => void;
}> = ({ suggestion, onInsert }) => {
  const [expanded, setExpanded] = useState(false);
  const colors = priorityColors[suggestion.priority] || priorityColors.P2;

  return (
    <div className="bg-[#1b0d38] border border-[#3a1d75] p-3 rounded-lg hover:border-purple-500/50 transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-purple-200 text-sm truncate">
            {suggestion.symbolName ? `${suggestion.symbolName}()` : suggestion.filePath.split('/').pop()}
          </p>
          <p className="text-[10px] text-purple-400/70 truncate mt-0.5">
            {suggestion.filePath}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded ${colors.bg} ${colors.text} font-medium`}>
            {suggestion.priority}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-700/30 text-purple-300">
            {suggestion.kind}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-purple-300/80 mt-2 line-clamp-2">{suggestion.description}</p>

      {/* Coverage gain */}
      {suggestion.estimatedCoverageGain != null && suggestion.estimatedCoverageGain > 0 && (
        <p className="text-[10px] text-green-400/80 mt-1">
          +{suggestion.estimatedCoverageGain}% coverage gain
        </p>
      )}

      {/* Expand/Collapse snippet */}
      {suggestion.snippet && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
          >
            <span>{expanded ? '▼' : '▶'}</span>
            <span>{expanded ? 'Hide' : 'Show'} test snippet</span>
          </button>

          {expanded && (
            <pre className="mt-2 bg-black/30 p-2 rounded text-[10px] text-purple-200/90 overflow-x-auto max-h-48 overflow-y-auto border border-purple-900/30">
              {suggestion.snippet}
            </pre>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onInsert?.(suggestion)}
          className="px-3 py-1.5 rounded bg-purple-600/50 hover:bg-purple-600/70 text-xs text-purple-100 transition-colors flex items-center gap-1.5"
        >
          <span>📝</span>
          <span>Insert Test</span>
        </button>
        <button
          onClick={() => {
            if (suggestion.snippet) {
              navigator.clipboard.writeText(suggestion.snippet);
            }
          }}
          className="px-3 py-1.5 rounded bg-purple-900/30 hover:bg-purple-900/50 text-xs text-purple-300 transition-colors flex items-center gap-1.5"
        >
          <span>📋</span>
          <span>Copy</span>
        </button>
      </div>
    </div>
  );
};

/**
 * Suggestions list
 */
const ITGSuggestionsList: React.FC<{
  suggestions: ITGTestSuggestion[];
  onInsert?: (suggestion: ITGTestSuggestion) => void;
}> = ({ suggestions, onInsert }) => {
  if (!suggestions.length) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-purple-300/70">No test suggestions generated yet.</p>
        <p className="text-xs text-purple-400/50 mt-1">
          Press "Smart Tests" to analyze your project and generate suggestions.
        </p>
      </div>
    );
  }

  // Group by priority
  const grouped = {
    P0: suggestions.filter((s) => s.priority === 'P0'),
    P1: suggestions.filter((s) => s.priority === 'P1'),
    P2: suggestions.filter((s) => s.priority === 'P2'),
  };

  return (
    <div className="space-y-4">
      {/* P0 - Critical */}
      {grouped.P0.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-red-400/80 mb-2 flex items-center gap-1.5">
            <span>🔴</span>
            <span>Critical Priority ({grouped.P0.length})</span>
          </h4>
          <div className="space-y-2">
            {grouped.P0.map((s) => (
              <ITGSuggestionCard key={s.id} suggestion={s} onInsert={onInsert} />
            ))}
          </div>
        </div>
      )}

      {/* P1 - High */}
      {grouped.P1.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-yellow-400/80 mb-2 flex items-center gap-1.5">
            <span>🟡</span>
            <span>High Priority ({grouped.P1.length})</span>
          </h4>
          <div className="space-y-2">
            {grouped.P1.map((s) => (
              <ITGSuggestionCard key={s.id} suggestion={s} onInsert={onInsert} />
            ))}
          </div>
        </div>
      )}

      {/* P2 - Normal */}
      {grouped.P2.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-green-400/80 mb-2 flex items-center gap-1.5">
            <span>🟢</span>
            <span>Normal Priority ({grouped.P2.length})</span>
          </h4>
          <div className="space-y-2">
            {grouped.P2.map((s) => (
              <ITGSuggestionCard key={s.id} suggestion={s} onInsert={onInsert} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Phase 139.4: Mini Risk Panel showing top high-risk files
 */
const ITGRiskSummaryPanel: React.FC<{
  risks: ITGFileRisk[];
  maxDisplay?: number;
}> = ({ risks, maxDisplay = 5 }) => {
  if (!risks.length) return null;

  // Sort by impact score descending, take top N
  const topRisks = [...risks]
    .sort((a, b) => (b.estimatedImpactScore ?? 0) - (a.estimatedImpactScore ?? 0))
    .slice(0, maxDisplay);

  return (
    <div className="bg-[#1b0d38] rounded-lg border border-purple-900/30 p-3 mb-4">
      <h4 className="text-xs font-medium text-purple-300/80 mb-2 flex items-center gap-1.5">
        <span>⚠️</span>
        <span>High-Risk Files ({risks.length})</span>
      </h4>
      <div className="space-y-1.5">
        {topRisks.map((risk) => (
          <div
            key={risk.path}
            className="flex items-center justify-between gap-2 text-[10px] p-1.5 rounded bg-black/20 hover:bg-black/30 transition-colors"
          >
            <span className="text-purple-200 truncate flex-1" title={risk.path}>
              {risk.path.split('/').pop()}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-purple-400/70">
                {risk.estimatedImpactScore?.toFixed(0) ?? 0}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  (risk.estimatedImpactScore ?? 0) >= 80
                    ? 'bg-red-500'
                    : (risk.estimatedImpactScore ?? 0) >= 50
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
      {risks.length > maxDisplay && (
        <p className="text-[10px] text-purple-400/50 mt-2 text-center">
          +{risks.length - maxDisplay} more files
        </p>
      )}
    </div>
  );
};

/**
 * Main ITG Panel
 */
export const IntelligentTestGeneratorPanel: React.FC<{
  className?: string;
  onInsertTest?: (suggestion: ITGTestSuggestion) => void;
}> = ({ className = '', onInsertTest }) => {
  const {
    itgStatus,
    itgSuggestions,
    itgBaselineCoverage,
    itgProjectedCoverage,
    itgLastRunAt,
    itgError,
    itgRisks,
    generateSmartTests,
    clearITGSuggestions,
  } = useTestLab();

  const hasRun = itgLastRunAt != null;
  const hasResults = itgSuggestions.length > 0;

  // Phase 139.4: Compute coverage delta
  const coverageDelta =
    itgBaselineCoverage != null && itgProjectedCoverage != null
      ? itgProjectedCoverage - itgBaselineCoverage
      : null;

  return (
    <div className={`rounded-lg bg-[#0f0720] border border-[#2c155a] p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-purple-100 flex items-center gap-2">
          <span>🧠</span>
          <span>Intelligent Test Generator</span>
          {/* Phase 139.4: Coverage delta badge */}
          {coverageDelta != null && coverageDelta > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${getCoverageColorClass(itgProjectedCoverage ?? 0).replace('text-', 'bg-').replace('-400', '-500/30')} ${getCoverageColorClass(itgProjectedCoverage ?? 0)} font-medium`}>
              {formatCoverageDelta(coverageDelta)}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {hasResults && (
            <button
              onClick={clearITGSuggestions}
              className="text-[10px] px-2 py-1 rounded bg-red-900/30 hover:bg-red-900/50 text-red-300 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => generateSmartTests({ projectId: 'current-project' })}
            disabled={itgStatus === 'running'}
            className="text-xs px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-1.5"
          >
            {itgStatus === 'running' ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Smart Tests</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status / Info */}
      {!hasRun && itgStatus === 'idle' && (
        <div className="text-center py-8 text-purple-300/70">
          <p className="text-sm">
            Press <strong className="text-purple-200">Smart Tests</strong> to analyze your project
          </p>
          <p className="text-xs mt-2 text-purple-400/50">
            ITG will analyze code coverage, health issues, and recent changes to suggest high-impact tests.
          </p>
        </div>
      )}

      {/* Running state */}
      {itgStatus === 'running' && (
        <div className="py-8 text-center">
          <div className="inline-block animate-pulse">
            <span className="text-3xl">🧠</span>
          </div>
          <p className="text-sm text-purple-300 mt-3">Analyzing project structure...</p>
          <p className="text-xs text-purple-400/60 mt-1">Generating smart test suggestions</p>
        </div>
      )}

      {/* Error state */}
      {itgError && (
        <div className="bg-red-900/30 border border-red-700/50 p-3 rounded-lg mb-4">
          <p className="text-sm text-red-300 flex items-center gap-2">
            <span>❌</span>
            <span>Error: {itgError}</span>
          </p>
        </div>
      )}

      {/* Results */}
      {hasRun && itgStatus !== 'running' && (
        <>
          {/* Coverage Summary */}
          {(itgBaselineCoverage != null || itgProjectedCoverage != null) && (
            <div className="mb-4 p-3 bg-[#1b0d38] rounded-lg border border-purple-900/30">
              <div className="flex items-center justify-between">
                <p className="text-xs text-purple-300/80">Coverage Projection</p>
                <p className="text-xs text-purple-400/60">
                  {itgLastRunAt && new Date(itgLastRunAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-lg font-semibold text-purple-200">
                  {itgBaselineCoverage?.toFixed(0) ?? '?'}%
                </span>
                <span className="text-purple-400">→</span>
                <span className="text-lg font-semibold text-green-400">
                  {itgProjectedCoverage?.toFixed(0) ?? '?'}%
                </span>
                {itgBaselineCoverage != null && itgProjectedCoverage != null && (
                  <span className="text-xs text-green-400/80 ml-2">
                    (+{(itgProjectedCoverage - itgBaselineCoverage).toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Phase 139.4: Risk Summary Panel */}
          <ITGRiskSummaryPanel risks={itgRisks} maxDisplay={5} />

          {/* Suggestions count */}
          {hasResults && (
            <p className="text-xs text-purple-400/70 mb-3">
              {itgSuggestions.length} test suggestion{itgSuggestions.length !== 1 ? 's' : ''} generated
            </p>
          )}

          {/* Suggestions list */}
          <ITGSuggestionsList suggestions={itgSuggestions} onInsert={onInsertTest} />

          {/* Phase 139.6: Debug Panel */}
          <ITGDebugPanel />
        </>
      )}
    </div>
  );
};

export default IntelligentTestGeneratorPanel;
