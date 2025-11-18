"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function MyStatements() {
  const [items, setItems] = useState<any[]>([]);
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const t = await getAuth().currentUser?.getIdToken();
    const r = await fetch("/api/me/statements", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const j = await r.json();
    setItems(j.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const gen = async () => {
    setBusy(true);
    try {
      const fn = httpsCallable(getFunctions(), "generateCustomerVatStatement");
      const res: any = await fn({ month });
      const url = res?.data?.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      await load();
    } catch (err: any) {
      alert(err.message || "Failed to generate statement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">My VAT Statements</h1>
      <div className="flex items-center gap-3">
        <input
          className="rounded-md border p-2"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          placeholder="YYYY-MM"
        />
        <button
          onClick={gen}
          disabled={busy}
          className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate"}
        </button>
      </div>
      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Month</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x: any) => (
              <tr key={x.id} className="border-t">
                <td className="px-3 py-2">{x.month || x.id}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => window.open(x.url || "#", "_blank")}
                    className="rounded-md border px-3 py-1 hover:bg-gray-50"
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td className="px-3 py-6 text-center opacity-70" colSpan={2}>
                  No statements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
