"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Type definitions
interface OpsStats {
  rps: number;
  p95ms: number;
  errorRate: number;
  timestamp?: any;
}

interface SloWindow {
  errorRate: number;
  p95ms: number;
  windowStart?: any;
  windowEnd?: any;
}

interface CognitiveReport {
  ts?: any;
  rps: number;
  p95ms: number;
  errorRate: number;
  healthOk: boolean;
  canaryRollout?: number;
  recommendations: string[];
}

interface CanaryConfig {
  rolloutPercent: number;
  rollbackRequested?: boolean;
  lastDecision?: string;
  lastSlo?: {
    errorRate: number;
    p95ms: number;
  };
  updatedAt?: any;
}

interface RuntimeConfig {
  concurrency: number;
  cacheTtl: number;
  throttle: number;
  reason: string;
  updatedAt?: any;
}

// Minimal client-side fetch; replace with your typed SDK
async function fetchDoc(collection: string, doc: string) {
  try {
    const res = await fetch(
      `/api/firestore?collection=${encodeURIComponent(
        collection
      )}&doc=${encodeURIComponent(doc)}`,
      {
        cache: "no-store",
      }
    );
    if (!res.ok) {
      console.error(`Failed to fetch ${collection}/${doc}:`, res.status);
      return null;
    }
    return res.json();
  } catch (error) {
    console.error(`Error fetching ${collection}/${doc}:`, error);
    return null;
  }
}

export default function OpsDashboard() {
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [slo, setSlo] = useState<SloWindow | null>(null);
  const [report, setReport] = useState<CognitiveReport | null>(null);
  const [canary, setCanary] = useState<CanaryConfig | null>(null);
  const [runtime, setRuntime] = useState<RuntimeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadData = async () => {
    setLoading(true);
    try {
      const [st, sl, rp, cn, rt] = await Promise.all([
        fetchDoc("ops_stats", "current"),
        fetchDoc("ops_slo", "window"),
        fetchDoc("ops/reports", "latest"),
        fetchDoc("config", "canary"),
        fetchDoc("config", "runtime"),
      ]);

      setStats(st);
      setSlo(sl);
      setReport(rp);
      setCanary(cn);
      setRuntime(rt);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error loading ops data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Cognitive Ops Dashboard
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Real-time system health and auto-scaling status
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </span>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {loading ? "Refreshing..." : "Refresh Now"}
            </button>
            <Link
              href="/admin/dashboard"
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              Back to Admin
            </Link>
          </div>
        </div>

        {/* Key Metrics */}
        <section className="grid md:grid-cols-4 gap-4">
          <MetricCard
            title="Requests/sec"
            value={stats?.rps?.toFixed(1) ?? "0.0"}
            status={getStatus(stats?.rps ?? 0, [100, 150])}
            suffix="rps"
          />
          <MetricCard
            title="p95 Latency"
            value={stats?.p95ms?.toFixed(0) ?? "0"}
            status={getStatus(stats?.p95ms ?? 0, [600, 900])}
            suffix="ms"
          />
          <MetricCard
            title="Error Rate"
            value={`${((stats?.errorRate ?? 0) * 100).toFixed(2)}%`}
            status={getStatus((stats?.errorRate ?? 0) * 100, [1, 2])}
          />
          <MetricCard
            title="Canary Rollout"
            value={`${canary?.rolloutPercent ?? 0}%`}
            status={
              canary?.lastDecision === "rollback"
                ? "error"
                : canary?.rolloutPercent === 100
                ? "success"
                : "warning"
            }
          />
        </section>

        {/* System Status */}
        <section className="grid md:grid-cols-2 gap-4">
          {/* Runtime Config */}
          <Panel title="Runtime Configuration">
            {runtime ? (
              <div className="space-y-3">
                <ConfigRow
                  label="Concurrency"
                  value={runtime.concurrency}
                  icon="⚡"
                />
                <ConfigRow
                  label="Cache TTL"
                  value={`${runtime.cacheTtl}s`}
                  icon="💾"
                />
                <ConfigRow
                  label="Throttle"
                  value={`${(runtime.throttle * 100).toFixed(0)}%`}
                  icon="🎚️"
                />
                <ConfigRow
                  label="Reason"
                  value={runtime.reason}
                  icon="📊"
                  highlight
                />
              </div>
            ) : (
              <EmptyState />
            )}
          </Panel>

          {/* SLO Window */}
          <Panel title="SLO Window (5min)">
            {slo ? (
              <div className="space-y-3">
                <ConfigRow
                  label="Error Rate"
                  value={`${((slo.errorRate ?? 0) * 100).toFixed(2)}%`}
                  icon="❌"
                  status={getStatus((slo.errorRate ?? 0) * 100, [1, 2])}
                />
                <ConfigRow
                  label="p95 Latency"
                  value={`${slo.p95ms ?? 0}ms`}
                  icon="⏱️"
                  status={getStatus(slo.p95ms ?? 0, [600, 900])}
                />
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    Target: Error rate {"<"} 1%, p95 {"<"} 600ms
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState />
            )}
          </Panel>
        </section>

        {/* Canary Status */}
        <section className="grid md:grid-cols-2 gap-4">
          <Panel title="Canary Deployment">
            {canary ? (
              <div className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Rollout Progress
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {canary.rolloutPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        canary.lastDecision === "rollback"
                          ? "bg-red-500"
                          : canary.rolloutPercent === 100
                          ? "bg-green-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${canary.rolloutPercent}%` }}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="grid grid-cols-2 gap-3">
                  <ConfigRow
                    label="Last Decision"
                    value={canary.lastDecision || "N/A"}
                    icon="🎯"
                  />
                  <ConfigRow
                    label="Rollback Requested"
                    value={canary.rollbackRequested ? "Yes" : "No"}
                    icon={canary.rollbackRequested ? "⚠️" : "✅"}
                    status={canary.rollbackRequested ? "error" : "success"}
                  />
                </div>

                {/* Last SLO Check */}
                {canary.lastSlo && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="text-xs font-medium text-gray-700 mb-2">
                      Last SLO Evaluation
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        Error Rate:{" "}
                        {((canary.lastSlo.errorRate ?? 0) * 100).toFixed(2)}%
                      </div>
                      <div>p95: {canary.lastSlo.p95ms ?? 0}ms</div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState />
            )}
          </Panel>

          {/* Cognitive Report */}
          <Panel title="AI Recommendations">
            {report && report.recommendations ? (
              <div className="space-y-2">
                {report.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="p-3 bg-gray-50 rounded-lg text-sm leading-relaxed"
                  >
                    {rec}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No recommendations available" />
            )}
          </Panel>
        </section>

        {/* Full Report */}
        <section>
          <Panel title="Latest Cognitive Report (Full Data)">
            {report ? (
              <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(report, null, 2)}
              </pre>
            ) : (
              <EmptyState />
            )}
          </Panel>
        </section>
      </div>
    </div>
  );
}

// Helper Components

function MetricCard({
  title,
  value,
  status,
  suffix,
}: {
  title: string;
  value: string;
  status?: "success" | "warning" | "error";
  suffix?: string;
}) {
  const statusColors = {
    success: "bg-green-50 border-green-200",
    warning: "bg-yellow-50 border-yellow-200",
    error: "bg-red-50 border-red-200",
  };

  const statusDots = {
    success: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
  };

  return (
    <div
      className={`rounded-2xl shadow-sm p-5 border ${
        status ? statusColors[status] : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium text-gray-600">{title}</div>
        {status && (
          <div
            className={`w-2 h-2 rounded-full ${statusDots[status]}`}
            title={status}
          />
        )}
      </div>
      <div className="text-3xl font-bold text-gray-900">
        {value}
        {suffix && <span className="text-lg text-gray-500 ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl shadow-sm p-5 bg-white border border-gray-200">
      <div className="text-lg font-semibold text-gray-900 mb-4">{title}</div>
      {children}
    </div>
  );
}

function ConfigRow({
  label,
  value,
  icon,
  highlight,
  status,
}: {
  label: string;
  value: any;
  icon?: string;
  highlight?: boolean;
  status?: "success" | "warning" | "error";
}) {
  const statusColors = {
    success: "text-green-700 bg-green-50",
    warning: "text-yellow-700 bg-yellow-50",
    error: "text-red-700 bg-red-50",
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {label}
      </span>
      <span
        className={`text-sm font-semibold ${
          highlight
            ? "px-2 py-1 bg-blue-50 text-blue-700 rounded"
            : status
            ? `px-2 py-1 rounded ${statusColors[status]}`
            : "text-gray-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="text-center py-8 text-gray-500">
      <div className="text-4xl mb-2">📊</div>
      <p className="text-sm">{message || "No data available"}</p>
    </div>
  );
}

// Helper function to determine status based on thresholds
function getStatus(
  value: number,
  thresholds: [number, number]
): "success" | "warning" | "error" {
  if (value < thresholds[0]) return "success";
  if (value < thresholds[1]) return "warning";
  return "error";
}
