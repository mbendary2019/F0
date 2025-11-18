"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

export default function CreatorEarningsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const t = await getAuth().currentUser?.getIdToken();
      const r = await fetch("/api/creator/earnings", {
        headers: { Authorization: `Bearer ${t}` },
        cache: "no-store",
      });
      setData(await r.json());
    })();
  }, []);

  const downloadCsv = async () => {
    const t = await getAuth().currentUser?.getIdToken();
    const r = await fetch("/api/creator/earnings.csv", {
      headers: { Authorization: `Bearer ${t}` },
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "creator-earnings.csv";
    a.click();
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Creator Earnings</h1>
      {!data && <div>Loading…</div>}

      {data && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI
              title="Orders (24h)"
              value={data.summary?.last24h?.orders || 0}
            />
            <KPI
              title="Gross (24h)"
              value={`$${(data.summary?.last24h?.grossUsd || 0).toFixed(2)}`}
            />
            <KPI
              title="Platform Fee (24h)"
              value={`$${(data.summary?.last24h?.platformUsd || 0).toFixed(2)}`}
            />
            <KPI
              title="Net Earnings (24h)"
              value={`$${(data.summary?.last24h?.netUsd || 0).toFixed(2)}`}
            />
          </section>

          <div>
            <button
              onClick={downloadCsv}
              className="rounded-md border px-3 py-2 hover:bg-gray-50"
            >
              Download CSV
            </button>
          </div>

          <section className="rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2">Paid At</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">Platform Fee</th>
                  <th className="px-3 py-2 text-right">Net</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((o: any) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-3 py-2">{o.id}</td>
                    <td className="px-3 py-2">
                      {o.paidAt ? new Date(o.paidAt).toLocaleString() : "-"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      ${(o.amountUsd || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      ${(o.platformFeeUsd || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      $
                      {(
                        (o.amountToCreatorUsd) ??
                        (((o.amountUsd || 0) - (o.platformFeeUsd || 0)) || 0)
                      ).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">{o.status}</td>
                  </tr>
                ))}
                {!(data.items || []).length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center opacity-70"
                    >
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function KPI({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-2xl md:text-3xl font-semibold">{value}</div>
    </div>
  );
}
