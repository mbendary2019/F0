/**
 * Policy Review & Auto-Tuning Dashboard
 * Monitor and manage self-evolving policy system
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type PolicyData = {
  policy: any;
  guardrails: any;
  log: string;
  entryCount: number;
  versions: any[];
  recentEvents: any[];
};

export default function PoliciesPage() {
  const [data, setData] = useState<PolicyData | null>(null);
  const [alpha, setAlpha] = useState<number>(0.5);
  const [lr, setLr] = useState<number>(0.05);
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/policies/history', { cache: 'no-store' });
      const json = await res.json();
      setData(json);
      
      if (json?.policy?.tuning) {
        setAlpha(json.policy.tuning.alpha ?? 0.5);
        setLr(json.policy.tuning.lr ?? 0.05);
      }
    } catch (err) {
      console.error('[Policies] Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveTuning() {
    setSaving(true);
    try {
      await fetch('/api/admin/policies/tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alpha, lr, reason })
      });
      await loadData();
      setReason('');
    } catch (err) {
      console.error('[Policies] Save error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function rollback(versionId: string) {
    if (!confirm('Rollback to this policy version?')) return;

    try {
      await fetch('/api/admin/policies/tune', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId })
      });
      await loadData();
    } catch (err) {
      console.error('[Policies] Rollback error:', err);
    }
  }

  const tuning = data?.policy?.tuning;
  const isAutoTuned = tuning?.updatedBy === 'system';

  return (
    <main className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">🧬 Self-Evolving Policy</h1>
          <p className="text-sm opacity-70 mt-1">
            Auto-tuning, adaptation & meta-learning
          </p>
        </div>
        <nav className="flex gap-2">
          <Link href="/admin/cognitive" className="text-sm underline">
            Cognitive
          </Link>
          <Link href="/admin/dashboard" className="text-sm underline">
            Dashboard
          </Link>
        </nav>
      </header>

      {loading && !data ? (
        <div className="text-center py-12 opacity-60">Loading...</div>
      ) : (
        <>
          {/* Current Tuning */}
          <div className="rounded-2xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Current Tuning</h2>
              {isAutoTuned && (
                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                  🤖 Auto-tuned
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm opacity-70">
                  Alpha (Exploration)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1.5"
                  value={alpha}
                  onChange={(e) => setAlpha(Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                />
                <div className="text-xs opacity-60 mt-1">
                  Current: {tuning?.alpha?.toFixed(2) || 'N/A'}
                </div>
              </div>

              <div>
                <label className="text-sm opacity-70">
                  Learning Rate
                </label>
                <input
                  type="number"
                  step="0.005"
                  min="0.005"
                  max="0.2"
                  value={lr}
                  onChange={(e) => setLr(Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                />
                <div className="text-xs opacity-60 mt-1">
                  Current: {tuning?.lr?.toFixed(3) || 'N/A'}
                </div>
              </div>

              <div>
                <label className="text-sm opacity-70">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Manual override reason..."
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                />
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <button
                onClick={saveTuning}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Apply Manual Tuning'}
              </button>

              <button
                onClick={loadData}
                className="px-3 py-2 rounded-lg border hover:bg-gray-50"
              >
                Refresh
              </button>

              {tuning?.updatedAt && (
                <div className="text-xs opacity-60 ml-auto">
                  Last updated:{' '}
                  {new Date(tuning.updatedAt).toLocaleString()}
                  {tuning.updatedBy && ` by ${tuning.updatedBy}`}
                </div>
              )}
            </div>

            {tuning?.reason && (
              <div className="text-sm opacity-70 px-3 py-2 rounded bg-gray-50">
                <strong>Reason:</strong> {tuning.reason}
              </div>
            )}
          </div>

          {/* Guardrails */}
          <div className="rounded-2xl border p-6 space-y-4">
            <h2 className="text-lg font-medium">Dynamic Guardrails</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium mb-2">
                  Protected Targets ({data?.guardrails?.targets?.length || 0})
                </div>
                <div className="flex flex-wrap gap-2">
                  {(data?.guardrails?.targets || []).map((target: string) => (
                    <span
                      key={target}
                      className="px-2 py-1 rounded text-xs bg-red-100 text-red-800"
                    >
                      🛡️ {target}
                    </span>
                  ))}
                  {(!data?.guardrails?.targets || data.guardrails.targets.length === 0) && (
                    <span className="text-sm opacity-60">No protected targets</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Adaptation Status</div>
                <div className="text-sm space-y-1">
                  {data?.guardrails?.lastAdapt && (
                    <div>
                      <span className="opacity-70">Last adapted:</span>{' '}
                      {new Date(data.guardrails.lastAdapt).toLocaleString()}
                    </div>
                  )}
                  {data?.guardrails?.reason && (
                    <div>
                      <span className="opacity-70">Reason:</span>{' '}
                      {data.guardrails.reason}
                    </div>
                  )}
                  {data?.guardrails?.highRiskRate !== undefined && (
                    <div>
                      <span className="opacity-70">High risk rate:</span>{' '}
                      {(data.guardrails.highRiskRate * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Policy Versions */}
          <div className="rounded-2xl border p-6 space-y-4">
            <h2 className="text-lg font-medium">Policy Versions</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="py-2 pr-4">Version</th>
                    <th className="py-2 pr-4">Since</th>
                    <th className="py-2 pr-4">Alpha</th>
                    <th className="py-2 pr-4">LR</th>
                    <th className="py-2 pr-4">Avg Reward</th>
                    <th className="py-2 pr-4">Decisions</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.versions || []).map((v: any) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{v.version}</td>
                      <td className="py-2 pr-4">
                        {new Date(v.since).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4">{v.tuning?.alpha?.toFixed(2)}</td>
                      <td className="py-2 pr-4">{v.tuning?.lr?.toFixed(3)}</td>
                      <td className="py-2 pr-4">{v.avgReward?.toFixed(2) || '0.00'}</td>
                      <td className="py-2 pr-4">{v.decisions || 0}</td>
                      <td className="py-2 pr-4">
                        {v.isChampion && (
                          <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                            👑 Champion
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <button
                          onClick={() => rollback(v.id)}
                          className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                        >
                          Rollback
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!data?.versions || data.versions.length === 0) && (
                    <tr>
                      <td colSpan={8} className="py-4 text-center opacity-60">
                        No policy versions yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Events */}
          <div className="rounded-2xl border p-6 space-y-4">
            <h2 className="text-lg font-medium">Recent Auto-Tuning Events</h2>
            
            <div className="space-y-2">
              {(data?.recentEvents || []).map((event: any) => (
                <div
                  key={event.id}
                  className="p-3 rounded-lg border bg-gray-50 text-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{event.action}</span>
                    <span className="text-xs opacity-60">
                      {new Date(event.ts).toLocaleString()}
                    </span>
                  </div>
                  {event.meta && (
                    <div className="text-xs opacity-70">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(event.meta, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
              {(!data?.recentEvents || data.recentEvents.length === 0) && (
                <div className="text-sm opacity-60 text-center py-4">
                  No recent events
                </div>
              )}
            </div>
          </div>

          {/* Auto-Doc Log */}
          <div className="rounded-2xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Auto-Documentation Log</h2>
              <div className="text-xs opacity-60">
                {data?.entryCount || 0} entries
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              {data?.log ? (
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {data.log}
                </pre>
              ) : (
                <div className="text-sm opacity-60 text-center py-4">
                  No documentation entries yet
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}


