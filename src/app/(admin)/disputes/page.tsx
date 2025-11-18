"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

export default function AdminDisputes() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const t = await getAuth().currentUser?.getIdToken();
      const r = await fetch("/api/admin/disputes", {
        headers: { Authorization: `Bearer ${t}` },
        cache: "no-store",
      });
      const j = await r.json();
      setRows(j.items || []);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Disputes</h1>

      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2">Payment Intent</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Evidence Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{d.id}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {d.paymentIntentId || "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  ${(d.amountUsd || 0).toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs ${
                      d.status === "needs_response"
                        ? "bg-yellow-100 text-yellow-800"
                        : d.status === "won"
                        ? "bg-green-100 text-green-800"
                        : d.status === "lost"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="px-3 py-2">{d.reason || "-"}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {d.orderId || "-"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {d.evidenceDueBy
                    ? new Date(d.evidenceDueBy).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center opacity-70">
                  No disputes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
