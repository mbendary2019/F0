"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebaseClient";

interface AIGovConfig {
  enabled: boolean;
  sampleRate: number;
  thresholds: {
    toxicity: number;
    bias: number;
  };
  alertFlagRatePct: number;
}

export default function ConfigPanel() {
  const [cfg, setCfg] = useState<AIGovConfig>({
    enabled: true,
    sampleRate: 1,
    thresholds: { toxicity: 50, bias: 30 },
    alertFlagRatePct: 10,
  });
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    async function load() {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const res = await fetch("/api/admin/ai-evals/config", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          setCfg((prev) => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error("Error loading config:", err);
      }
    }
    load();
  }, []);

  const save = async () => {
    setBusy(true);
    setSuccess(false);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }

      const res = await fetch("/api/admin/ai-evals/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(cfg),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save config");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error saving config:", err);
      setError(err.message || "Failed to save config");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        AI Governance Settings
      </h3>

      {/* Enabled Toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={cfg.enabled}
          onChange={(e) =>
            setCfg((p) => ({ ...p, enabled: e.target.checked }))
          }
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Enable AI Evaluations
        </span>
      </label>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sample Rate */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Sample Rate (0-1)
          </label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={cfg.sampleRate}
            onChange={(e) =>
              setCfg((p) => ({ ...p, sampleRate: Number(e.target.value) }))
            }
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {cfg.sampleRate === 1
              ? "100% (all)"
              : `${(cfg.sampleRate * 100).toFixed(0)}% sampled`}
          </p>
        </div>

        {/* Toxicity Threshold */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Toxicity Threshold
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={cfg.thresholds.toxicity}
            onChange={(e) =>
              setCfg((p) => ({
                ...p,
                thresholds: { ...p.thresholds, toxicity: Number(e.target.value) },
              }))
            }
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Flag if score &gt; {cfg.thresholds.toxicity}
          </p>
        </div>

        {/* Bias Threshold */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Bias Threshold
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={cfg.thresholds.bias}
            onChange={(e) =>
              setCfg((p) => ({
                ...p,
                thresholds: { ...p.thresholds, bias: Number(e.target.value) },
              }))
            }
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Flag if score &gt; {cfg.thresholds.bias}
          </p>
        </div>

        {/* Alert Flag Rate % */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Alert Flag Rate %
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={cfg.alertFlagRatePct}
            onChange={(e) =>
              setCfg((p) => ({ ...p, alertFlagRatePct: Number(e.target.value) }))
            }
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Alert when flagged &gt; {cfg.alertFlagRatePct}%
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-md bg-black dark:bg-white px-6 py-2 text-sm font-medium text-white dark:text-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {busy ? "Saving..." : "Save Settings"}
        </button>

        {success && (
          <span className="text-sm text-green-600 dark:text-green-400">
            ✓ Settings saved successfully
          </span>
        )}

        {error && (
          <span className="text-sm text-red-600 dark:text-red-400">
            ✗ {error}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <strong>Note:</strong> Changes take effect immediately. Config is cached
          for 60 seconds in Cloud Functions. Disable evaluations to stop all AI
          output logging.
        </p>
      </div>
    </div>
  );
}
