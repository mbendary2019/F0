"use client";

import { useState } from "react";
import OpsMemoryExtras from "./OpsMemoryExtras";

// Matches the API response from /api/memory/stats
interface GraphStats {
  success: boolean;
  workspaceId: string;
  stats: {
    nodeCount: number;
    edgeCount: number;
    edgesByType: {
      semantic: number;
      temporal: number;
      feedback: number;
    };
    avgDegree: number;
    timestamp: string;
  };
  edgeCounts?: {
    semantic: number;
    temporal: number;
    feedback: number;
  };
}

export function MemoryOpsDashboard() {
  const [workspaceId, setWorkspaceId] = useState("demo");
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  const fetchStats = async (ws = workspaceId) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/memory/stats?workspaceId=${encodeURIComponent(ws)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to fetch stats: ${res.status}`);
      }
      const data = (await res.json()) as GraphStats;
      setStats(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch stats");
    } finally {
      setLoading(false);
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/memory/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) {
        throw new Error(`Rebuild failed: ${res.status}`);
      }
      await fetchStats();
    } catch (err: any) {
      setError(err.message || "Rebuild failed");
    } finally {
      setRebuilding(false);
    }
  };

  const handleWorkspaceChange = (newWs: string) => {
    setWorkspaceId(newWs);
    if (newWs.trim()) {
      fetchStats(newWs);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Memory Graph Operations</h1>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Workspace ID</label>
          <input
            type="text"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="border rounded px-3 py-2 w-64"
            placeholder="Enter workspace ID"
          />
        </div>
        <button
          onClick={() => handleWorkspaceChange(workspaceId)}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh Stats"}
        </button>
        <button
          onClick={handleRebuild}
          disabled={rebuilding || !workspaceId}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {rebuilding ? "Rebuilding..." : "Rebuild Graph"}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Stats Display */}
      {stats && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border rounded-lg p-4 shadow">
              <div className="text-sm text-gray-600">Total Nodes</div>
              <div className="text-3xl font-bold">{stats.stats.nodeCount}</div>
            </div>
            <div className="bg-white border rounded-lg p-4 shadow">
              <div className="text-sm text-gray-600">Total Edges</div>
              <div className="text-3xl font-bold">{stats.stats.edgeCount}</div>
            </div>
            <div className="bg-white border rounded-lg p-4 shadow">
              <div className="text-sm text-gray-600">Average Degree</div>
              <div className="text-3xl font-bold">
                {stats.stats.avgDegree.toFixed(1)}
              </div>
            </div>
            <div className="bg-white border rounded-lg p-4 shadow">
              <div className="text-sm text-gray-600">Workspace</div>
              <div className="text-xl font-bold truncate">{stats.workspaceId}</div>
            </div>
          </div>

          {/* Edge Breakdown */}
          <div className="bg-white border rounded-lg p-6 shadow">
            <h2 className="text-xl font-bold mb-4">Edge Type Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <div className="text-sm text-gray-600">Semantic Edges</div>
                <div className="text-2xl font-bold text-blue-700">
                  {stats.stats.edgesByType.semantic}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Embedding similarity ≥ 0.85
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <div className="text-sm text-gray-600">Temporal Edges</div>
                <div className="text-2xl font-bold text-green-700">
                  {stats.stats.edgesByType.temporal}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Co-usage with 21-day decay
                </div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded p-4">
                <div className="text-sm text-gray-600">Feedback Edges</div>
                <div className="text-2xl font-bold text-purple-700">
                  {stats.stats.edgesByType.feedback}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  User signal aggregation
                </div>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-white border rounded-lg p-6 shadow">
            <h2 className="text-xl font-bold mb-4">Graph Metadata</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Last Updated:</span>{" "}
                {new Date(stats.stats.timestamp).toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Workspace ID:</span>{" "}
                <code className="bg-gray-100 px-2 py-1 rounded">
                  {stats.workspaceId}
                </code>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-bold mb-2">💡 Tips</h3>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>
                TTL Policy must be enabled in Firebase Console for automatic edge
                cleanup
              </li>
              <li>
                Weekly rebuild runs automatically every Sunday at 03:00 UTC
              </li>
              <li>
                Graph queries have target P95 latency ≤ 500ms
              </li>
              <li>
                Edge weights decay over time for temporal edges (21-day half-life)
              </li>
            </ul>
          </div>

          {/* Job Log and Edge Explorer */}
          <OpsMemoryExtras workspaceId={workspaceId} />
        </div>
      )}

      {/* Initial State */}
      {!stats && !loading && !error && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">
            Enter a workspace ID and click "Refresh Stats" to view memory graph
            statistics
          </p>
        </div>
      )}
    </div>
  );
}
