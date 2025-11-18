"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebaseClient";

interface RetentionRule {
  collection: string;
  days: number;
  autoClean: boolean;
}

export default function RetentionPanel() {
  const [rules, setRules] = useState<RetentionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const fetchRules = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/retention", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch retention rules");
      }

      const json = await res.json();
      setRules(json.rules || []);
    } catch (error: any) {
      console.error("Error fetching rules:", error);
      setMessage({ type: "error", text: error.message || "Failed to load rules" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const updateRule = (index: number, patch: Partial<RetentionRule>) => {
    setRules((prev) =>
      prev.map((r, idx) => (idx === index ? { ...r, ...patch } : r))
    );
  };

  const addRow = () => {
    setRules((prev) => [...prev, { collection: "", days: 30, autoClean: false }]);
  };

  const removeRow = (index: number) => {
    setRules((prev) => prev.filter((_, idx) => idx !== index));
  };

  const save = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const token = await auth.currentUser?.getIdToken();

      // Validate rules
      for (const rule of rules) {
        if (!rule.collection.trim()) {
          throw new Error("Collection name cannot be empty");
        }
        if (rule.days < 1) {
          throw new Error("Retention days must be at least 1");
        }
      }

      const res = await fetch("/api/admin/retention", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rules }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save rules");
      }

      setMessage({ type: "success", text: "Retention rules saved successfully!" });
      await fetchRules();
    } catch (error: any) {
      console.error("Error saving rules:", error);
      setMessage({ type: "error", text: error.message || "Failed to save rules" });
    } finally {
      setLoading(false);
    }
  };

  const applyNow = async () => {
    if (!confirm("Are you sure you want to trigger retention cleanup now?")) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const functions = getFunctions();
      const callable = httpsCallable(functions, "triggerRetentionCleanup");

      const result: any = await callable();

      if (result.data?.success) {
        setMessage({
          type: "success",
          text: `Cleanup completed: ${result.data.deleted} documents deleted across ${result.data.rules} collections`,
        });
      } else {
        throw new Error(result.data?.message || "Cleanup failed");
      }
    } catch (error: any) {
      console.error("Error triggering cleanup:", error);
      setMessage({
        type: "error",
        text: error.message || "Failed to trigger cleanup",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Data Retention Policies</h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Configure automatic data cleanup policies. The retention cleaner runs every 6 hours.
      </p>

      {message && (
        <div
          className={`mb-4 rounded-lg p-4 ${
            message.type === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                Collection
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                Retention Days
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                Auto Clean
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rules.map((r, i) => (
              <tr key={i} className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3">
                  <input
                    className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    value={r.collection}
                    onChange={(e) => updateRule(i, { collection: e.target.value })}
                    placeholder="e.g., audit_logs"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="1"
                    className="w-24 rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    value={r.days}
                    onChange={(e) => updateRule(i, { days: Number(e.target.value) })}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={r.autoClean}
                    onChange={(e) => updateRule(i, { autoClean: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => removeRow(i)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rules.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No retention rules configured. Click "Add Rule" to create one.
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={addRow}
          className="rounded-md border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          disabled={loading}
        >
          Add Rule
        </button>
        <button
          onClick={save}
          disabled={loading || rules.length === 0}
          className="rounded-md bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save Rules"}
        </button>
        <button
          onClick={applyNow}
          disabled={loading || rules.length === 0}
          className="rounded-md border border-blue-600 px-4 py-2 font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Apply Now (Manual Trigger)
        </button>
      </div>

      <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm dark:bg-blue-900/20">
        <p className="font-medium text-blue-900 dark:text-blue-300">💡 Tips:</p>
        <ul className="mt-2 list-disc list-inside space-y-1 text-blue-800 dark:text-blue-400">
          <li>
            Retention period is calculated from the document's <code>createdAt</code> field
          </li>
          <li>Enable "Auto Clean" to automatically delete old documents</li>
          <li>Disable "Auto Clean" to keep rules for reference but skip cleanup</li>
          <li>The cleaner processes max 500 documents per collection per run</li>
          <li>Changes take effect on the next scheduled run (every 6 hours)</li>
        </ul>
      </div>
    </div>
  );
}
