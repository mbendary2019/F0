"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

export default function AdvancedAnalytics() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const t = await getAuth().currentUser?.getIdToken();
      const r = await fetch("/api/admin/analytics/advanced", {
        headers: { Authorization: `Bearer ${t}` },
        cache: "no-store",
      });
      setData(await r.json());
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Advanced Analytics</h1>

      {!data && <div>Loading…</div>}

      {data && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <K title="Orders (24h)" v={data.last24h?.orders || 0} />
            <K title="Revenue (24h)" v={`$${(data.last24h?.revenueUsd || 0).toFixed(2)}`} />
            <K title="Platform (24h)" v={`$${(data.last24h?.platformUsd || 0).toFixed(2)}`} />
            <K title="Creators (24h)" v={`$${(data.last24h?.creatorsUsd || 0).toFixed(2)}`} />
          </section>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <K title="Orders (7d)" v={data.last7d?.orders || 0} />
            <K title="Revenue (7d)" v={`$${(data.last7d?.revenueUsd || 0).toFixed(2)}`} />
            <K title="Platform (7d)" v={`$${(data.last7d?.platformUsd || 0).toFixed(2)}`} />
            <K title="Creators (7d)" v={`$${(data.last7d?.creatorsUsd || 0).toFixed(2)}`} />
          </section>

          <section className="rounded-xl border p-4">
            <h2 className="font-medium mb-2">Top Products — last 24h</h2>
            <Table rows={data.topProducts24h || []} />
          </section>

          <section className="rounded-xl border p-4">
            <h2 className="font-medium mb-2">Top Products — last 7d</h2>
            <Table rows={data.topProducts7d || []} />
          </section>

          <section className="rounded-xl border p-4">
            <h2 className="font-medium mb-2">Coupon Usage — last 24h</h2>
            <Coupons rows={data.couponUsage24h || []} />
          </section>

          <section className="rounded-xl border p-4">
            <h2 className="font-medium mb-2">Coupon Usage — last 7d</h2>
            <Coupons rows={data.couponUsage7d || []} />
          </section>
        </>
      )}
    </div>
  );
}

function K({ title, v }: { title: string; v: any }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-2xl md:text-3xl font-semibold">{v}</div>
    </div>
  );
}

function Table({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">Product</th>
            <th className="px-3 py-2 text-right">Orders</th>
            <th className="px-3 py-2 text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="px-3 py-2">{r.title || r.productId}</td>
              <td className="px-3 py-2 text-right">{r.orders}</td>
              <td className="px-3 py-2 text-right">${(r.revenueUsd || 0).toFixed(2)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center opacity-70">
                No data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Coupons({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">Code</th>
            <th className="px-3 py-2 text-right">Orders</th>
            <th className="px-3 py-2 text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="px-3 py-2">{r.code}</td>
              <td className="px-3 py-2 text-right">{r.orders}</td>
              <td className="px-3 py-2 text-right">${(r.revenueUsd || 0).toFixed(2)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center opacity-70">
                No data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
