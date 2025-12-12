'use client';

/**
 * Phase 109.6: AI Activity Widget
 * Real-time activity stream for project dashboard
 */

import React, { useState, useEffect } from 'react';
import { getOriginIcon, getOriginLabel, getModeIcon, type AiLogOrigin, type AiLogMode } from '@/lib/aiLogsClient';
import Link from 'next/link';
import { useLocale } from 'next-intl';

interface ActivityEntry {
  id: string;
  origin: AiLogOrigin;
  type: string;
  description: string;
  filePath?: string;
  createdAt: string;
}

interface AiActivityWidgetProps {
  projectId: string;
  maxItems?: number;
  showViewAll?: boolean;
}

export function AiActivityWidget({ projectId, maxItems = 5, showViewAll = true }: AiActivityWidgetProps) {
  const locale = useLocale();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/logs?limit=${maxItems}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch activity');
      }

      // Transform logs to activity format
      const activityItems: ActivityEntry[] = data.logs.map((log: any) => ({
        id: log.id,
        origin: log.origin,
        type: log.mode,
        description: log.summary || log.message || `${log.mode} via ${log.origin}`,
        filePath: log.filePath,
        createdAt: log.createdAt,
      }));

      setActivities(activityItems);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchActivity();

      // Auto refresh every 30 seconds
      const interval = setInterval(fetchActivity, 30000);
      return () => clearInterval(interval);
    }
  }, [projectId, maxItems]);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading && activities.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent AI Activity</h3>
        <button
          onClick={fetchActivity}
          className="text-sm text-gray-400 hover:text-white"
          title="Refresh"
        >
          🔄
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm mb-4">{error}</div>
      )}

      {activities.length === 0 && !loading ? (
        <div className="text-gray-500 text-center py-6">
          No AI activity yet
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-2 rounded hover:bg-gray-700/50 transition-colors"
            >
              <div className="text-xl flex-shrink-0">
                {getOriginIcon(activity.origin)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 text-xs rounded bg-gray-700 text-gray-300">
                    {getModeIcon(activity.type as AiLogMode)} {activity.type}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(activity.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-300 truncate mt-1">
                  {activity.description}
                </p>
                {activity.filePath && (
                  <p className="text-xs text-gray-500 font-mono truncate">
                    {activity.filePath}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showViewAll && activities.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <Link
            href={`/${locale}/f0/projects/${projectId}/ai-logs`}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            View all activity →
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Quick Stats Bar Component
 * Shows success/error counts inline
 */
export function AiActivityStats({ projectId }: { projectId: string }) {
  const [stats, setStats] = useState<{
    total: number;
    successful: number;
    failed: number;
    last24h: number;
  } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/logs`, {
          method: 'POST',
        });
        if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        // Ignore errors
      }
    };

    if (projectId) {
      fetchStats();
    }
  }, [projectId]);

  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="flex items-center gap-1 text-gray-400">
        <span className="font-medium text-white">{stats.last24h}</span> today
      </span>
      <span className="flex items-center gap-1 text-green-400">
        ✓ {stats.successful}
      </span>
      {stats.failed > 0 && (
        <span className="flex items-center gap-1 text-red-400">
          ✗ {stats.failed}
        </span>
      )}
    </div>
  );
}
