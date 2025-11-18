"use client";

import { useEffect, useState } from "react";
import ConfidenceCards from "./components/ConfidenceCards";

interface RollingStats {
  component: string;
  window: "1h" | "24h" | "7d";
  ts: number;
  n: number;
  successRate: number;
  p50Latency: number;
  p95Latency: number;
  avgCostUsd: number;
  avgReward: number;
}

interface Observation {
  id: string;
  ts: number;
  component: string;
  outcome: string;
  durationMs?: number;
  costUsd?: number;
  policyVersion?: string;
}

async function fetchStats(): Promise<RollingStats[]> {
  const res = await fetch("/api/ops/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

async function fetchRecentObservations(): Promise<Observation[]> {
  const res = await fetch("/api/ops/observations?limit=20");
  if (!res.ok) throw new Error("Failed to fetch observations");
  return res.json();
}

export default function LearningDashboard() {
  const [stats, setStats] = useState<RollingStats[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [statsData, obsData] = await Promise.all([
          fetchStats(),
          fetchRecentObservations(),
        ]);
        setStats(statsData);
        setObservations(obsData);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Learning System Dashboard</h1>
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading learning stats...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Learning System Dashboard</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold mb-2">Error Loading Data</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Group stats by component
  const statsByComponent = stats.reduce((acc, stat) => {
    if (!acc[stat.component]) {
      acc[stat.component] = {};
    }
    acc[stat.component][stat.window] = stat;
    return acc;
  }, {} as Record<string, Record<string, RollingStats>>);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Learning System Dashboard</h1>
          <div className="text-sm text-gray-500">
            Auto-refresh every 30s
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 mb-8">
          {Object.entries(statsByComponent).map(([component, windows]) => {
            const stat24h = windows["24h"];
            if (!stat24h) return null;

            const rewardColor =
              stat24h.avgReward >= 0.75 ? "text-green-600" :
              stat24h.avgReward >= 0.55 ? "text-yellow-600" :
              "text-red-600";

            const successColor =
              stat24h.successRate >= 0.95 ? "text-green-600" :
              stat24h.successRate >= 0.90 ? "text-yellow-600" :
              "text-red-600";

            return (
              <div key={component} className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">{component}</h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-500">Success Rate</div>
                    <div className={`text-2xl font-bold ${successColor}`}>
                      {(stat24h.successRate * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Avg Reward</div>
                    <div className={`text-2xl font-bold ${rewardColor}`}>
                      {stat24h.avgReward.toFixed(3)}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">p95 Latency</div>
                    <div className="text-2xl font-bold">
                      {stat24h.p95Latency.toFixed(0)}ms
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Avg Cost</div>
                    <div className="text-2xl font-bold">
                      ${stat24h.avgCostUsd.toFixed(4)}
                    </div>
                  </div>
                </div>

                {/* Window comparison */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  {(["1h", "24h", "7d"] as const).map((window) => {
                    const s = windows[window];
                    if (!s) return null;

                    return (
                      <div key={window} className="text-sm">
                        <div className="font-medium text-gray-700 mb-1">{window}</div>
                        <div className="text-gray-600">
                          n={s.n} | reward={s.avgReward.toFixed(2)}
                        </div>
                        <div className="text-gray-600">
                          p50={s.p50Latency.toFixed(0)}ms | p95={s.p95Latency.toFixed(0)}ms
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Observations */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Recent Observations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {observations.map((obs) => {
                  const outcomeColor =
                    obs.outcome === "success" ? "text-green-600" :
                    obs.outcome === "degraded" ? "text-yellow-600" :
                    "text-red-600";

                  return (
                    <tr key={obs.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(obs.ts).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">{obs.component}</td>
                      <td className={`px-6 py-4 text-sm font-medium ${outcomeColor}`}>
                        {obs.outcome}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {obs.durationMs ? `${obs.durationMs.toFixed(0)}ms` : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {obs.costUsd ? `$${obs.costUsd.toFixed(4)}` : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {obs.policyVersion || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="text-sm text-blue-600 font-medium mb-2">Total Components</div>
            <div className="text-3xl font-bold text-blue-900">
              {Object.keys(statsByComponent).length}
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-6">
            <div className="text-sm text-green-600 font-medium mb-2">Total Observations (24h)</div>
            <div className="text-3xl font-bold text-green-900">
              {stats.filter(s => s.window === "24h").reduce((sum, s) => sum + s.n, 0)}
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-6">
            <div className="text-sm text-purple-600 font-medium mb-2">Avg System Reward</div>
            <div className="text-3xl font-bold text-purple-900">
              {stats.filter(s => s.window === "24h").length > 0
                ? (stats.filter(s => s.window === "24h").reduce((sum, s) => sum + s.avgReward, 0) /
                   stats.filter(s => s.window === "24h").length).toFixed(3)
                : "N/A"}
            </div>
          </div>
        </div>

        {/* Phase 37: Confidence Cards */}
        <div className="mt-8">
          <ConfidenceCards />
        </div>
      </div>
    </div>
  );
}
