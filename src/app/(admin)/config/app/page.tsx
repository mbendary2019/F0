"use client";

import { useState, useEffect } from "react";

export default function AppConfigPage() {
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const res = await fetch("/api/admin/config/app");
      if (!res.ok) throw new Error("Failed to fetch app config");
      const data = await res.json();
      setConfig(data.config || {});
    } catch (error: any) {
      console.error(error);
      setMessage("Error loading app config");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/config/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setConfig(data.config);
      setMessage("✅ App config updated successfully");
    } catch (error: any) {
      console.error(error);
      setMessage("❌ Error saving: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8">Loading app config...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">App Configuration</h1>
      <p className="text-gray-600 mb-6">
        Global application settings and defaults.
      </p>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message}
        </div>
      )}

      <div className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* Mode */}
        <div>
          <label className="block font-medium mb-2">Mode</label>
          <select
            value={config.mode || "F0"}
            onChange={(e) => setConfig({ ...config, mode: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="F0">F0 - Full Production</option>
            <option value="BETA">BETA - Limited Access</option>
            <option value="DEV">DEV - Development</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            Current deployment mode
          </p>
        </div>

        {/* Allow Signup */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <label className="block font-medium">Allow Signup</label>
            <p className="text-sm text-gray-500 mt-1">
              Enable new user registration
            </p>
          </div>
          <button
            onClick={() => setConfig({ ...config, allowSignup: !config.allowSignup })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.allowSignup ? "bg-green-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.allowSignup ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Show Marketplace */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <label className="block font-medium">Show Marketplace</label>
            <p className="text-sm text-gray-500 mt-1">
              Display public product marketplace
            </p>
          </div>
          <button
            onClick={() => setConfig({ ...config, showMarketplace: !config.showMarketplace })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.showMarketplace ? "bg-green-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.showMarketplace ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Default Currency */}
        <div>
          <label className="block font-medium mb-2">Default Currency</label>
          <select
            value={config.defaultCurrency || "USD"}
            onChange={(e) => setConfig({ ...config, defaultCurrency: e.target.value })}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="AED">AED - UAE Dirham</option>
            <option value="CAD">CAD - Canadian Dollar</option>
            <option value="AUD">AUD - Australian Dollar</option>
            <option value="JPY">JPY - Japanese Yen</option>
            <option value="INR">INR - Indian Rupee</option>
            <option value="SGD">SGD - Singapore Dollar</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            Fallback currency for new users
          </p>
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={fetchConfig}
          disabled={saving}
          className="px-6 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      {config.updatedAt && (
        <div className="mt-4 text-sm text-gray-500">
          Last updated: {new Date(config.updatedAt).toLocaleString()}
          {config.updatedBy && ` by ${config.updatedBy}`}
        </div>
      )}
    </div>
  );
}
