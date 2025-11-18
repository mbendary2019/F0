"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function PlatformReports() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const t = await getAuth().currentUser?.getIdToken();
    const r = await fetch("/api/admin/platform/reports", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const j = await r.json();
    setRows(j.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const gen = async (month: string) => {
    setBusy(true);
    try {
      const res: any = await httpsCallable(
        getFunctions(),
        "generatePlatformMonthlyReport"
      )({ month });
      const url = res?.data?.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      await load();
    } catch (err: any) {
      alert(err.message || "Failed to generate report");
    } finally {
      setBusy(false);
    }
  };

  const now = new Date();
  const cur = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Platform Monthly Reports</h1>

      <button
        onClick={() => gen(cur)}
        disabled={busy}
        className="rounded-md border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? "Generating…" : `Generate ${cur}`}
      </button>

      <div className="rounded-xl border overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Month</th>
              <th className="px-3 py-2 text-right">Orders</th>
              <th className="px-3 py-2 text-right">Gross</th>
              <th className="px-3 py-2 text-right">Platform</th>
              <th className="px-3 py-2 text-right">Size</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.month || r.id}</td>
                <td className="px-3 py-2 text-right">{r.orders || 0}</td>
                <td className="px-3 py-2 text-right">
                  ${(r.gross || 0).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right">
                  ${(r.platform || 0).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.size ? `${(r.size / 1024).toFixed(1)} KB` : "-"}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => gen(r.month || r.id)}
                    className="rounded-md border px-3 py-1 hover:bg-gray-50"
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center opacity-70">
                  No reports yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
