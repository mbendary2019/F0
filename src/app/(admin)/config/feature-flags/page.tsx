"use client";

import { useState, useEffect } from "react";

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchFlags();
  }, []);

  async function fetchFlags() {
    try {
      const res = await fetch("/api/admin/config/feature-flags");
      if (!res.ok) throw new Error("Failed to fetch feature flags");
      const data = await res.json();
      setFlags(data.flags || {});
    } catch (error: any) {
      console.error(error);
      setMessage("Error loading feature flags");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/config/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setFlags(data.flags);
      setMessage("✅ Feature flags updated successfully");
    } catch (error: any) {
      console.error(error);
      setMessage("❌ Error saving: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  function updateFlag(path: string, value: any) {
    const keys = path.split(".");
    const updated = { ...flags };
    let current = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    setFlags(updated);
  }

  function getFlag(path: string) {
    const keys = path.split(".");
    let current = flags;
    for (const key of keys) {
      if (!current || typeof current !== "object") return undefined;
      current = current[key];
    }
    return current;
  }

  if (loading) {
    return <div className="p-8">Loading feature flags...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">Feature Flags</h1>
      <p className="text-gray-600 mb-6">
        Manage feature toggles for F0 production mode. Canary settings start at 10% AI eval sample rate.
      </p>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message}
        </div>
      )}

      <div className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* Invoices */}
        <FlagToggle
          label="Auto-Invoice"
          path="invoices.enabled"
          value={getFlag("invoices.enabled")}
          onChange={(v) => updateFlag("invoices.enabled", v)}
          description="Automatically generate VAT invoices on order paid"
        />

        {/* Taxes */}
        <FlagToggle
          label="Stripe Automatic Tax"
          path="taxes.enabled"
          value={getFlag("taxes.enabled")}
          onChange={(v) => updateFlag("taxes.enabled", v)}
          description="Enable Stripe Automatic Tax in checkout"
        />

        {/* FX */}
        <FlagToggle
          label="FX Rates"
          path="fx.enabled"
          value={getFlag("fx.enabled")}
          onChange={(v) => updateFlag("fx.enabled", v)}
          description="Hourly FX rate sync and multi-currency support"
        />

        {/* Region Pricing */}
        <FlagToggle
          label="Region Pricing"
          path="region_pricing.enabled"
          value={getFlag("region_pricing.enabled")}
          onChange={(v) => updateFlag("region_pricing.enabled", v)}
          description="5-tier region-based pricing rules"
        />

        {/* Pricing Overrides */}
        <FlagToggle
          label="Pricing Overrides"
          path="pricing_overrides.enabled"
          value={getFlag("pricing_overrides.enabled")}
          onChange={(v) => updateFlag("pricing_overrides.enabled", v)}
          description="Per-currency product pricing overrides"
        />

        {/* Bundles */}
        <FlagToggle
          label="Bundles"
          path="bundles.enabled"
          value={getFlag("bundles.enabled")}
          onChange={(v) => updateFlag("bundles.enabled", v)}
          description="Product bundles with multi-license issuance"
        />

        {/* Marketplace */}
        <FlagToggle
          label="Marketplace"
          path="marketplace.enabled"
          value={getFlag("marketplace.enabled")}
          onChange={(v) => updateFlag("marketplace.enabled", v)}
          description="Public product marketplace"
        />

        {/* Connect */}
        <div className="border-b pb-4">
          <FlagToggle
            label="Stripe Connect"
            path="connect.enabled"
            value={getFlag("connect.enabled")}
            onChange={(v) => updateFlag("connect.enabled", v)}
            description="Creator payouts via Stripe Connect"
          />
          <div className="mt-2 ml-8">
            <label className="block text-sm text-gray-600 mb-1">Platform Fee %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={getFlag("connect.platform_fee_pct") || 15}
              onChange={(e) => updateFlag("connect.platform_fee_pct", parseInt(e.target.value))}
              className="w-24 px-3 py-1 border rounded"
            />
          </div>
        </div>

        {/* Coupons */}
        <FlagToggle
          label="Coupons"
          path="coupons.enabled"
          value={getFlag("coupons.enabled")}
          onChange={(v) => updateFlag("coupons.enabled", v)}
          description="Discount coupons"
        />

        {/* Reviews */}
        <div className="border-b pb-4">
          <FlagToggle
            label="Reviews"
            path="reviews.enabled"
            value={getFlag("reviews.enabled")}
            onChange={(v) => updateFlag("reviews.enabled", v)}
            description="Product reviews and ratings"
          />
          <div className="mt-2 ml-8 space-y-2">
            <FlagToggle
              label="Spam Guard"
              path="reviews.spam_guard"
              value={getFlag("reviews.spam_guard")}
              onChange={(v) => updateFlag("reviews.spam_guard", v)}
              description="AI spam detection"
              small
            />
            <FlagToggle
              label="Image Moderation Required"
              path="reviews.img_mod_required"
              value={getFlag("reviews.img_mod_required")}
              onChange={(v) => updateFlag("reviews.img_mod_required", v)}
              description="Require manual approval for review images"
              small
            />
          </div>
        </div>

        {/* Search */}
        <div className="border-b pb-4">
          <FlagToggle
            label="Search (Algolia)"
            path="search.algolia"
            value={getFlag("search.algolia")}
            onChange={(v) => updateFlag("search.algolia", v)}
            description="Algolia-powered search"
          />
          <div className="mt-2 ml-8">
            <FlagToggle
              label="Fallback Search"
              path="search.fallback"
              value={getFlag("search.fallback")}
              onChange={(v) => updateFlag("search.fallback", v)}
              description="Use Firestore if Algolia fails"
              small
            />
          </div>
        </div>

        {/* AI Eval (Canary) */}
        <div className="border-b pb-4 bg-yellow-50 p-4 rounded">
          <FlagToggle
            label="AI Evaluation"
            path="ai_eval.enabled"
            value={getFlag("ai_eval.enabled")}
            onChange={(v) => updateFlag("ai_eval.enabled", v)}
            description="AI-powered content evaluation"
          />
          <div className="mt-2 ml-8">
            <label className="block text-sm text-gray-600 mb-1">
              Sample Rate (Canary: Start 0.10 → 0.5 → 1.0)
            </label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={getFlag("ai_eval.sampleRate") || 0.1}
              onChange={(e) => updateFlag("ai_eval.sampleRate", parseFloat(e.target.value))}
              className="w-24 px-3 py-1 border rounded"
            />
            <span className="ml-2 text-sm text-gray-500">
              {Math.round((getFlag("ai_eval.sampleRate") || 0.1) * 100)}%
            </span>
          </div>
        </div>

        {/* HITL */}
        <FlagToggle
          label="Human-in-the-Loop"
          path="hitl.enabled"
          value={getFlag("hitl.enabled")}
          onChange={(v) => updateFlag("hitl.enabled", v)}
          description="Manual content review workflow"
        />

        {/* Policies */}
        <FlagToggle
          label="Policies"
          path="policies.enabled"
          value={getFlag("policies.enabled")}
          onChange={(v) => updateFlag("policies.enabled", v)}
          description="Content policies enforcement"
        />

        {/* Alerts */}
        <div className="border-b pb-4">
          <FlagToggle
            label="Slack Alerts"
            path="alerts.slack"
            value={getFlag("alerts.slack")}
            onChange={(v) => updateFlag("alerts.slack", v)}
            description="Send alerts to Slack"
          />
        </div>

        {/* Analytics */}
        <div className="border-b pb-4">
          <FlagToggle
            label="Advanced Analytics"
            path="analytics.advanced"
            value={getFlag("analytics.advanced")}
            onChange={(v) => updateFlag("analytics.advanced", v)}
            description="Advanced analytics dashboards"
          />
          <div className="mt-2 ml-8">
            <FlagToggle
              label="Funnels"
              path="analytics.funnels"
              value={getFlag("analytics.funnels")}
              onChange={(v) => updateFlag("analytics.funnels", v)}
              description="Conversion funnel tracking"
              small
            />
          </div>
        </div>

        {/* Statements */}
        <div className="border-b pb-4">
          <FlagToggle
            label="Customer Statements"
            path="statements.customer"
            value={getFlag("statements.customer")}
            onChange={(v) => updateFlag("statements.customer", v)}
            description="Monthly VAT statements for customers"
          />
          <div className="mt-2 ml-8">
            <FlagToggle
              label="Creator Statements"
              path="statements.creator"
              value={getFlag("statements.creator")}
              onChange={(v) => updateFlag("statements.creator", v)}
              description="Earnings statements for creators"
              small
            />
          </div>
        </div>

        {/* Payouts */}
        <FlagToggle
          label="Payouts"
          path="payouts.enabled"
          value={getFlag("payouts.enabled")}
          onChange={(v) => updateFlag("payouts.enabled", v)}
          description="Creator payout processing"
        />

        {/* Accounting */}
        <FlagToggle
          label="Accounting"
          path="accounting.enabled"
          value={getFlag("accounting.enabled")}
          onChange={(v) => updateFlag("accounting.enabled", v)}
          description="General ledger and accounting reports"
        />
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
          onClick={fetchFlags}
          disabled={saving}
          className="px-6 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      {flags.updatedAt && (
        <div className="mt-4 text-sm text-gray-500">
          Last updated: {new Date(flags.updatedAt).toLocaleString()}
          {flags.updatedBy && ` by ${flags.updatedBy}`}
        </div>
      )}
    </div>
  );
}

function FlagToggle({
  label,
  path,
  value,
  onChange,
  description,
  small,
}: {
  label: string;
  path: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
  small?: boolean;
}) {
  return (
    <div className={`flex items-start justify-between ${!small ? "border-b pb-4" : ""}`}>
      <div>
        <label className={`block font-medium ${small ? "text-sm" : ""}`}>{label}</label>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-green-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
