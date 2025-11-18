"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

export default function RegionPricingPage() {
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const t = await getAuth().currentUser?.getIdToken();
    const r = await fetch("/api/admin/pricing/regions", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const data = await r.json();
    setJson(JSON.stringify(data, null, 2));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      const t = await getAuth().currentUser?.getIdToken();
      const parsed = JSON.parse(json);
      await fetch("/api/admin/pricing/regions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify(parsed),
      });
      alert("Saved successfully");
    } catch (err: any) {
      alert(err.message || "Invalid JSON");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Region Pricing Rules</h1>
      <p className="text-sm opacity-70">
        Configure region-specific pricing rules and currency defaults.
      </p>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        className="w-full rounded-md border p-3 font-mono text-sm"
        rows={20}
        placeholder='{"defaults":{},"regions":{}}'
      />
      <button
        onClick={save}
        disabled={busy}
        className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
