"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function LicensesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(()=>{
    (async ()=>{
      const token = await getAuth().currentUser?.getIdToken();
      const r = await fetch("/api/me/licenses", { headers: { Authorization: `Bearer ${token}` }, cache:"no-store" });
      const j = await r.json();
      setItems(j.items || []);
    })();
  }, []);

  const download = async (productId: string) => {
    setBusy(productId);
    try {
      const fn = httpsCallable(getFunctions(), "generateDownloadUrl");
      const res: any = await fn({ productId });
      if (res.data?.url) window.location.href = res.data.url;
    } finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold mb-4">My Licenses</h1>
      <div className="rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2">Granted</th><th className="px-3 py-2">Downloads</th><th className="px-3 py-2">Action</th></tr>
          </thead>
          <tbody>
            {items.map(it=>(
              <tr key={it.id} className="border-t">
                <td className="px-3 py-2">{it.product?.title || it.productId}</td>
                <td className="px-3 py-2">{new Date(it.grantedAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-center">{it.downloadCount || 0}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={()=>download(it.productId)} disabled={busy===it.productId}
                    className="rounded-md border px-3 py-1 hover:bg-gray-50">
                    {busy===it.productId ? "Preparing…" : "Download"}
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={4} className="px-3 py-6 text-center opacity-70">No licenses yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
