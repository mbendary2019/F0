"use client";

import { useEffect, useState } from "react";

interface Node {
  id: string;
  kind: string;
  label: string;
  props: any;
  ts: number;
}

interface Edge {
  id: string;
  kind: string;
  src: string;
  dst: string;
  weight?: number;
  props?: any;
  ts: number;
}

export default function OpsGraphPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    async function loadGraph() {
      try {
        setLoading(true);
        const [nodesRes, edgesRes] = await Promise.all([
          fetch("/api/ops/graph/nodes"),
          fetch("/api/ops/graph/edges"),
        ]);

        if (!nodesRes.ok || !edgesRes.ok) {
          throw new Error("Failed to load graph data");
        }

        const [nodesData, edgesData] = await Promise.all([
          nodesRes.json(),
          edgesRes.json(),
        ]);

        setNodes(nodesData);
        setEdges(edgesData);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadGraph();
    const interval = setInterval(loadGraph, 120000); // Refresh every 2 minutes
    return () => clearInterval(interval);
  }, []);

  const visibleNodes = filter ? nodes.filter((n) => n.kind === filter) : nodes;
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter(
    (e) => visibleIds.has(e.src) && visibleIds.has(e.dst)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Ops Knowledge Graph</h1>
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading graph...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Ops Knowledge Graph</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold mb-2">Error Loading Graph</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const kindCounts = nodes.reduce((acc, n) => {
    acc[n.kind] = (acc[n.kind] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Ops Knowledge Graph</h1>
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{nodes.length}</div>
            <div className="text-sm text-gray-600">Total Nodes</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{edges.length}</div>
            <div className="text-sm text-gray-600">Total Edges</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">
              {Object.keys(kindCounts).length}
            </div>
            <div className="text-sm text-gray-600">Node Types</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600">
              {visibleEdges.length}
            </div>
            <div className="text-sm text-gray-600">Visible Edges</div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex gap-4 items-center flex-wrap">
            <label className="text-sm font-medium text-gray-700">Filter by type:</label>
            <select
              className="bg-transparent border border-gray-300 px-3 py-2 rounded-lg text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All ({nodes.length})</option>
              <option value="component">Components ({kindCounts.component || 0})</option>
              <option value="policy">Policies ({kindCounts.policy || 0})</option>
              <option value="policy_version">
                Policy Versions ({kindCounts.policy_version || 0})
              </option>
              <option value="decision">Decisions ({kindCounts.decision || 0})</option>
              <option value="metric_window">
                Metric Windows ({kindCounts.metric_window || 0})
              </option>
              <option value="confidence">Confidence ({kindCounts.confidence || 0})</option>
              <option value="model">Models ({kindCounts.model || 0})</option>
            </select>
            <div className="text-sm text-gray-500">
              Showing {visibleNodes.length} nodes, {visibleEdges.length} edges
            </div>
          </div>
        </div>

        {/* Graph View */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Edges Table */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Relationships</h2>
              <p className="text-sm text-gray-500 mt-1">
                (MVP) Tabular view. For production, integrate D3/Cytoscape force layout.
              </p>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Source</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Relation</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Target</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleEdges.map((e, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs">{e.src}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {e.kind}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs">{e.dst}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {e.weight !== undefined ? e.weight.toFixed(2) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nodes List */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Nodes</h2>
              <p className="text-sm text-gray-500 mt-1">
                Click to view details
              </p>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              {visibleNodes.map((n, i) => (
                <div
                  key={i}
                  className={`border-b border-gray-100 p-3 cursor-pointer hover:bg-gray-50 ${
                    selectedNode?.id === n.id ? "bg-blue-50" : ""
                  }`}
                  onClick={() => setSelectedNode(n)}
                >
                  <div className="font-medium text-sm text-gray-900">{n.label}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    <span className="inline-block px-2 py-0.5 bg-gray-100 rounded mr-2">
                      {n.kind}
                    </span>
                    <span className="text-gray-400">{n.id}</span>
                  </div>
                  {selectedNode?.id === n.id && Object.keys(n.props).length > 0 && (
                    <pre className="mt-2 bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(n.props, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
