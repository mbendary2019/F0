"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function CreatorStatements() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const t = await getAuth().currentUser?.getIdToken();
    const r = await fetch("/api/creator/statements", {
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
        "generateCreatorStatement"
      )({ month });
      const url = res?.data?.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      await load();
    } catch (err: any) {
      alert(err.message || "Failed to generate statement");
    } finally {
      setBusy(false);
    }
  };

  const currentMonth = new Date();
  const y = currentMonth.getUTCFullYear();
  const m = String(currentMonth.getUTCMonth() + 1).padStart(2, "0");
  const thisMonth = `${y}-${m}`;

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Creator Statements</h1>

      <div className="flex gap-2">
        <button
          onClick={() => gen(thisMonth)}
          disabled={busy}
          className="rounded-md border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? "Generating…" : `Generate ${thisMonth}`}
        </button>
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Month</th>
              <th className="px-3 py-2 text-right">Size</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="px-3 py-2">{f.month || f.id}</td>
                <td className="px-3 py-2 text-right">
                  {f.size ? `${(f.size / 1024).toFixed(1)} KB` : "-"}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => gen(f.month || f.id)}
                    className="rounded-md border px-3 py-1 hover:bg-gray-50"
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center opacity-70">
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
