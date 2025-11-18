/**
 * Alert Rule Form Component
 * Create new alert rules
 */

'use client';

import { useState } from 'react';
import type { AlertRule } from '@/lib/admin/alerts';

export function AlertRuleForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<AlertRule, 'id' | 'createdBy' | 'createdAt'>>({
    name: '',
    metric: 'errors_per_min',
    threshold: 50,
    window: '1m',
    action: 'slack',
    enabled: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create alert rule');
      }

      // Reset form
      setForm({
        name: '',
        metric: 'errors_per_min',
        threshold: 50,
        window: '1m',
        action: 'slack',
        enabled: true,
      });

      // Reload page to show new rule
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Create Alert Rule</h2>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rule Name
          </label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="High error rate"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
            minLength={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Metric
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.metric}
            onChange={e => setForm({ ...form, metric: e.target.value as any })}
          >
            <option value="errors_per_min">Errors per Minute</option>
            <option value="calls_per_min">Calls per Minute</option>
            <option value="latency_p95">P95 Latency (ms)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Threshold
          </label>
          <input
            type="number"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="50"
            value={form.threshold}
            onChange={e => setForm({ ...form, threshold: Number(e.target.value) })}
            required
            min={0}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Window
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.window}
            onChange={e => setForm({ ...form, window: e.target.value as any })}
          >
            <option value="1m">1 Minute</option>
            <option value="5m">5 Minutes</option>
            <option value="15m">15 Minutes</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Action
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.action}
            onChange={e => setForm({ ...form, action: e.target.value as any })}
          >
            <option value="slack">Slack Notification</option>
            <option value="browser">Browser Alert</option>
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={e => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Enabled</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={loading || !form.name || form.name.length < 3}
        >
          {loading ? 'Creating...' : 'Create Alert Rule'}
        </button>
      </div>
    </form>
  );
}

