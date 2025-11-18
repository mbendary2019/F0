'use client';

/**
 * Admin DSAR Management Dashboard
 * Review and approve/deny user data requests
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthGate';
import LegalReportButton from '../_components/LegalReportButton';

interface DsarRequest {
  id: string;
  uid: string;
  type: 'export' | 'deletion';
  status: string;
  requestedAt: string;
  processedAt?: string;
  approvedBy?: string;
  deniedBy?: string;
  denialReason?: string;
  exportUrl?: string;
  exportExpiresAt?: string;
  metadata?: Record<string, any>;
}

export default function AdminDsarPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<DsarRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{ type?: string; status?: string }>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [denialReason, setDenialReason] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const params = new URLSearchParams();
      if (filter.type) params.set('type', filter.type);
      if (filter.status) params.set('status', filter.status);

      const res = await fetch(`/api/admin/compliance/dsar?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching DSAR requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function approveRequest(reqId: string) {
    if (!confirm('Are you sure you want to approve this deletion request?')) {
      return;
    }

    setActionLoading(reqId);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/compliance/dsar/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId: reqId }),
      });

      if (res.ok) {
        alert('Deletion request approved');
        await fetchRequests();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  async function denyRequest(reqId: string) {
    if (!denialReason.trim()) {
      alert('Please provide a reason for denial');
      return;
    }

    setActionLoading(reqId);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/compliance/dsar/deny', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId: reqId, reason: denialReason }),
      });

      if (res.ok) {
        alert('Request denied');
        setDenialReason('');
        setSelectedRequest(null);
        await fetchRequests();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">DSAR Management</h1>

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 flex gap-4">
          <select
            value={filter.type || ''}
            onChange={(e) => setFilter({ ...filter, type: e.target.value || undefined })}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
          >
            <option value="">All Types</option>
            <option value="export">Export</option>
            <option value="deletion">Deletion</option>
          </select>

          <select
            value={filter.status || ''}
            onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="ready">Ready</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="completed">Completed</option>
          </select>

          <button
            onClick={fetchRequests}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Requests Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No requests found</div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="bg-gray-800 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Request ID</span>
                    <span className="text-sm font-mono">{req.id}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">User ID</span>
                    <span className="text-sm font-mono">{req.uid}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Type</span>
                    <span
                      className={`text-sm px-2 py-1 rounded ${
                        req.type === 'deletion' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {req.type}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Status</span>
                    <span
                      className={`text-sm px-2 py-1 rounded ${
                        req.status === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : req.status === 'approved' || req.status === 'ready'
                          ? 'bg-green-500/20 text-green-400'
                          : req.status === 'denied'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-gray-300 mb-4">
                  <p>Requested: {new Date(req.requestedAt).toLocaleString()}</p>
                  {req.processedAt && <p>Processed: {new Date(req.processedAt).toLocaleString()}</p>}
                  {req.approvedBy && <p>Approved by: {req.approvedBy}</p>}
                  {req.deniedBy && (
                    <p>
                      Denied by: {req.deniedBy} - Reason: {req.denialReason}
                    </p>
                  )}
                  {req.metadata?.reason && <p>User reason: {req.metadata.reason}</p>}
                </div>

                {/* Actions for pending deletion requests */}
                {req.type === 'deletion' && req.status === 'pending' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => approveRequest(req.id)}
                      disabled={actionLoading === req.id}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded text-sm transition-colors"
                    >
                      {actionLoading === req.id ? 'Processing...' : 'Approve Deletion'}
                    </button>

                    {selectedRequest === req.id ? (
                      <div className="flex gap-2 flex-1">
                        <input
                          type="text"
                          value={denialReason}
                          onChange={(e) => setDenialReason(e.target.value)}
                          placeholder="Reason for denial..."
                          className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                        />
                        <button
                          onClick={() => denyRequest(req.id)}
                          disabled={actionLoading === req.id}
                          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded text-sm transition-colors"
                        >
                          Confirm Deny
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRequest(null);
                            setDenialReason('');
                          }}
                          className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedRequest(req.id)}
                        className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm transition-colors"
                      >
                        Deny
                      </button>
                    )}
                  </div>
                )}

                {/* Export download link */}
                {req.type === 'export' && req.exportUrl && (
                  <div className="flex gap-3">
                    <a
                      href={req.exportUrl}
                      className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors"
                      download
                    >
                      Download Export
                    </a>
                  </div>
                )}

                {/* Legal Report Button - for all completed requests */}
                {(req.status === 'approved' || req.status === 'denied' || req.status === 'completed') && (
                  <div className="mt-4">
                    <LegalReportButton dsarId={req.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
