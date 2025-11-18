"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function AdminReviewImages() {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const t = await getAuth().currentUser?.getIdToken();
    const r = await fetch("/api/admin/reviews/images", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const j = await r.json();
    setItems(j.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id: string, approve: boolean) => {
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
      <h1 className="text-2xl font-semibold mb-4">Pending Review Images</h1>
      <p className="text-sm opacity-70 mb-4">
        Reviews with images awaiting moderation. Images will publish automatically on approval.
      </p>
      <div className="rounded-xl border divide-y">
        {items.map((r) => (
          <div key={r.id} className="p-3 space-y-2">
            <div className="text-xs opacity-70">
              {new Date(r.createdAt).toLocaleString()} • ★ {r.rating} • User: {r.uid}
            </div>
            <div className="text-sm whitespace-pre-wrap">{r.text}</div>
            <div className="text-xs opacity-70">Review ID: {r.id}</div>
            <div className="text-xs opacity-70">
              Images will publish on approval (copied to public path automatically).
            </div>
            <div className="flex gap-2">
              <button
                disabled={busy === r.id}
                onClick={() => decide(r.id, true)}
                className="rounded-md border px-3 py-1 hover:bg-gray-50"
              >
                Approve
              </button>
              <button
                disabled={busy === r.id}
                onClick={() => decide(r.id, false)}
                className="rounded-md border px-3 py-1 hover:bg-gray-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {!items.length && (
          <div className="p-6 text-center opacity-70">No pending items.</div>
        )}
      </div>
    </div>
  );
}
