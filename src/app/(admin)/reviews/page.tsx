"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function AdminReviewsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const dbUrl = "/api/admin/reviews?status=pending";
    const t = await getAuth().currentUser?.getIdToken();
    const r = await fetch(dbUrl, {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const j = await r.json();
    setItems(j.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      await httpsCallable(getFunctions(), "approveReview")({ reviewId: id, approve });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Pending Reviews</h1>
      <div className="rounded-xl border divide-y">
        {items.map((r) => (
          <div key={r.id} className="p-3">
            <div className="text-xs opacity-70">
              {new Date(r.createdAt).toLocaleString()} • product: {r.productId}
            </div>
            <div className="text-sm">★ {r.rating}</div>
            <div className="text-sm whitespace-pre-wrap">{r.text}</div>
            <div className="mt-2 flex gap-2">
              <button
                disabled={busy === r.id}
                onClick={() => act(r.id, true)}
                className="rounded-md border px-3 py-1 hover:bg-gray-50"
              >
                Approve
              </button>
              <button
                disabled={busy === r.id}
                onClick={() => act(r.id, false)}
                className="rounded-md border px-3 py-1 hover:bg-gray-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {!items.length && (
          <div className="p-6 text-center opacity-70">No pending reviews.</div>
        )}
      </div>
    </div>
  );
}
