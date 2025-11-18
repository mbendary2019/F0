"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import CurrencySwitcher, { useCurrency } from "../_components/CurrencySwitcher";

export default function MarketPage() {
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [prices, setPrices] = useState<Record<string, number>>({});
  const { currency, symbol } = useCurrency();

  const search = async (q: string) => {
    const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const json = await res.json();
    setItems(json.products || []);
    await convertPrices(json.products || []);
  };

  const convertPrices = async (products: any[]) => {
    if (currency === "USD") {
      const priceMap: Record<string, number> = {};
      products.forEach(p => priceMap[p.id] = p.priceUsd);
      setPrices(priceMap);
      return;
    }

    const priceMap: Record<string, number> = {};
    for (const p of products) {
      try {
        const res = await fetch("/api/market/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseUsd: p.priceUsd, currency })
        });
        const data = await res.json();
        priceMap[p.id] = data.converted || p.priceUsd;
      } catch (err) {
        priceMap[p.id] = p.priceUsd;
      }
    }
    setPrices(priceMap);
  };

  useEffect(() => {
    fetch("/api/market/products", { cache: "no-store" })
      .then(r=>r.json())
      .then(async j => {
        const products = j.items || [];
        setItems(products);
        await convertPrices(products);
      });
  }, [currency]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Marketplace</h1>
        <CurrencySwitcher />
      </div>
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search products..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search(query)}
          className="w-full md:w-96 px-4 py-2 border rounded-lg"
        />
        <button
          onClick={() => search(query)}
          className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Search
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map(p=>(
          <Link key={p.id} href={`/market/${p.slug}`} className="rounded-xl border p-4 hover:bg-gray-50">
            <div className="text-lg font-medium">{p.title}</div>
            <div className="text-sm opacity-70 mt-1">{p.description?.slice(0,120)}</div>
            <div className="mt-2 font-semibold">
              {symbol}{prices[p.id]?.toFixed(2) || p.priceUsd}
            </div>
            <div className="text-xs opacity-60 mt-1">Est. tax at checkout</div>
          </Link>
        ))}
        {!items.length && <div className="opacity-70">No products found.</div>}
      </div>
    </div>
  );
}
