"use client";
import { useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";

export default function CreatorDashboard() {
  const [creator, setCreator] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async()=>{
      const token = await getAuth().currentUser?.getIdToken();
      const r = await fetch("/api/me/creator", { headers: { Authorization:`Bearer ${token}` }, cache:"no-store" });
      const j = await r.json();
      setCreator(j || null);
    })();
  }, []);

  const openStripe = async () => {
    setBusy(true);
    try {
      const r: any = await httpsCallable(getFunctions(), "createDashboardLink")({});
      if (r?.data?.url) window.open(r.data.url, "_blank", "noopener,noreferrer");
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Creator Dashboard</h1>
      {!creator?.stripeAccountId && <div className="opacity-70">No creator account yet. Go to Apply.</div>}
      {creator?.stripeAccountId && (
        <div className="rounded-xl border p-4">
          <div className="text-sm">Stripe Account: {creator.stripeAccountId || "-"}</div>
          <div className="text-sm">Charges Enabled: {String(creator.chargesEnabled)}</div>
          <div className="text-sm">Payouts Enabled: {String(creator.payoutsEnabled)}</div>
          <button onClick={openStripe} disabled={busy} className="mt-3 rounded-md border px-3 py-2 hover:bg-gray-50">
            Open Stripe Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
