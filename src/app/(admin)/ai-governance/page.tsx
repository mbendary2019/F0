"use client";

/**
 * AI Governance Dashboard
 * Displays AI evaluation metrics, quality trends, and flagged outputs
 */

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebaseClient";
import { getFunctions, httpsCallable } from "firebase/functions";
import ConfigPanel from "./_components/ConfigPanel";

interface Summary {
  total: number;
  avgQuality: number;
  avgBias: number;
  avgToxicity: number;
  avgLatency: number;
  totalCost: number;
  flagged: number;
  flagRate: number;
  piiLeaks: number;
  topModels: Array<{ model: string; count: number }>;
}

interface RecentEval {
  date: string;
  quality: number;
  bias: number;
  toxicity: number;
  flagged: boolean;
  model: string;
  piiLeak: boolean;
}

export default function AIGovernancePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<RecentEval[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken();

      const [summaryRes, recentRes] = await Promise.all([
        fetch("/api/admin/ai-evals/summary", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/ai-evals/recent?limit=50", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }

      if (recentRes.ok) {
        const data = await recentRes.json();
        setRecent(data);
      }
    } catch (error) {
      console.error("Error fetching AI governance data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function generateReport() {
    if (!confirm("Generate AI Governance PDF report?")) {
      return;
    }

    setGeneratingReport(true);

    try {
      const functions = getFunctions();
      const callable = httpsCallable(functions, "createAIGovernanceReport");

      const result: any = await callable({ limit: 500 });

      if (result.data?.signedUrl) {
        window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
      } else {
        alert("Error: No download URL returned");
      }
    } catch (error: any) {
      console.error("Error generating report:", error);
      alert(`Error: ${error.message || "Failed to generate report"}`);
    } finally {
      setGeneratingReport(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold mb-4">AI Governance Dashboard</h1>
        <div className="text-sm text-gray-500">Loading AI evaluation data...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold mb-4">AI Governance Dashboard</h1>
        <div className="text-sm text-red-600">Failed to load AI governance data</div>
      </div>
    );
  }

  // Calculate daily aggregates for chart
  const dailyData: Record<string, { quality: number; count: number; flagged: number }> = {};

  recent.forEach((r) => {
    if (!dailyData[r.date]) {
      dailyData[r.date] = { quality: 0, count: 0, flagged: 0 };
    }
    dailyData[r.date].quality += r.quality;
    dailyData[r.date].count += 1;
    if (r.flagged) dailyData[r.date].flagged += 1;
  });

  const chartData = Object.entries(dailyData)
    .map(([date, data]) => ({
      date,
      quality: data.quality / data.count,
      flagged: data.flagged,
    }))
    .slice(-30); // Last 30 days

  const riskLevel = summary.flagRate > 10 ? "HIGH" : summary.flagRate > 5 ? "MEDIUM" : "LOW";
  const riskColor =
    riskLevel === "HIGH" ? "text-red-600" : riskLevel === "MEDIUM" ? "text-yellow-600" : "text-green-600";

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      {/* Config Panel */}
      <ConfigPanel />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Governance Dashboard</h1>

        <button
          onClick={generateReport}
          disabled={generatingReport}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generatingReport ? "Generating..." : "📄 Generate PDF Report"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          title="Total Evaluations"
          value={summary.total.toLocaleString()}
          color="gray"
        />
        <KPI
          title="Avg Quality Score"
          value={`${summary.avgQuality.toFixed(1)}/100`}
          color={summary.avgQuality >= 80 ? "green" : summary.avgQuality >= 60 ? "yellow" : "red"}
        />
        <KPI
          title="Avg Bias Score"
          value={`${summary.avgBias.toFixed(1)}/100`}
          color={summary.avgBias < 20 ? "green" : summary.avgBias < 40 ? "yellow" : "red"}
        />
        <KPI
          title="Flagged Outputs"
          value={`${summary.flagRate.toFixed(1)}%`}
          color={summary.flagRate < 5 ? "green" : summary.flagRate < 10 ? "yellow" : "red"}
        />
        <KPI
          title="Avg Toxicity"
          value={`${summary.avgToxicity.toFixed(1)}/100`}
          color={summary.avgToxicity < 15 ? "green" : summary.avgToxicity < 30 ? "yellow" : "red"}
        />
        <KPI title="PII Leaks" value={summary.piiLeaks.toString()} color={summary.piiLeaks === 0 ? "green" : "red"} />
        <KPI title="Avg Latency" value={`${summary.avgLatency.toFixed(0)}ms`} color="gray" />
        <KPI title="Total Cost" value={`$${summary.totalCost.toFixed(2)}`} color="gray" />
      </div>

      {/* Risk Assessment */}
      <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="text-lg font-medium mb-4">Risk Assessment</h2>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">Overall Risk Level:</span>
          <span className={`text-2xl font-bold ${riskColor}`}>{riskLevel}</span>
        </div>

        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {summary.flagRate > 10 && <div>⚠️ High flag rate detected. Immediate review recommended.</div>}
          {summary.flagRate > 5 && summary.flagRate <= 10 && <div>⚠️ Moderate flag rate. Continue monitoring.</div>}
          {summary.flagRate <= 5 && (
            <div className="text-green-600 dark:text-green-400">
              ✅ Low flag rate. System performing within acceptable parameters.
            </div>
          )}
          {summary.piiLeaks > 0 && (
            <div className="text-red-600 dark:text-red-400">⚠️ {summary.piiLeaks} PII leak(s) detected! Review immediately.</div>
          )}
        </div>
      </section>

      {/* Quality Over Time Chart (Simple Table View) */}
      <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="text-lg font-medium mb-4">Quality Over Time</h2>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-right">Avg Quality</th>
                <th className="px-4 py-2 text-right">Flagged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {chartData.map((day) => (
                <tr key={day.date}>
                  <td className="px-4 py-2">{day.date}</td>
                  <td className="px-4 py-2 text-right font-mono">{day.quality.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {day.flagged > 0 ? (
                      <span className="text-red-600 dark:text-red-400">{day.flagged}</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top Models */}
      <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="text-lg font-medium mb-4">Top Models by Usage</h2>
        <div className="space-y-3">
          {summary.topModels.map((m, i) => {
            const percentage = ((m.count / summary.total) * 100).toFixed(1);
            return (
              <div key={m.model}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">
                    {i + 1}. {m.model}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {m.count} ({percentage}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Flagged Outputs */}
      <section className="rounded-xl border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="text-lg font-medium mb-4">Recent Flagged Outputs</h2>
        <div className="space-y-2">
          {recent.filter((r) => r.flagged).slice(0, 10).length === 0 ? (
            <div className="text-sm text-gray-500">No flagged outputs in recent evaluations</div>
          ) : (
            recent
              .filter((r) => r.flagged)
              .slice(0, 10)
              .map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20"
                >
                  <div className="text-sm">
                    <div className="font-medium text-red-900 dark:text-red-300">{r.model}</div>
                    <div className="text-xs text-red-700 dark:text-red-400">{r.date}</div>
                  </div>
                  <div className="text-right text-xs text-red-700 dark:text-red-400">
                    {r.piiLeak && <div>⚠️ PII Leak</div>}
                    <div>Toxicity: {r.toxicity.toFixed(0)}</div>
                    <div>Bias: {r.bias.toFixed(0)}</div>
                  </div>
                </div>
              ))
          )}
        </div>
      </section>
    </div>
  );
}

function KPI({
  title,
  value,
  color = "gray",
}: {
  title: string;
  value: string;
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
