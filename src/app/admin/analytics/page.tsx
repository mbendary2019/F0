'use client';

/**
 * Admin Analytics Dashboard
 * Shows platform-wide usage statistics (admin only)
 */

import { useEffect, useState } from 'react';
import { withAuth } from '@/providers/AuthGate';
import { useRouter } from 'next/navigation';

interface DailyStat {
  date: string;
  total: number;
  byKind: Record<string, number>;
  byPlan: { free: number; pro: number; enterprise: number };
}

interface AnalyticsData {
  dailyStats: DailyStat[];
  totals: {
    total: number;
    byKind: Record<string, number>;
    byPlan: { free: number; pro: number; enterprise: number };
  };
  userCounts: {
    free: number;
    pro: number;
    enterprise: number;
    total: number;
  };
  period: {
    days: number;
    from: string;
    to: string;
  };
}

function AdminAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadAnalytics();
  }, [days]);

  async function loadAnalytics() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/usage/overview?days=${days}`);

      if (response.status === 403) {
        setError('Access denied. Admin privileges required.');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load analytics');
      }

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateKey: string): string {
    // Format YYYYMMDD to MMM DD
    const year = dateKey.substring(0, 4);
    const month = dateKey.substring(4, 6);
    const day = dateKey.substring(6, 8);
    const date = new Date(`${year}-${month}-${day}`);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getKindStats(): Array<{ kind: string; total: number; percentage: number }> {
    if (!data?.totals.byKind) return [];

    const total = data.totals.total || 1;
    return Object.entries(data.totals.byKind)
      .map(([kind, count]) => ({
        kind,
        total: count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => b.total - a.total);
  }

  function getPlanDistribution(): Array<{
    plan: string;
    usage: number;
    users: number;
    avgPerUser: number;
  }> {
    if (!data) return [];

    return [
      {
        plan: 'Free',
        usage: data.totals.byPlan.free,
        users: data.userCounts.free,
        avgPerUser: data.userCounts.free > 0 ? data.totals.byPlan.free / data.userCounts.free : 0,
      },
      {
        plan: 'Pro',
        usage: data.totals.byPlan.pro,
        users: data.userCounts.pro,
        avgPerUser: data.userCounts.pro > 0 ? data.totals.byPlan.pro / data.userCounts.pro : 0,
      },
      {
        plan: 'Enterprise',
        usage: data.totals.byPlan.enterprise,
        users: data.userCounts.enterprise,
        avgPerUser:
          data.userCounts.enterprise > 0
            ? data.totals.byPlan.enterprise / data.userCounts.enterprise
            : 0,
      },
    ];
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
            <p className="text-red-300 mb-4">{error}</p>
            {error.includes('Admin') ? (
              <button
                onClick={() => router.push('/account')}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-600"
              >
                Go to Account
              </button>
            ) : (
              <button
                onClick={loadAnalytics}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Analytics</h1>
            <p className="mt-1 text-white/60">Platform-wide usage statistics</p>
          </div>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold uppercase text-emerald-300">
            Admin
          </span>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/60">Show last:</span>
          {[7, 14, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {d} days
            </button>
          ))}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h3 className="mb-2 text-sm font-medium text-white/60">Total Usage</h3>
            <p className="text-3xl font-bold text-white">{data?.totals.total.toLocaleString()}</p>
            <p className="mt-1 text-xs text-white/40">{days} days</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h3 className="mb-2 text-sm font-medium text-white/60">Total Users</h3>
            <p className="text-3xl font-bold text-white">{data?.userCounts.total.toLocaleString()}</p>
            <p className="mt-1 text-xs text-white/40">Active users</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h3 className="mb-2 text-sm font-medium text-white/60">Avg per User</h3>
            <p className="text-3xl font-bold text-white">
              {data && data.userCounts.total > 0
                ? Math.round(data.totals.total / data.userCounts.total).toLocaleString()
                : '0'}
            </p>
            <p className="mt-1 text-xs text-white/40">Per user</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h3 className="mb-2 text-sm font-medium text-white/60">Daily Average</h3>
            <p className="text-3xl font-bold text-white">
              {data && days > 0
                ? Math.round(data.totals.total / days).toLocaleString()
                : '0'}
            </p>
            <p className="mt-1 text-xs text-white/40">Per day</p>
          </div>
        </div>

        {/* Usage by Plan */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold text-white">Usage by Plan</h3>
          <div className="space-y-4">
            {getPlanDistribution().map(({ plan, usage, users, avgPerUser }) => (
              <div key={plan}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-white">{plan}</span>
                    <span className="ml-2 text-white/60">({users.toLocaleString()} users)</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-white">{usage.toLocaleString()}</div>
                    <div className="text-xs text-white/60">
                      {avgPerUser > 0 ? `${Math.round(avgPerUser).toLocaleString()} avg` : ''}
                    </div>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full transition-all ${
                      plan === 'Free'
                        ? 'bg-slate-500'
                        : plan === 'Pro'
                          ? 'bg-purple-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${data ? (usage / data.totals.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Usage by Type */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold text-white">Usage by Type</h3>
          <div className="space-y-3">
            {getKindStats().map(({ kind, total, percentage }) => (
              <div key={kind}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium capitalize text-white">{kind.replace('_', ' ')}</span>
                  <span className="text-white/60">
                    {total.toLocaleString()} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            ))}
            {getKindStats().length === 0 && (
              <p className="py-4 text-center text-white/40">No usage data available</p>
            )}
          </div>
        </div>

        {/* Usage Timeline */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <h3 className="mb-4 text-lg font-semibold text-white">Usage Timeline</h3>

          {data?.dailyStats && data.dailyStats.length > 0 ? (
            <div className="space-y-2">
              {/* Bar chart */}
              <div className="flex items-end gap-1 h-64">
                {data.dailyStats.slice(-30).map((day) => {
                  const maxInPeriod = Math.max(...data.dailyStats.map((d) => d.total), 1);
                  const height = (day.total / maxInPeriod) * 100;

                  return (
                    <div
                      key={day.date}
                      className="group relative flex-1 cursor-pointer"
                      title={`${formatDate(day.date)}: ${day.total.toLocaleString()}`}
                    >
                      <div className="flex h-full flex-col-reverse gap-px">
                        {/* Stacked by plan */}
                        <div
                          className="w-full bg-slate-500 transition-all"
                          style={{
                            height: `${(day.byPlan.free / day.total) * height}%`,
                          }}
                        />
                        <div
                          className="w-full bg-purple-500 transition-all"
                          style={{
                            height: `${(day.byPlan.pro / day.total) * height}%`,
                          }}
                        />
                        <div
                          className="w-full bg-emerald-500 transition-all"
                          style={{
                            height: `${(day.byPlan.enterprise / day.total) * height}%`,
                          }}
                        />
                      </div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block whitespace-nowrap z-10">
                        <div className="font-semibold">{formatDate(day.date)}</div>
                        <div className="mt-1 space-y-1">
                          <div>Total: {day.total.toLocaleString()}</div>
                          {day.byPlan.free > 0 && <div>Free: {day.byPlan.free.toLocaleString()}</div>}
                          {day.byPlan.pro > 0 && <div>Pro: {day.byPlan.pro.toLocaleString()}</div>}
                          {day.byPlan.enterprise > 0 && (
                            <div>Enterprise: {day.byPlan.enterprise.toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-slate-500" />
                  <span className="text-white/60">Free</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-purple-500" />
                  <span className="text-white/60">Pro</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-emerald-500" />
                  <span className="text-white/60">Enterprise</span>
                </div>
              </div>

              {/* Date labels */}
              <div className="flex justify-between text-xs text-white/40">
                <span>{data.dailyStats[0] ? formatDate(data.dailyStats[0].date) : ''}</span>
                <span>
                  {data.dailyStats[data.dailyStats.length - 1]
                    ? formatDate(data.dailyStats[data.dailyStats.length - 1].date)
                    : ''}
                </span>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-white/40">No usage data available</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default withAuth(AdminAnalyticsPage, { requireAuth: true });
