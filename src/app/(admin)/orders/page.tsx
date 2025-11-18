"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function AdminOrdersPage() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState<"paid" | "refunded">("paid");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const t = await getAuth().currentUser?.getIdToken();
    const r = await fetch(`/api/admin/orders?status=${status}`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const j = await r.json();
    setItems(j.items || []);
  };

  useEffect(() => {
    load();
  }, [status]);

  const refund = async (id: string) => {
    if (!confirm("Are you sure you want to refund this order?")) return;

    setBusy(id);
    try {
      await httpsCallable(getFunctions(), "refundOrder")({ orderId: id });
      await load();
    } catch (err: any) {
      alert(err.message || "Failed to refund order");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Admin — Orders</h1>

      <div className="flex gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="rounded-md border p-2"
        >
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Order ID</th>
              <th className="px-3 py-2">Payment Intent</th>
              <th className="px-3 py-2">Creator UID</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o: any) => (
              <tr key={o.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{o.id}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {o.paymentIntentId || "-"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {o.creatorUid || "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  ${(o.amountUsd || 0).toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs ${
                      o.status === "paid"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {o.status === "paid" ? (
                    <button
                      disabled={busy === o.id}
                      onClick={() => refund(o.id)}
                      className="rounded-md border px-3 py-1 hover:bg-red-50 hover:border-red-300 disabled:opacity-50"
                    >
                      {busy === o.id ? "Refunding…" : "Refund"}
                    </button>
                  ) : (
                    <span className="opacity-60">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center opacity-70">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
