/**
 * Anomaly Events Table Component
 * Shows historical anomaly events with filtering
 */

'use client';

import { useEffect, useState } from 'react';

type AnomalyEvent = {
  id: string;
  ts: number;
  metric: string;
  window: string;
  score: number;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  acknowledged: boolean;
};

type Filters = {
  metric: string;
  severity: string;
  from: string;
  to: string;
  acknowledged: string;
};

export function AnomalyTable() {
  const [events, setEvents] = useState<AnomalyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    metric: '',
    severity: '',
    from: '',
    to: '',
    acknowledged: ''
  });

  async function loadEvents() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const res = await fetch(`/api/admin/anomaly/events?${params.toString()}`, {
        cache: 'no-store'
      });

      if (!res.ok) throw new Error('Failed to load events');
      
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch (err) {
      console.error('[AnomalyTable] Error:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const exportCSV = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    window.location.href = `/api/admin/anomaly/export?${params.toString()}`;
  };

  return (
    <section className="rounded-2xl border p-4 space-y-4">
      <h2 className="text-lg font-medium">Anomaly Events History</h2>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <select
          className="border rounded-lg p-2 text-sm"
          value={filters.metric}
          onChange={(e) => handleFilterChange('metric', e.target.value)}
        >
          <option value="">All Metrics</option>
          <option value="errors">Errors</option>
          <option value="calls">Calls</option>
          <option value="latency_p95">Latency P95</option>
        </select>

        <select
          className="border rounded-lg p-2 text-sm"
          value={filters.severity}
          onChange={(e) => handleFilterChange('severity', e.target.value)}
        >
          <option value="">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <input
          type="date"
          className="border rounded-lg p-2 text-sm"
          value={filters.from}
          onChange={(e) => handleFilterChange('from', e.target.value)}
          placeholder="From"
        />

        <input
          type="date"
          className="border rounded-lg p-2 text-sm"
          value={filters.to}
          onChange={(e) => handleFilterChange('to', e.target.value)}
          placeholder="To"
        />

        <select
          className="border rounded-lg p-2 text-sm"
          value={filters.acknowledged}
          onChange={(e) => handleFilterChange('acknowledged', e.target.value)}
        >
          <option value="">All Status</option>
          <option value="true">Acknowledged</option>
          <option value="false">Unacknowledged</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={loadEvents}
          disabled={loading}
          className="border rounded-lg px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Apply Filters'}
        </button>
        <button
          onClick={exportCSV}
          className="border rounded-lg px-4 py-2 text-sm hover:bg-gray-50"
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Time</th>
              <th className="py-2 pr-4">Metric</th>
              <th className="py-2 pr-4">Window</th>
              <th className="py-2 pr-4">Score</th>
              <th className="py-2 pr-4">Severity</th>
              <th className="py-2 pr-4">Reason</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-2 pr-4">
                  {new Date(event.ts).toLocaleString()}
                </td>
                <td className="py-2 pr-4 font-mono">{event.metric}</td>
                <td className="py-2 pr-4">{event.window}</td>
                <td className="py-2 pr-4 font-semibold">{event.score.toFixed(2)}</td>
                <td className="py-2 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    event.severity === 'high' ? 'bg-red-100 text-red-800' :
                    event.severity === 'medium' ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {event.severity}
                  </span>
                </td>
                <td className="py-2 pr-4 text-xs opacity-70 truncate max-w-[200px]">
                  {event.reason}
                </td>
                <td className="py-2 pr-4">
                  {event.acknowledged ? (
                    <span className="text-xs opacity-60">✓ Acked</span>
                  ) : (
                    <span className="text-xs opacity-40">Pending</span>
                  )}
                </td>
              </tr>
            ))}
            {events.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="py-8 text-center opacity-60">
                  No anomaly events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="text-center py-4 opacity-60">
          Loading events...
        </div>
      )}
    </section>
  );
}

