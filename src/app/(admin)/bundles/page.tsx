"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

type Bundle = {
  id?: string;
  slug?: string;
  title: string;
  description?: string;
  productIds: string[];
  prices?: Record<string, number>;
  discountPercent?: number;
  active?: boolean;
  published?: boolean;
  imageUrl?: string | null;
};

export default function BundlesAdminPage() {
  const [items, setItems] = useState<Bundle[]>([]);
  const [form, setForm] = useState<Bundle>({
    title: "",
    slug: "",
    productIds: [],
    discountPercent: 0,
    active: true,
    published: false,
  });

  const load = async () => {
    const t = await getAuth().currentUser?.getIdToken();
    const r = await fetch("/api/admin/bundles", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const j = await r.json();
    setItems(j.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const t = await getAuth().currentUser?.getIdToken();
    await fetch("/api/admin/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(form),
    });
    setForm({
      title: "",
      slug: "",
      productIds: [],
      discountPercent: 0,
      active: true,
      published: false,
    });
    await load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this bundle?")) return;
    const t = await getAuth().currentUser?.getIdToken();
    await fetch(`/api/admin/bundles/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` },
    });
    await load();
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Bundles (Admin)</h1>

      <div className="rounded-xl border p-4 space-y-3">
        <div className="font-medium">Create / Update</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="rounded-md border p-2"
            placeholder="slug (doc id)"
            value={form.slug || ""}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <input
            className="rounded-md border p-2"
            placeholder="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            className="rounded-md border p-2"
            placeholder="productIds comma-separated"
            onChange={(e) =>
              setForm({
                ...form,
                productIds: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
          <input
            className="rounded-md border p-2"
            placeholder="discountPercent (0-100)"
            onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value || 0) })}
          />
          <input
            className="rounded-md border p-2"
            placeholder='prices JSON e.g. {"USD":49,"EUR":44.99}'
            onChange={(e) => {
              try {
                setForm({ ...form, prices: JSON.parse(e.target.value || "{}") });
              } catch {}
            }}
          />
          <input
            className="rounded-md border p-2"
            placeholder="image URL (optional)"
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value || null })}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />{" "}
            active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
            />{" "}
            published
          </label>
          <button onClick={save} className="rounded-md border px-3 py-2 hover:bg-gray-50">
            Save
          </button>
        </div>
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Slug</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="px-3 py-2">{b.slug || b.id}</td>
                <td className="px-3 py-2">{b.title}</td>
                <td className="px-3 py-2 text-center">{String(b.active)}</td>
                <td className="px-3 py-2 text-center">{String(b.published)}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => del(b.id!)}
                    className="rounded-md border px-2 py-1 hover:bg-gray-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center opacity-70">
                  No bundles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
