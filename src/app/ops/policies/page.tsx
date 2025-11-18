"use client";

import { useEffect, useState } from "react";
import DecisionsTable from "./components/DecisionsTable";

interface PolicyDoc {
  id: string;
  version: string;
  status: "draft" | "active" | "archived";
  createdAt: number;
  createdBy: string;
  notes?: string;
  params: Record<string, any>;
}

interface AuditLog {
  ts: number;
  actor: string;
  action: string;
  id: string;
  from?: string;
  to?: string;
  note?: string;
}

async function fetchPolicies(): Promise<PolicyDoc[]> {
  const res = await fetch("/api/ops/policies");
  if (!res.ok) throw new Error("Failed to fetch policies");
  return res.json();
}

async function fetchAuditLogs(): Promise<AuditLog[]> {
  const res = await fetch("/api/ops/audit?limit=20");
  if (!res.ok) throw new Error("Failed to fetch audit logs");
  return res.json();
}

async function activatePolicy(id: string, version: string): Promise<void> {
  const res = await fetch("/api/ops/policies/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, version }),
  });
  if (!res.ok) throw new Error("Failed to activate policy");
}

export default function PoliciesDashboard() {
  const [policies, setPolicies] = useState<PolicyDoc[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const [policiesData, auditData] = await Promise.all([
        fetchPolicies(),
        fetchAuditLogs(),
      ]);
      setPolicies(policiesData);
      setAuditLogs(auditData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function handleActivate(policy: PolicyDoc) {
    if (!confirm(`Activate policy ${policy.id}@${policy.version}?`)) {
      return;
    }

    try {
      setActivating(`${policy.id}@${policy.version}`);
      await activatePolicy(policy.id, policy.version);
      await loadData(); // Reload data
    } catch (err: any) {
      alert(`Failed to activate: ${err.message}`);
    } finally {
      setActivating(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Policy Management</h1>
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading policies...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Policy Management</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold mb-2">Error Loading Data</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Group policies by ID
  const policiesByID = policies.reduce((acc, policy) => {
    if (!acc[policy.id]) {
      acc[policy.id] = [];
    }
    acc[policy.id].push(policy);
    return acc;
  }, {} as Record<string, PolicyDoc[]>);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Policy Management</h1>
          <div className="text-sm text-gray-500">
            Auto-refresh every 30s
          </div>
        </div>

        {/* Policies Grid */}
        <div className="grid gap-6 mb-8">
          {Object.entries(policiesByID).map(([policyId, versions]) => {
            const activePolicy = versions.find((p) => p.status === "active");
            const draftPolicies = versions.filter((p) => p.status === "draft");
            const archivedPolicies = versions.filter((p) => p.status === "archived");

            return (
              <div key={policyId} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold">{policyId}</h2>
                  <div className="text-sm text-gray-500">
                    {versions.length} version{versions.length !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Active Policy */}
                {activePolicy && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="inline-block px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded">
                          ACTIVE
                        </span>
                        <span className="ml-2 font-mono text-sm">{activePolicy.version}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(activePolicy.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {activePolicy.notes && (
                      <div className="text-sm text-gray-600 mb-2">{activePolicy.notes}</div>
                    )}
                    <details className="text-sm">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                        View Parameters
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-100 rounded overflow-x-auto">
                        {JSON.stringify(activePolicy.params, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}

                {/* Draft Policies */}
                {draftPolicies.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Draft Versions ({draftPolicies.length})
                    </h3>
                    {draftPolicies.map((policy) => (
                      <div
                        key={`${policy.id}@${policy.version}`}
                        className="p-4 mb-2 bg-yellow-50 border border-yellow-200 rounded-lg"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="inline-block px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-200 rounded">
                              DRAFT
                            </span>
                            <span className="ml-2 font-mono text-sm">{policy.version}</span>
                          </div>
                          <button
                            onClick={() => handleActivate(policy)}
                            disabled={activating === `${policy.id}@${policy.version}`}
                            className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400"
                          >
                            {activating === `${policy.id}@${policy.version}`
                              ? "Activating..."
                              : "Activate"}
                          </button>
                        </div>
                        {policy.notes && (
                          <div className="text-sm text-gray-600 mb-2">{policy.notes}</div>
                        )}
                        <details className="text-sm">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            View Parameters
                          </summary>
                          <pre className="mt-2 p-3 bg-gray-100 rounded overflow-x-auto">
                            {JSON.stringify(policy.params, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                )}

                {/* Archived Policies */}
                {archivedPolicies.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                      Archived Versions ({archivedPolicies.length})
                    </summary>
                    <div className="mt-2 space-y-2">
                      {archivedPolicies.slice(0, 5).map((policy) => (
                        <div
                          key={`${policy.id}@${policy.version}`}
                          className="p-3 bg-gray-50 border border-gray-200 rounded"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-xs">{policy.version}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(policy.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>

        {/* Audit Log */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Recent Policy Changes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Policy</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {auditLogs.map((log, idx) => {
                  const actionColor =
                    log.action === "activate" ? "text-green-600" :
                    log.action === "propose" ? "text-blue-600" :
                    log.action === "rollback" ? "text-red-600" :
                    "text-gray-600";

                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(log.ts).toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 text-sm font-medium ${actionColor}`}>
                        {log.action}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">{log.id}</td>
                      <td className="px-6 py-4 text-sm font-mono">
                        {log.from && log.to ? `${log.from} → ${log.to}` : log.to || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{log.actor}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{log.note || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Phase 37: Decisions Ledger */}
        <div className="mt-8">
          <DecisionsTable />
        </div>
      </div>
    </div>
  );
}
