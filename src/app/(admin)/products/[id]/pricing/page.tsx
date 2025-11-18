"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "AED", "CAD", "AUD", "JPY", "INR", "SGD"];

export default function ProductPricingPage({ params }: { params: { id: string } }) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const t = await getAuth().currentUser?.getIdToken();
    const r = await fetch(`/api/admin/products/${params.id}/pricing`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const j = await r.json();
    setPrices(j.prices || {});
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const save = async () => {
    setBusy(true);
    try {
      const t = await getAuth().currentUser?.getIdToken();
      await fetch(`/api/admin/products/${params.id}/pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ prices }),
      });
      alert("Pricing saved successfully");
    } catch (err: any) {
      alert(err.message || "Failed to save pricing");
    } finally {
      setBusy(false);
    }
  };

  const handleChange = (currency: string, value: string) => {
    const numValue = value ? Number(value) : undefined;
    setPrices({ ...prices, [currency]: numValue as any });
  };

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Pricing Overrides</h1>
      <p className="text-sm opacity-70">
        Set custom prices for each currency. Leave empty to use automatic FX conversion.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {SUPPORTED_CURRENCIES.map((c) => (
          <label key={c} className="text-sm">
            <span className="opacity-70 font-medium">{c}</span>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-md border p-2 mt-1"
              value={prices[c] ?? ""}
              onChange={(e) => handleChange(c, e.target.value)}
              placeholder="Auto FX"
            />
          </label>
        ))}
      </div>
      <button
        onClick={save}
        disabled={busy}
        className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save Pricing"}
      </button>
    </div>
  );
}
