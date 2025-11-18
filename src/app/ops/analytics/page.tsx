/**
 * Phase 48 - Analytics Dashboard
 * KPI cards + time series charts for usage analytics
 */

'use client';

import { useEffect, useState } from 'react';
import { getAnalytics, type AnalyticsResponse } from '@/lib/analytics';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AnalyticsResponse>({
    kpis: { dau: 0, tokens: 0, requests: 0, seatsUsed: 0, orgsActive: 0 },
    series: [],
    period: { start: null, end: null, days: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?next=/ops/analytics');
      return;
    }

    // Load analytics data
    getAnalytics({ days: 30 })
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load analytics:', err);
        setError(err.message || 'Failed to load analytics');
        setLoading(false);
      });
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-red-500">Error: {error}</div>
          <button
            onClick={() => router.push('/ops')}
            className="px-4 py-2 rounded-2xl bg-black text-white"
          >
            Back to Ops
          </button>
        </div>
      </div>
    );
  }

  const kpiCards = [
    { key: 'dau', label: 'Peak DAU', value: data.kpis.dau, color: 'blue' },
    { key: 'requests', label: 'Total Requests', value: data.kpis.requests.toLocaleString(), color: 'green' },
    { key: 'tokens', label: 'Total Tokens', value: data.kpis.tokens.toLocaleString(), color: 'purple' },
    { key: 'seatsUsed', label: 'Seats Used', value: data.kpis.seatsUsed, color: 'orange' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Analytics Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              {data.period.days} days • {data.period.start} to {data.period.end}
            </p>
          </div>
          <button
            onClick={() => router.push('/ops/audit')}
            className="px-4 py-2 rounded-2xl bg-white shadow text-sm font-medium hover:shadow-md transition-all"
          >
            View Audit Trail →
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpiCards.map((kpi) => (
            <div key={kpi.key} className="p-5 rounded-2xl bg-white shadow">
              <div className="text-xs text-gray-500 mb-2">{kpi.label}</div>
              <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Requests Chart */}
        <div className="p-5 rounded-2xl bg-white shadow">
          <div className="font-medium text-gray-900 mb-4">API Requests</div>
          <div style={{ width: '100%', height: 300 }}>
            {data.series.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    name="Requests"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Tokens Chart */}
        <div className="p-5 rounded-2xl bg-white shadow">
          <div className="font-medium text-gray-900 mb-4">Token Consumption</div>
          <div style={{ width: '100%', height: 300 }}>
            {data.series.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="tokens"
                    name="Tokens"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Combined Chart */}
        <div className="p-5 rounded-2xl bg-white shadow">
          <div className="font-medium text-gray-900 mb-4">Combined Metrics</div>
          <div style={{ width: '100%', height: 360 }}>
            {data.series.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    name="Requests"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="dau"
                    name="DAU"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/ops')}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow transition-all"
          >
            ← Back to Ops
          </button>
        </div>
      </div>
    </div>
  );
}
