"use client";

import { useEffect, useState } from "react";

interface Decision {
  id: string;
  ts: number;
  actor: string;
  component: string;
  confidence: number;
  reasons: string[];
  guardrail: string;
  abBucket?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  effect?: {
    expectedRewardDelta?: number;
    expectedLatencyDeltaMs?: number;
  };
}

export default function DecisionsTable() {
  const [rows, setRows] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);

  useEffect(() => {
    async function loadDecisions() {
      try {
        setLoading(true);
        const res = await fetch("/api/ops/decisions");
        if (!res.ok) throw new Error("Failed to fetch decisions");
        const data = await res.json();
        setRows(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDecisions();
    const interval = setInterval(loadDecisions, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-sm text-gray-500">Loading decisions...</p>
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

  if (rows.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-500 text-sm">No adaptive decisions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Adaptive Decisions Ledger</h2>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Component
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reasons
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guardrail
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  A/B Bucket
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((decision) => (
                <tr
                  key={decision.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedDecision(decision)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {new Date(decision.ts).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {decision.actor}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {decision.component}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span
                      className={`font-semibold ${
                        decision.confidence >= 0.7
                          ? "text-green-600"
                          : decision.confidence >= 0.5
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {(decision.confidence * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    <div className="flex flex-wrap gap-1">
                      {decision.reasons?.map((reason, idx) => (
                        <span
                          key={idx}
                          className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                        >
                          {reason.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        decision.guardrail === "passed"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {decision.guardrail}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {decision.abBucket || "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDecision(decision);
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision Details Modal */}
      {selectedDecision && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedDecision(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Decision Details
                </h3>
                <button
                  onClick={() => setSelectedDecision(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Component</div>
                  <div className="text-lg font-semibold">{selectedDecision.component}</div>
                </div>

                {selectedDecision.before && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-2">Before</div>
                    <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto">
                      {JSON.stringify(selectedDecision.before, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedDecision.after && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-2">After</div>
                    <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto">
                      {JSON.stringify(selectedDecision.after, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedDecision.effect && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 mb-2">
                      Expected Effect
                    </div>
                    <div className="bg-blue-50 p-3 rounded text-sm">
                      {selectedDecision.effect.expectedRewardDelta && (
                        <div>
                          Reward Δ: {(selectedDecision.effect.expectedRewardDelta * 100).toFixed(2)}%
                        </div>
                      )}
                      {selectedDecision.effect.expectedLatencyDeltaMs && (
                        <div>
                          Latency Δ: {selectedDecision.effect.expectedLatencyDeltaMs}ms
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
