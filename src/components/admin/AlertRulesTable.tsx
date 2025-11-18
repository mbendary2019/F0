/**
 * Alert Rules Table Component
 * Display and manage alert rules
 */

'use client';

import { useEffect, useState } from 'react';
import type { AlertRule } from '@/lib/admin/alerts';
import { getMetricLabel, getWindowLabel, getActionLabel } from '@/lib/admin/alerts';

export function AlertRulesTable() {
  const [items, setItems] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/alerts/rules', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch rules');
      
      const data = await res.json();
      setItems(data.rules ?? []);
    } catch (error) {
      console.error('Error loading rules:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/admin/alerts/rules?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!res.ok) throw new Error('Failed to update rule');
      
      // Update local state
      setItems(items.map(item =>
        item.id === id ? { ...item, enabled } : item
      ));
    } catch (error) {
      console.error('Error toggling rule:', error);
      alert('Failed to update rule');
    }
  }

  async function deleteRule(id: string) {
    if (!confirm('Are you sure you want to delete this alert rule?')) {
      return;
    }

    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/alerts/rules?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete rule');
      
      // Remove from local state
      setItems(items.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Failed to delete rule');
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
        <div className="text-center py-8 text-gray-500">Loading alert rules...</div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Alert Rules</h2>
        <button
          onClick={load}
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Refresh
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No alert rules yet. Create one above to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200 bg-gray-50">
                <th className="py-3 px-4 font-medium text-gray-700">Name</th>
                <th className="py-3 px-4 font-medium text-gray-700">Metric</th>
                <th className="py-3 px-4 font-medium text-gray-700">Threshold</th>
                <th className="py-3 px-4 font-medium text-gray-700">Window</th>
                <th className="py-3 px-4 font-medium text-gray-700">Action</th>
                <th className="py-3 px-4 font-medium text-gray-700">Status</th>
                <th className="py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-gray-900">{rule.name}</td>
                  <td className="py-3 px-4 text-gray-600">{getMetricLabel(rule.metric)}</td>
                  <td className="py-3 px-4 text-gray-600">{rule.threshold}</td>
                  <td className="py-3 px-4 text-gray-600">{getWindowLabel(rule.window)}</td>
                  <td className="py-3 px-4 text-gray-600">{getActionLabel(rule.action)}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => rule.id && toggleEnabled(rule.id, !rule.enabled)}
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        rule.enabled
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => rule.id && deleteRule(rule.id)}
                      disabled={deleting === rule.id}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {deleting === rule.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
          Showing {items.length} alert {items.length === 1 ? 'rule' : 'rules'}
        </div>
      )}
    </section>
  );
}

