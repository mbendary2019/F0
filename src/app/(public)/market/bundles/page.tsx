"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function BundlesList() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/market/bundles", { cache: "no-store" });
      const j = await r.json();
      setItems(j.items || []);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Bundles</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((b) => (
          <Link
            key={b.id}
            href={`/market/bundles/${b.slug || b.id}`}
            className="rounded-xl border p-4 hover:bg-gray-50"
          >
            <div className="font-medium">{b.title}</div>
            <div className="text-sm opacity-70 line-clamp-2">{b.description}</div>
            <div className="mt-2 text-xs">Products: {b.productIds?.length || 0}</div>
          </Link>
        ))}
        {!items.length && <div className="opacity-70">No bundles available.</div>}
      </div>
    </div>
  );
}
