"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function AccountingPage() {
  const [gl, setGl] = useState<any>({
    revenue: "4000",
    platformFees: "4050",
    creatorPayouts: "5000",
    refunds: "4090",
    cash: "1000",
    ar: "1100",
  });
  const [exports, setExports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState("");

  useEffect(() => {
    loadGL();
    loadExports();
  }, []);

  const loadGL = async () => {
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch("/api/admin/accounting/config", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setGl(data);
    }
  };

  const loadExports = async () => {
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch("/api/admin/accounting/exports", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setExports(data.exports || []);
    }
  };

  const saveGL = async () => {
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch("/api/admin/accounting/config", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gl),
    });
    if (res.ok) {
      alert("GL mapping saved");
    } else {
      const err = await res.json();
      alert(err.error || "Failed to save GL mapping");
    }
  };

  const generateExport = async () => {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      alert("Please enter a valid month (YYYY-MM)");
      return;
    }
    setLoading(true);
    try {
      const fn = httpsCallable(getFunctions(), "accountingMonthlyExport");
      const res: any = await fn({ month });
      alert(`Export generated:\nJournal: ${res.data.journal}\nOrders: ${res.data.orders}\nRefunds: ${res.data.refunds}`);
      loadExports(); // Refresh list
    } catch (err: any) {
      alert(err.message || "Failed to generate export");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-8">
      <h1 className="text-3xl font-bold">Accounting</h1>

      {/* GL Mapping */}
      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">GL Mapping</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Revenue Account</label>
            <input
              type="text"
              value={gl.revenue}
              onChange={(e) => setGl({ ...gl, revenue: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="4000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Platform Fees Account</label>
            <input
              type="text"
              value={gl.platformFees}
              onChange={(e) => setGl({ ...gl, platformFees: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="4050"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Creator Payouts Account</label>
            <input
              type="text"
              value={gl.creatorPayouts}
              onChange={(e) => setGl({ ...gl, creatorPayouts: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="5000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Refunds Account</label>
            <input
              type="text"
              value={gl.refunds}
              onChange={(e) => setGl({ ...gl, refunds: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="4090"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cash Account</label>
            <input
              type="text"
              value={gl.cash}
              onChange={(e) => setGl({ ...gl, cash: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="1000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">A/R Account</label>
            <input
              type="text"
              value={gl.ar}
              onChange={(e) => setGl({ ...gl, ar: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="1100"
            />
          </div>
        </div>
        <button
          onClick={saveGL}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save GL Mapping
        </button>
      </div>

      {/* Generate Export */}
      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Generate Monthly Export</h2>
        <div className="flex gap-2 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Month (YYYY-MM)</label>
            <input
              type="text"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-2 border rounded"
              placeholder="2025-01"
            />
          </div>
          <button
            onClick={generateExport}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Export"}
          </button>
        </div>
      </div>

      {/* Exports List */}
      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">Past Exports</h2>
        {!exports.length && <div className="text-sm opacity-70">No exports yet.</div>}
        <div className="space-y-2">
          {exports.map((e) => (
            <div key={e.id} className="border rounded p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{e.month}</div>
                <div className="text-sm opacity-70">
                  {new Date(e.generatedAt).toLocaleString()}
                </div>
              </div>
              <div className="text-sm">
                Orders: {e.ordersCount || 0} | Refunds: {e.refundsCount || 0}
              </div>
              <div className="flex gap-2">
                <a
                  href={e.journal?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Download Journal
                </a>
                <a
                  href={e.orders?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Download Orders
                </a>
                <a
                  href={e.refunds?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Download Refunds
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
