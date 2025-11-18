"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function InvoicesPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const db = getFirestore();
      const q = query(
        collection(db, "orders"),
        where("uid", "==", user.uid),
        where("status", "==", "paid")
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(data);
      setLoading(false);
    };
    load();
  }, []);

  const generateInvoice = async (orderId: string) => {
    setGenerating(orderId);
    try {
      const fn = httpsCallable(getFunctions(), "generateVatInvoice");
      const res: any = await fn({ orderId });
      const url = res?.data?.url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      alert(err.message || "Failed to generate invoice");
    } finally {
      setGenerating(null);
    }
  };

  const downloadInvoice = async (orderId: string) => {
    setGenerating(orderId);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`/api/me/invoices/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.needsGeneration) {
        // Generate if doesn't exist
        await generateInvoice(orderId);
      } else if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      alert(err.message || "Failed to download invoice");
    } finally {
      setGenerating(null);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">My Invoices</h1>
      {!orders.length && <div className="opacity-70">No paid orders yet.</div>}
      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="border rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">Order #{o.id.slice(0, 8)}</div>
              <div className="text-sm opacity-70">
                {new Date(o.paidAt).toLocaleDateString()} • {o.currency || "USD"}{" "}
                {(o.amountCharged || o.amountUsd)?.toFixed(2)}
              </div>
            </div>
            <button
              onClick={() => downloadInvoice(o.id)}
              disabled={generating === o.id}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {generating === o.id ? "Loading…" : "Download Invoice"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
