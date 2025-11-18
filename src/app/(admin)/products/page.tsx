"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

type Product = {
  id?: string;
  slug: string;
  title: string;
  description?: string;
  priceUsd: number;
  assetPath: string;
  version?: string;
  active: boolean;
  published: boolean;
  ownerUid?: string;
  creatorStripeAccountId?: string;
  creatorSharePct?: number; // 0..1
};

export default function AdminProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [form, setForm] = useState<Product>({ slug:"", title:"", priceUsd:0, assetPath:"", active:true, published:true, creatorSharePct:0.85 });
  const [busy, setBusy] = useState(false);
  const token = async () => await getAuth().currentUser?.getIdToken();

  const load = async () => {
    const t = await token();
    const r = await fetch("/api/admin/products", { headers:{ Authorization:`Bearer ${t}` }, cache:"no-store" });
    const j = await r.json();
    setItems(j.items || []);
  };
  useEffect(()=>{ load(); }, []);

  const save = async () => {
    setBusy(true);
    const t = await token();
    await fetch("/api/admin/products", { method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${t}` }, body: JSON.stringify(form) });
    setBusy(false);
    setForm(prev => ({ ...prev, slug:"", title:"", priceUsd:0, assetPath:"" }));
    await load();
  };

  const remove = async (id: string) => {
    const t = await token();
    await fetch(`/api/admin/products/${id}`, { method:"DELETE", headers:{ Authorization:`Bearer ${t}` } });
    await load();
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Admin — Products</h1>

      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="font-medium">Create / Update</h2>
        <div className="grid grid-cols-2 gap-4">
          <input placeholder="slug" className="rounded-md border p-2" value={form.slug} onChange={e=>setForm({...form, slug:e.target.value})}/>
          <input placeholder="title" className="rounded-md border p-2" value={form.title} onChange={e=>setForm({...form, title:e.target.value})}/>
          <input placeholder="priceUsd" type="number" className="rounded-md border p-2" value={form.priceUsd} onChange={e=>setForm({...form, priceUsd:Number(e.target.value)})}/>
          <input placeholder="assetPath" className="rounded-md border p-2" value={form.assetPath} onChange={e=>setForm({...form, assetPath:e.target.value})}/>
          <input placeholder="ownerUid (creator uid)" className="rounded-md border p-2" value={form.ownerUid||""} onChange={e=>setForm({...form, ownerUid:e.target.value})}/>
          <input placeholder="creatorStripeAccountId (acct_xxx)" className="rounded-md border p-2" value={form.creatorStripeAccountId||""} onChange={e=>setForm({...form, creatorStripeAccountId:e.target.value})}/>
          <input placeholder="creatorSharePct (0.85)" type="number" step="0.01" className="rounded-md border p-2" value={form.creatorSharePct||0.85} onChange={e=>setForm({...form, creatorSharePct:Number(e.target.value)})}/>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form, active:e.target.checked})}/> active</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form, published:e.target.checked})}/> published</label>
        </div>
        <button onClick={save} disabled={busy} className="rounded-md bg-black px-4 py-2 text-white hover:opacity-90">{busy ? "Saving…" : "Save"}</button>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-medium mb-2">All Products</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>
            <th className="px-3 py-2 text-left">Title</th><th className="px-3 py-2 text-left">Price</th>
            <th className="px-3 py-2 text-left">Owner</th><th className="px-3 py-2 text-left">Share</th>
            <th className="px-3 py-2 text-left">Active</th><th className="px-3 py-2 text-left">Published</th>
            <th className="px-3 py-2">Action</th></tr></thead>
          <tbody>
            {items.map(p=>(
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.title}</td>
                <td className="px-3 py-2">${p.priceUsd}</td>
                <td className="px-3 py-2">{p.ownerUid || "-"}</td>
                <td className="px-3 py-2">{((p.creatorSharePct ?? 0)*100).toFixed(0)}%</td>
                <td className="px-3 py-2">{String(p.active)}</td>
                <td className="px-3 py-2">{String(p.published)}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={()=>remove(p.id!)} className="rounded-md border px-3 py-1 hover:bg-gray-50">Delete</button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={7} className="px-3 py-6 text-center opacity-70">No products.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
