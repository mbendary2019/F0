/**
 * Phase 48 - Audit Trail Page
 * View and export security-sensitive action logs
 */

'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { exportAuditCsv } from '@/lib/analytics';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AuditEntry {
  id: string;
  ts: Date;
  actorUid: string;
  actorEmail?: string;
  orgId?: string;
  action: string;
  object?: string;
  ip?: string;
}

export default function AuditTrailPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?next=/ops/audit');
      return;
    }

    // Listen to audit trail
    const q = query(
      collection(db, 'ops_audit'),
      orderBy('ts', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const entries: AuditEntry[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ts: data.ts instanceof Timestamp ? data.ts.toDate() : new Date(data.ts),
            actorUid: data.actorUid || '',
            actorEmail: data.actorEmail || '',
            orgId: data.orgId || '',
            action: data.action || '',
            object: data.object || '',
            ip: data.ip || '',
          };
        });
        setRows(entries);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to load audit trail:', error);
        toast.error('Failed to load audit trail');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading, router]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { csv, count } = await exportAuditCsv({
        orgId: selectedOrgId || undefined,
      });

      // Create download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${count} audit entries`);
    } catch (error: any) {
      console.error('Failed to export:', error);
      toast.error(error.message || 'Failed to export audit trail');
    } finally {
      setExporting(false);
    }
  };

  // Filter rows
  const filteredRows = rows.filter((row) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        row.action.toLowerCase().includes(query) ||
        row.actorEmail?.toLowerCase().includes(query) ||
        row.actorUid.toLowerCase().includes(query) ||
        row.orgId?.toLowerCase().includes(query)
      );
    }
    if (selectedOrgId) {
      return row.orgId === selectedOrgId;
    }
    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading audit trail...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Audit Trail</h1>
            <p className="text-sm text-gray-500 mt-1">
              Security-sensitive actions and changes
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by action, email, or org ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <button
            onClick={() => router.push('/ops/analytics')}
            className="px-4 py-2 rounded-2xl bg-white shadow text-sm font-medium hover:shadow-md transition-all"
          >
            Analytics →
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium text-gray-900">{filteredRows.length}</span> entries
          </div>
          <div>•</div>
          <div>Last 200 events</div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-white shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Org ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Object
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No audit entries found
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {row.ts.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900 truncate max-w-xs">
                          {row.actorEmail || row.actorUid}
                        </div>
                        {row.actorEmail && (
                          <div className="text-xs text-gray-400 truncate max-w-xs">
                            {row.actorUid}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-block px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                          {row.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">
                        {row.orgId || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">
                        {row.object || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/ops')}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow transition-all"
          >
            ← Back to Ops
          </button>
        </div>
      </div>
    </div>
  );
}
