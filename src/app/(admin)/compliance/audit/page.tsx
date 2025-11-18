"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebaseClient";

interface AuditSummary {
  summary: {
    totalAuditLogs: number;
    totalDsarRequests: number;
    totalAlerts: number;
    totalDeletions: number;
    complianceEvents: number;
    securityEvents: number;
    autoApprovedDsars: number;
  };
  breakdowns: {
    auditByAction: Record<string, number>;
    auditByStatus: Record<string, number>;
    dsarByType: Record<string, number>;
    dsarByStatus: Record<string, number>;
    alertsBySeverity: Record<string, number>;
    deletionsByStatus: Record<string, number>;
  };
  timeSeries: {
    daily: Array<{ date: string; count: number }>;
  };
  period: {
    days: number;
    since: string;
  };
}

export default function AuditDashboard() {
  const [data, setData] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = async () => {
    setLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/audit/summary?days=${days}`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch audit summary");
      }

      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Error fetching audit summary:", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  const exportCSV = () => {
    if (!data) return;

    const csv = [
      ["Metric", "Value"],
      ["Total Audit Logs", data.summary.totalAuditLogs],
      ["Total DSAR Requests", data.summary.totalDsarRequests],
      ["Total Alerts", data.summary.totalAlerts],
      ["Compliance Events", data.summary.complianceEvents],
      ["Security Events", data.summary.securityEvents],
      ["Auto-Approved DSARs", data.summary.autoApprovedDsars],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-summary-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const exportJSON = () => {
    if (!data) return;

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-summary-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="mb-4 text-2xl font-semibold">Audit Dashboard</h1>
        <div className="text-sm text-gray-500">Loading audit data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="mb-4 text-2xl font-semibold">Audit Dashboard</h1>
        <div className="text-sm text-red-600">Failed to load audit data. Please try again.</div>
      </div>
    );
  }

  const autoApprovalRate =
    data.summary.totalDsarRequests > 0
      ? Math.round((data.summary.autoApprovedDsars / data.summary.totalDsarRequests) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit Dashboard</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Last {data.period.days} days (since {new Date(data.period.since).toLocaleDateString()})
          </p>
        </div>

        <div className="flex gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>

          <button
            onClick={exportCSV}
            className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            Export CSV
          </button>
          <button
            onClick={exportJSON}
            className="rounded-md border border-gray-300 px-4 py-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total Audit Logs" value={data.summary.totalAuditLogs} />
        <KPICard title="DSAR Requests" value={data.summary.totalDsarRequests} />
        <KPICard title="Compliance Events" value={data.summary.complianceEvents} />
        <KPICard title="Security Events" value={data.summary.securityEvents} />
        <KPICard title="Total Alerts" value={data.summary.totalAlerts} color="yellow" />
        <KPICard title="Pending Deletions" value={data.summary.totalDeletions} color="red" />
        <KPICard title="Auto-Approved DSARs" value={data.summary.autoApprovedDsars} color="green" />
        <KPICard title="Auto-Approval Rate" value={`${autoApprovalRate}%`} color="blue" />
      </div>

      {/* Breakdowns */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownCard title="Audit Logs by Status" data={data.breakdowns.auditByStatus} />
        <BreakdownCard title="DSAR Requests by Type" data={data.breakdowns.dsarByType} />
        <BreakdownCard title="DSAR Requests by Status" data={data.breakdowns.dsarByStatus} />
        <BreakdownCard title="Alerts by Severity" data={data.breakdowns.alertsBySeverity} />
      </div>

      {/* Top Actions */}
      <div className="mb-6">
        <BreakdownCard
          title="Top Audit Actions"
          data={Object.fromEntries(
            Object.entries(data.breakdowns.auditByAction)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
          )}
        />
      </div>

      {/* Time Series (Simple Table View) */}
      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-4 font-medium">Activity Timeline</h3>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-right">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.timeSeries.daily.map((day) => (
                <tr key={day.date}>
                  <td className="px-4 py-2">{new Date(day.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right font-mono">{day.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  color = "gray",
}: {
  title: string;
  value: number | string;
  color?: "gray" | "blue" | "green" | "yellow" | "red";
}) {
  const colorClasses = {
    gray: "border-gray-200 dark:border-gray-700",
    blue: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950",
    green: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950",
    yellow: "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950",
    red: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="text-sm text-gray-600 dark:text-gray-400">{title}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <h3 className="mb-4 font-medium">{title}</h3>
      {entries.length === 0 ? (
        <div className="text-sm text-gray-500">No data available</div>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, count]) => {
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{key}</span>
                  <span className="font-mono text-gray-600 dark:text-gray-400">
                    {count} ({percentage}%)
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
