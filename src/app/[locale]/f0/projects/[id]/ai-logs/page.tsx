'use client';

/**
 * Phase 109.6: AI Logs Page
 * Shows all AI activity for a project with filters
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getOriginIcon, getOriginLabel, type AiLogOrigin, type AiLogMode } from '@/lib/aiLogsClient';

interface AiLogEntry {
  id: string;
  origin: AiLogOrigin;
  mode: AiLogMode;
  success: boolean;
  filePath?: string;
  summary?: string;
  message?: string;
  errorMessage?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface LogStats {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  last24h: number;
}

const ORIGINS: AiLogOrigin[] = ['desktop-ide', 'web-ide', 'auto-executor', 'cloud-agent'];
const MODES: AiLogMode[] = ['chat', 'refactor', 'task', 'plan', 'explain'];

export default function AiLogsPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [logs, setLogs] = useState<AiLogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [originFilter, setOriginFilter] = useState<AiLogOrigin | ''>('');
  const [modeFilter, setModeFilter] = useState<AiLogMode | ''>('');
  const [successFilter, setSuccessFilter] = useState<'' | 'true' | 'false'>('');

  // Pagination
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Fetch logs
  const fetchLogs = async (append = false) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (originFilter) params.set('origin', originFilter);
      if (modeFilter) params.set('mode', modeFilter);
      if (successFilter) params.set('success', successFilter);
      if (append && nextCursor) params.set('startAfter', nextCursor);
      params.set('limit', '30');

      const res = await fetch(`/api/projects/${projectId}/logs?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch logs');
      }

      if (append) {
        setLogs(prev => [...prev, ...data.logs]);
      } else {
        setLogs(data.logs);
      }
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/logs`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      }
    } catch (err) {
      console.warn('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchLogs();
      fetchStats();
    }
  }, [projectId, originFilter, modeFilter, successFilter]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">AI Activity Logs</h1>
        <button
          onClick={() => { fetchLogs(); fetchStats(); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-gray-400 text-sm">Total Runs</div>
          </div>
          <div className="bg-green-900/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{stats.successful}</div>
            <div className="text-gray-400 text-sm">Successful</div>
          </div>
          <div className="bg-red-900/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
            <div className="text-gray-400 text-sm">Failed</div>
          </div>
          <div className="bg-blue-900/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.successRate}%</div>
            <div className="text-gray-400 text-sm">Success Rate</div>
          </div>
          <div className="bg-purple-900/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">{stats.last24h}</div>
            <div className="text-gray-400 text-sm">Last 24h</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value as AiLogOrigin | '')}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">All Origins</option>
          {ORIGINS.map((o) => (
            <option key={o} value={o}>
              {getOriginIcon(o)} {getOriginLabel(o)}
            </option>
          ))}
        </select>

        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value as AiLogMode | '')}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">All Modes</option>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={successFilter}
          onChange={(e) => setSuccessFilter(e.target.value as '' | 'true' | 'false')}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="">All Status</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Origin</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Mode</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Summary</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">File</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-700/50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-lg mr-2">{getOriginIcon(log.origin)}</span>
                  <span className="text-sm text-gray-300">{getOriginLabel(log.origin)}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300">
                    {log.mode}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {log.success ? (
                    <span className="text-green-400">Success</span>
                  ) : (
                    <span className="text-red-400">Failed</span>
                  )}
                </td>
                <td className="px-4 py-3 max-w-xs truncate text-sm text-gray-300">
                  {log.summary || log.message || log.errorMessage || '-'}
                </td>
                <td className="px-4 py-3 max-w-xs truncate text-sm text-gray-400 font-mono">
                  {log.filePath || '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                  {formatDate(log.createdAt)}
                </td>
              </tr>
            ))}

            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Loading / Load More */}
      {loading && (
        <div className="text-center py-8 text-gray-400">
          Loading...
        </div>
      )}

      {hasMore && !loading && (
        <div className="text-center py-4">
          <button
            onClick={() => fetchLogs(true)}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
