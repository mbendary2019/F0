/**
 * Insight Card Component
 * Displays AI-generated insights from anomaly detection
 */

'use client';

import { useState } from 'react';

export type InsightData = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  possibleCauses?: string[];
  suggestedActions?: string[];
  metric?: string;
  window?: string;
  score?: number;
  ts: number;
  acknowledged?: boolean;
};

export function InsightCard({ insight, onAcknowledge }: { 
  insight: InsightData; 
  onAcknowledge?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const severityStyles = {
    low: 'border-yellow-300 bg-yellow-50',
    medium: 'border-orange-300 bg-orange-50',
    high: 'border-red-300 bg-red-50'
  };

  const severityIcons = {
    low: '⚠️',
    medium: '🔶',
    high: '🚨'
  };

  const handleAcknowledge = async () => {
    if (!onAcknowledge) return;
    setAcknowledging(true);
    try {
      await onAcknowledge(insight.id);
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div className={`rounded-2xl border-2 p-4 ${severityStyles[insight.severity]} transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-2xl">{severityIcons[insight.severity]}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold">{insight.title}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                insight.severity === 'high' ? 'bg-red-200 text-red-800' :
                insight.severity === 'medium' ? 'bg-orange-200 text-orange-800' :
                'bg-yellow-200 text-yellow-800'
              }`}>
                {insight.severity.toUpperCase()}
              </span>
              {insight.score && (
                <span className="text-xs opacity-60">
                  Score: {insight.score.toFixed(2)}
                </span>
              )}
            </div>
            <p className="text-sm opacity-90">{insight.description}</p>
            {(insight.metric || insight.window) && (
              <div className="flex gap-2 mt-2 text-xs opacity-70">
                {insight.metric && <span>Metric: {insight.metric}</span>}
                {insight.window && <span>• Window: {insight.window}</span>}
                <span>• {new Date(insight.ts).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm underline hover:no-underline"
          >
            {expanded ? 'Hide' : 'Details'}
          </button>
          {onAcknowledge && !insight.acknowledged && (
            <button
              onClick={handleAcknowledge}
              disabled={acknowledging}
              className="text-sm px-3 py-1 rounded-lg bg-white border hover:bg-gray-50 disabled:opacity-50"
            >
              {acknowledging ? 'Acking...' : 'Acknowledge'}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-current space-y-3">
          {insight.possibleCauses && insight.possibleCauses.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">🔍 Possible Causes:</h4>
              <ul className="text-sm space-y-1 opacity-90">
                {insight.possibleCauses.map((cause, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="opacity-60">•</span>
                    <span>{cause}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insight.suggestedActions && insight.suggestedActions.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">💡 Suggested Actions:</h4>
              <ul className="text-sm space-y-1 opacity-90">
                {insight.suggestedActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="opacity-60">{i + 1}.</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Insight List Component
 */
export function InsightList({ 
  insights, 
  onAcknowledge 
}: { 
  insights: InsightData[];
  onAcknowledge?: (id: string) => void;
}) {
  if (insights.length === 0) {
    return (
      <div className="rounded-2xl border p-8 text-center opacity-60">
        <div className="text-4xl mb-2">✅</div>
        <p>No anomalies detected. System operating normally.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {insights.map((insight) => (
        <InsightCard 
          key={insight.id} 
          insight={insight} 
          onAcknowledge={onAcknowledge}
        />
      ))}
    </div>
  );
}

