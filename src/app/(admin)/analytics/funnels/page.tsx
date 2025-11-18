"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

export default function FunnelsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const t = await getAuth().currentUser?.getIdToken();
      const r = await fetch("/api/admin/analytics/funnels", {
        headers: { Authorization: `Bearer ${t}` },
        cache: "no-store",
      });
      setData(await r.json());
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Funnels (last 24h)</h1>
      <p className="text-sm opacity-70">View → Checkout → Purchase conversion rates</p>
      {!data && <div>Loading…</div>}
      {data && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-right">Views</th>
                <th className="px-3 py-2 text-right">Starts</th>
                <th className="px-3 py-2 text-right">Buys</th>
                <th className="px-3 py-2 text-right">View→Checkout</th>
                <th className="px-3 py-2 text-right">Checkout→Purchase</th>
                <th className="px-3 py-2 text-right">View→Purchase</th>
              </tr>
            </thead>
            <tbody>
              {(data.rows || []).map((r: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{r.productId}</td>
                  <td className="px-3 py-2 text-right">{r.views24h}</td>
                  <td className="px-3 py-2 text-right">{r.starts24h}</td>
                  <td className="px-3 py-2 text-right">{r.buys24h}</td>
                  <td className="px-3 py-2 text-right">{r.viewToCheckoutPct}%</td>
                  <td className="px-3 py-2 text-right">{r.checkoutToPurchasePct}%</td>
                  <td className="px-3 py-2 text-right">{r.viewToPurchasePct}%</td>
                </tr>
              ))}
              {!(data.rows || []).length && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center opacity-70">
                    No data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
