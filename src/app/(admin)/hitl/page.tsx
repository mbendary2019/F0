"use client";

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import ReviewDrawer from "./_components/ReviewDrawer";

type Review = {
  id: string;
  status: "queued" | "assigned" | "resolved";
  severity: "low" | "med" | "high" | "critical";
  labels?: string[];
  createdAt: number;
  assignedTo?: string | null;
  model?: string;
  uid?: string;
};

export default function HITLPage() {
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("queued");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [current, setCurrent] = useState<Review | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const token = await getAuth().currentUser?.getIdToken();
    const res = await fetch(`/api/admin/hitl/reviews?status=${status}&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = await res.json();
    setItems(json.items || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [status]);

  const assignToMe = async (id: string) => {
    const fn = httpsCallable(getFunctions(), "hitlAssign");
    await fn({ reviewId: id });
    await fetchItems();
  };

  const openDrawer = (rev: Review) => {
    setCurrent(rev);
    setDrawerOpen(true);
  };

  return (
    <>
      <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Human-in-the-Loop Reviews</h1>
        <div className="flex items-center gap-2">
          <select className="rounded-md border px-3 py-2" value={status} onChange={(e)=>setStatus(e.target.value)}>
            <option value="queued">Queued</option>
            <option value="assigned">Assigned</option>
            <option value="resolved">Resolved</option>
          </select>
          <button onClick={fetchItems} className="rounded-md border px-3 py-2 hover:bg-gray-50">Refresh</button>
        </div>
      </div>

      {loading && <div className="opacity-70">Loading…</div>}

      <div className="rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-left">Severity</th>
              <th className="px-3 py-2 text-left">Labels</th>
              <th className="px-3 py-2 text-left">Model</th>
              <th className="px-3 py-2 text-left">Assigned</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={()=>openDrawer(r)}>
                <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 font-medium">{r.severity.toUpperCase()}</td>
                <td className="px-3 py-2">{(r.labels || []).join(", ") || "-"}</td>
                <td className="px-3 py-2">{r.model || "-"}</td>
                <td className="px-3 py-2">{r.assignedTo || "-"}</td>
                <td className="px-3 py-2" onClick={(e)=>e.stopPropagation()}>
                  {r.status !== "resolved" && (
                    <div className="flex items-center justify-center gap-2">
                      {r.status === "queued" && (
                        <button onClick={() => assignToMe(r.id)} className="rounded-md border px-3 py-1 hover:bg-gray-50">
                          Assign to me
                        </button>
                      )}
                    </div>
                  )}
                  {r.status === "resolved" && <div className="text-center text-xs opacity-70">Resolved</div>}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-3 py-6 text-center opacity-70">No reviews found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

      <ReviewDrawer
        open={drawerOpen}
        onClose={()=>setDrawerOpen(false)}
        review={current}
        onResolved={async ()=>{ await fetchItems(); }}
      />
    </>
  );
}
