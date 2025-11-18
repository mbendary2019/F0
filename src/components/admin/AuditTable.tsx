/**
 * Audit Table Component
 * Displays and filters admin audit logs
 */

'use client';

import { useEffect, useState } from 'react';

type AuditItem = {
  id: string;
  ts: number;
  action: string;
  actorUid: string;
  targetUid?: string;
  ip?: string;
  ua?: string;
  meta?: Record<string, unknown>;
};

type FilterState = {
  action: string;
  actor: string;
  from: string;
  to: string;
};

export function AuditTable() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState<FilterState>({ 
    action: '', 
    actor: '', 
    from: '', 
    to: '' 
  });

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        audit: '1',
        ...(q.action && { action: q.action }),
        ...(q.actor && { actor: q.actor }),
        ...(q.from && { from: q.from }),
        ...(q.to && { to: q.to }),
      });
      
      const res = await fetch(`/api/admin/metrics/summary?${params.toString()}`, { 
        cache: 'no-store' 
      });
      
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      
      const data = await res.json();
      setItems(data.audit ?? []);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    load(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportUrl = `/api/admin/audit/export?${new URLSearchParams({
    ...(q.action && { action: q.action }),
    ...(q.actor && { actor: q.actor }),
    ...(q.from && { from: q.from }),
    ...(q.to && { to: q.to }),
  }).toString()}`;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <input 
          className="border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
          placeholder="Action (e.g., grant, revoke)" 
          value={q.action} 
          onChange={e => setQ({ ...q, action: e.target.value })} 
        />
        <input 
          className="border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
          placeholder="Actor UID" 
          value={q.actor} 
          onChange={e => setQ({ ...q, actor: e.target.value })} 
        />
        <input 
          type="date" 
          className="border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
          value={q.from} 
          onChange={e => setQ({ ...q, from: e.target.value })}
          placeholder="From Date"
        />
        <input 
          type="date" 
          className="border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
          value={q.to} 
          onChange={e => setQ({ ...q, to: e.target.value })}
          placeholder="To Date"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button 
          className="border border-gray-300 bg-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
          onClick={load} 
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Apply Filters'}
        </button>
        <a 
          className="border border-gray-300 bg-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors inline-flex items-center gap-2" 
          href={exportUrl}
          download
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </a>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200 bg-gray-50">
              <th className="py-3 px-4 font-medium text-gray-700">Time</th>
              <th className="py-3 px-4 font-medium text-gray-700">Action</th>
              <th className="py-3 px-4 font-medium text-gray-700">Actor</th>
              <th className="py-3 px-4 font-medium text-gray-700">Target</th>
              <th className="py-3 px-4 font-medium text-gray-700">IP</th>
              <th className="py-3 px-4 font-medium text-gray-700">User Agent</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 text-gray-600">
                  {new Date(it.ts).toLocaleString('en-US', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  })}
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    it.action === 'grant' ? 'bg-green-100 text-green-800' :
                    it.action === 'revoke' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {it.action}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-gray-600">{it.actorUid}</td>
                <td className="py-3 px-4 font-mono text-xs text-gray-600">{it.targetUid ?? '—'}</td>
                <td className="py-3 px-4 text-gray-600">{it.ip ?? '—'}</td>
                <td className="py-3 px-4 text-gray-600 truncate max-w-[240px]" title={it.ua}>
                  {it.ua ?? '—'}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No audit entries found. Try adjusting your filters.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  Loading audit logs...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Results Count */}
      {!loading && items.length > 0 && (
        <div className="text-sm text-gray-600 pt-2 border-t border-gray-200">
          Showing {items.length} audit {items.length === 1 ? 'entry' : 'entries'}
        </div>
      )}
    </section>
  );
}

