// F0 Phase 36 - Real-Time Audit Dashboard

'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Shield, CheckCircle, AlertTriangle, Filter, Download } from 'lucide-react';

interface AuditEvent {
  id: string;
  day: string;
  ts: string;
  action: string;
  actor: {
    uid: string;
    email?: string;
    ip?: string;
    deviceId?: string;
  };
  target?: {
    type: string;
    id: string;
    name?: string;
  };
  ctx: {
    ok: boolean;
    code?: string;
    latencyMs?: number;
    errorMessage?: string;
  };
  payloadHash: string;
  prevHash: string;
  chainHash: string;
}

export default function AuditsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ action: '', uid: '' });
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filter.action) params.set('action', filter.action);
      if (filter.uid) params.set('uid', filter.uid);

      const response = await fetch(`/api/audits?${params}`);
      const data = await response.json();

      if (data.ok) {
        setEvents(data.events || []);
      } else {
        setError(data.error || 'Failed to load audits');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();

    if (autoRefresh) {
      const interval = setInterval(loadEvents, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, filter]);

  const exportToCsv = () => {
    const headers = ['Timestamp', 'Action', 'Actor', 'Email', 'IP', 'Target', 'Status', 'Chain Hash'];
    const rows = events.map(e => [
      e.ts,
      e.action,
      e.actor.uid,
      e.actor.email || '',
      e.actor.ip || '',
      e.target ? `${e.target.type}:${e.target.id}` : '',
      e.ctx.ok ? 'Success' : 'Failed',
      e.chainHash.slice(0, 16),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-cyan-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Audit Dashboard</h1>
              <p className="text-sm text-slate-400">Tamper-evident security logs</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                autoRefresh
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto-refresh
            </button>

            <button
              onClick={exportToCsv}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 border border-slate-700"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>

            <button
              onClick={loadEvents}
              disabled={loading}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 text-white rounded-lg flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by action (e.g., deploy.run)"
              value={filter.action}
              onChange={(e) => setFilter({ ...filter, action: e.target.value })}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <input
              type="text"
              placeholder="Filter by UID"
              value={filter.uid}
              onChange={(e) => setFilter({ ...filter, uid: e.target.value })}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Events</p>
                <p className="text-3xl font-bold text-white mt-1">{events.length}</p>
              </div>
              <Shield className="w-12 h-12 text-cyan-400 opacity-20" />
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Success Rate</p>
                <p className="text-3xl font-bold text-green-400 mt-1">
                  {events.length > 0
                    ? Math.round((events.filter(e => e.ctx.ok).length / events.length) * 100)
                    : 0}%
                </p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-400 opacity-20" />
            </div>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Failed Events</p>
                <p className="text-3xl font-bold text-red-400 mt-1">
                  {events.filter(e => !e.ctx.ok).length}
                </p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-400 opacity-20" />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* Events List */}
        <div className="space-y-3">
          {loading && events.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              Loading audit events...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No audit events found
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-cyan-500/30 rounded-2xl p-4 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 rounded-lg text-xs font-mono ${
                        event.ctx.ok
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {event.ctx.ok ? '✓ SUCCESS' : '✗ FAILED'}
                      </div>
                      <span className="text-sm text-slate-400">{event.day}</span>
                      <span className="text-sm text-slate-500">•</span>
                      <span className="text-sm text-slate-400">
                        {new Date(event.ts).toLocaleString()}
                      </span>
                    </div>

                    {/* Action */}
                    <div className="font-mono text-sm text-cyan-400">
                      {event.action}
                      {event.target && (
                        <span className="text-slate-500">
                          {' → '}
                          <span className="text-slate-400">
                            {event.target.type}:{event.target.id}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Actor */}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>
                        <span className="text-slate-600">actor:</span> {event.actor.uid.slice(0, 12)}...
                      </span>
                      {event.actor.email && (
                        <span>
                          <span className="text-slate-600">email:</span> {event.actor.email}
                        </span>
                      )}
                      {event.actor.ip && (
                        <span>
                          <span className="text-slate-600">ip:</span> {event.actor.ip}
                        </span>
                      )}
                      {event.ctx.latencyMs && (
                        <span>
                          <span className="text-slate-600">latency:</span> {event.ctx.latencyMs}ms
                        </span>
                      )}
                    </div>

                    {/* Error Message */}
                    {event.ctx.errorMessage && (
                      <div className="text-xs text-red-400 font-mono bg-red-500/5 border border-red-500/20 rounded p-2">
                        {event.ctx.errorMessage}
                      </div>
                    )}

                    {/* Chain Hashes */}
                    <div className="flex items-center gap-4 text-xs font-mono text-slate-600">
                      <span title="Chain Hash">
                        🔗 {event.chainHash.slice(0, 16)}...
                      </span>
                      <span title="Previous Hash">
                        ← {event.prevHash.slice(0, 12) || 'genesis'}...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


