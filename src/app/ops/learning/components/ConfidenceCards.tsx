"use client";

import { useEffect, useState } from "react";

type Confidence = {
  component: string;
  window: string;
  score: number;
  reasons: string[];
  sampleSize: number;
  metrics: {
    rewardAvg: number;
    latencyP95: number;
    costAvg: number;
    successRate: number;
  };
  ts: number;
};

export default function ConfidenceCards() {
  const [items, setItems] = useState<Confidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfidence() {
      try {
        setLoading(true);
        const res = await fetch("/api/ops/confidence");
        if (!res.ok) throw new Error("Failed to fetch confidence data");
        const data = await res.json();
        setItems(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadConfidence();
    const interval = setInterval(loadConfidence, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-sm text-gray-500">Loading confidence scores...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600 text-sm">Error: {error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-500 text-sm">No confidence data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Confidence Scores</h2>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((c, i) => {
          const scoreColor =
            c.score >= 0.7
              ? "text-green-600"
              : c.score >= 0.5
              ? "text-yellow-600"
              : "text-red-600";

          return (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-gray-500 font-medium uppercase">
                  {c.window}
                </div>
                <div className={`text-2xl font-bold ${scoreColor}`}>
                  {(c.score * 100).toFixed(0)}%
                </div>
              </div>

              <div className="text-lg font-semibold text-gray-900 mb-2">
                {c.component}
              </div>

              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1">Confidence Factors:</div>
                <div className="flex flex-wrap gap-1">
                  {c.reasons.map((reason, idx) => (
                    <span
                      key={idx}
                      className={`inline-block px-2 py-1 text-xs rounded-full ${
                        reason === "ok"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {reason.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-3 border-t border-gray-100">
                <div>
                  <div className="text-gray-400">Reward</div>
                  <div className="font-semibold">
                    {(c.metrics.rewardAvg * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Success</div>
                  <div className="font-semibold">
                    {(c.metrics.successRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">p95 Latency</div>
                  <div className="font-semibold">
                    {Math.round(c.metrics.latencyP95)}ms
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Cost</div>
                  <div className="font-semibold">
                    ${c.metrics.costAvg.toFixed(4)}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-400">Samples</div>
                  <div className="font-semibold">{c.sampleSize}</div>
                </div>
              </div>

              <div className="mt-2 text-xs text-gray-400">
                Updated {new Date(c.ts).toLocaleTimeString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
