/**
 * Anomaly Detection Tuning Form
 * Allows admins to adjust sensitivity for each metric/window
 */

'use client';

import { useState, useEffect } from 'react';

type TuningConfig = {
  metric: string;
  window: string;
  sensitivity: number;
  fusionWeights: [number, number];
  minSupport: number;
};

const METRICS = ['errors', 'calls', 'latency_p95'];
const WINDOWS = ['1m', '5m', '15m'];

export function TuningForm() {
  const [configs, setConfigs] = useState<TuningConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/anomaly/tuning', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load configs');
      const data = await res.json();
      setConfigs(data.configs ?? []);
    } catch (err) {
      console.error('[TuningForm] Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfigs() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/anomaly/tuning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs })
      });
      if (!res.ok) throw new Error('Failed to save configs');
      alert('✅ Tuning configs saved successfully');
    } catch (err) {
      console.error('[TuningForm] Error:', err);
      alert('❌ Failed to save configs');
    } finally {
      setSaving(false);
    }
  }

  function updateConfig(metric: string, window: string, field: keyof TuningConfig, value: any) {
    setConfigs(prev => {
      const idx = prev.findIndex(c => c.metric === metric && c.window === window);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], [field]: value };
        return updated;
      } else {
        return [...prev, {
          metric,
          window,
          sensitivity: 3,
          fusionWeights: [0.5, 0.5],
          minSupport: 8,
          [field]: value
        } as TuningConfig];
      }
    });
  }

  function getConfig(metric: string, window: string): TuningConfig {
    return configs.find(c => c.metric === metric && c.window === window) || {
      metric,
      window,
      sensitivity: 3,
      fusionWeights: [0.5, 0.5],
      minSupport: 8
    };
  }

  if (loading) {
    return <div className="rounded-2xl border p-8 text-center opacity-60">Loading configurations...</div>;
  }

  return (
    <section className="rounded-2xl border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Anomaly Detection Tuning</h2>
        <button
          onClick={saveConfigs}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      <div className="text-sm opacity-70 mb-4">
        <p>Adjust sensitivity for each metric/window combination. Higher sensitivity = fewer alerts (higher threshold).</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Metric</th>
              <th className="py-2 pr-4">Window</th>
              <th className="py-2 pr-4">Sensitivity (1-5)</th>
              <th className="py-2 pr-4">Z-Score Weight</th>
              <th className="py-2 pr-4">EWMA Weight</th>
              <th className="py-2 pr-4">Min Points</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map(metric => 
              WINDOWS.map(window => {
                const config = getConfig(metric, window);
                return (
                  <tr key={`${metric}-${window}`} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono">{metric}</td>
                    <td className="py-2 pr-4">{window}</td>
                    <td className="py-2 pr-4">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={config.sensitivity}
                        onChange={(e) => updateConfig(metric, window, 'sensitivity', parseInt(e.target.value))}
                        className="w-24"
                      />
                      <span className="ml-2">{config.sensitivity}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={config.fusionWeights[0]}
                        onChange={(e) => {
                          const w1 = parseFloat(e.target.value);
                          const w2 = Math.round((1 - w1) * 10) / 10;
                          updateConfig(metric, window, 'fusionWeights', [w1, w2]);
                        }}
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={config.fusionWeights[1]}
                        onChange={(e) => {
                          const w2 = parseFloat(e.target.value);
                          const w1 = Math.round((1 - w2) * 10) / 10;
                          updateConfig(metric, window, 'fusionWeights', [w1, w2]);
                        }}
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="number"
                        min="4"
                        max="20"
                        value={config.minSupport}
                        onChange={(e) => updateConfig(metric, window, 'minSupport', parseInt(e.target.value))}
                        className="border rounded px-2 py-1 w-16"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs opacity-60 space-y-1">
        <p><strong>Sensitivity:</strong> 1 = Very sensitive (more alerts), 5 = Less sensitive (fewer alerts)</p>
        <p><strong>Fusion Weights:</strong> How much to trust each detector (Z-Score vs EWMA). Must sum to 1.0.</p>
        <p><strong>Min Points:</strong> Minimum data points required before detection starts.</p>
      </div>
    </section>
  );
}

