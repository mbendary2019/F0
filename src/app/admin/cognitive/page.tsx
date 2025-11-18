/**
 * Cognitive Ops Copilot Dashboard
 * Monitor and manage autonomous decisions
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Decision = {
  id: string;
  timestamp: number;
  action: string;
  target?: string;
  risk: 'low' | 'medium' | 'high';
  approval_status: string;
  expected_gain: number;
  confidence: number;
  reward?: number;
  explanation: string;
  executed: boolean;
};

type Stats = {
  total: number;
  by_action: Record<string, number>;
  by_risk: Record<string, number>;
  by_status: Record<string, number>;
  avg_reward: number;
  positive_outcomes: number;
};

type PolicyInfo = {
  stats: {
    version: number;
    trained_samples: number;
    last_updated: number;
  };
  performance: {
    avg_reward: number;
    positive_rate: number;
    avg_error_improvement: number;
    avg_latency_improvement: number;
  };
};

export default function CognitiveDashboard() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [policyInfo, setPolicyInfo] = useState<PolicyInfo | null>(null);
  const [filter, setFilter] = useState({ risk: '', status: '', action: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [filter]);

  async function loadData() {
    setLoading(true);
    try {
      // Load decisions
      const params = new URLSearchParams();
      if (filter.risk) params.set('risk', filter.risk);
      if (filter.status) params.set('status', filter.status);
      if (filter.action) params.set('action', filter.action);

      const decisionsRes = await fetch(`/api/admin/rl/decisions?${params}`, { cache: 'no-store' });
      const decisionsData = await decisionsRes.json();
      setDecisions(decisionsData.decisions || []);
      setStats(decisionsData.stats || null);

      // Load policy info
      const policyRes = await fetch('/api/admin/rl/policy', { cache: 'no-store' });
      const policyData = await policyRes.json();
      setPolicyInfo(policyData);
    } catch (err) {
      console.error('[Cognitive Dashboard] Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproval(decisionId: string, approved: boolean, reason?: string) {
    if (!confirm(`${approved ? 'Approve' : 'Reject'} this decision?`)) return;

    try {
      await fetch('/api/admin/rl/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision_id: decisionId, approved, reason })
      });
      await loadData();
    } catch (err) {
      console.error('[Cognitive Dashboard] Approval error:', err);
    }
  }

  async function resetPolicy() {
    if (!confirm('Reset RL policy? This will erase all learned weights!')) return;

    try {
      await fetch('/api/admin/rl/policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true })
      });
      await loadData();
    } catch (err) {
      console.error('[Cognitive Dashboard] Reset error:', err);
    }
  }

  const getRiskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };
    return colors[risk] || 'bg-gray-100';
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      auto_approved: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100';
  };

  return (
    <main className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">🧠 Cognitive Ops Copilot</h1>
          <p className="text-sm opacity-70 mt-1">
            Autonomous decision making with reinforcement learning
          </p>
        </div>
        <nav className="flex gap-2">
          <Link href="/admin/dashboard" className="text-sm underline">
            Dashboard
          </Link>
          <Link href="/admin/ops-assistant" className="text-sm underline">
            Assistant
          </Link>
        </nav>
      </header>

      {/* Policy Stats */}
      {policyInfo && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border p-4">
            <div className="text-sm opacity-70">Policy Version</div>
            <div className="text-3xl font-semibold mt-1">{policyInfo.stats.version}</div>
            <div className="text-xs opacity-60 mt-1">
              {policyInfo.stats.trained_samples} samples
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm opacity-70">Avg Reward</div>
            <div className="text-3xl font-semibold mt-1">
              {policyInfo.performance.avg_reward.toFixed(2)}
            </div>
            <div className="text-xs opacity-60 mt-1">
              {(policyInfo.performance.positive_rate * 100).toFixed(0)}% positive
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm opacity-70">Error Reduction</div>
            <div className="text-3xl font-semibold mt-1">
              {policyInfo.performance.avg_error_improvement.toFixed(1)}%
            </div>
            <div className="text-xs opacity-60 mt-1">Average improvement</div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm opacity-70">Latency Reduction</div>
            <div className="text-3xl font-semibold mt-1">
              {policyInfo.performance.avg_latency_improvement.toFixed(1)}%
            </div>
            <div className="text-xs opacity-60 mt-1">Average improvement</div>
          </div>
        </div>
      )}

      {/* Filters & Actions */}
      <div className="rounded-2xl border p-4">
        <div className="flex gap-3 items-center flex-wrap">
          <select
            className="border rounded-lg px-3 py-2"
            value={filter.risk}
            onChange={(e) => setFilter({ ...filter, risk: e.target.value })}
          >
            <option value="">All Risks</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <select
            className="border rounded-lg px-3 py-2"
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="auto_approved">Auto Approved</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            className="border rounded-lg px-3 py-2"
            value={filter.action}
            onChange={(e) => setFilter({ ...filter, action: e.target.value })}
          >
            <option value="">All Actions</option>
            <option value="do_nothing">Do Nothing</option>
            <option value="restart_fn">Restart Function</option>
            <option value="reduce_rate">Reduce Rate</option>
            <option value="disable_endpoint">Disable Endpoint</option>
            <option value="reroute">Reroute</option>
            <option value="scale_up">Scale Up</option>
          </select>

          <button
            onClick={loadData}
            className="border rounded-lg px-4 py-2"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>

          <button
            onClick={resetPolicy}
            className="border rounded-lg px-4 py-2 text-red-600 hover:bg-red-50 ml-auto"
          >
            Reset Policy
          </button>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="mt-4 text-sm opacity-70">
            <span className="font-medium">{stats.total}</span> decisions •{' '}
            <span className="font-medium">{stats.positive_outcomes}</span> positive outcomes •{' '}
            Avg reward: <span className="font-medium">{stats.avg_reward.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Decisions Table */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">Time</th>
                <th className="text-left p-3">Action</th>
                <th className="text-left p-3">Target</th>
                <th className="text-left p-3">Risk</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Confidence</th>
                <th className="text-left p-3">Reward</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3">
                    {new Date(d.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{d.action}</div>
                    <div className="text-xs opacity-60 mt-1">{d.explanation}</div>
                  </td>
                  <td className="p-3">{d.target || '—'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskBadge(d.risk)}`}>
                      {d.risk}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(d.approval_status)}`}>
                      {d.approval_status}
                    </span>
                  </td>
                  <td className="p-3">{(d.confidence * 100).toFixed(0)}%</td>
                  <td className="p-3">
                    {d.reward != null ? (
                      <span className={d.reward >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {d.reward >= 0 ? '+' : ''}{d.reward.toFixed(2)}
                      </span>
                    ) : (
                      <span className="opacity-40">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {d.approval_status === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleApproval(d.id, true)}
                          className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 hover:bg-green-200"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleApproval(d.id, false)}
                          className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 hover:bg-red-200"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {decisions.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center opacity-60">
                    {loading ? 'Loading...' : 'No decisions yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}


