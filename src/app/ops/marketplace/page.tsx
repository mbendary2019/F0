/**
 * /ops/marketplace - Marketplace for Add-ons & Extensions
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface MarketplaceItem {
  id: string;
  title: string;
  category: string;
  brief: string;
  installScript: string;
  docsUrl?: string;
  verified: boolean;
}

export default function MarketplacePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/marketplace/items')
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setLoading(false);
      });
  }, []);

  const install = async (itemId: string) => {
    if (!user) {
      alert('Please login first');
      return;
    }

    const token = await user.getIdToken();
    const res = await fetch('/api/marketplace/install', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ itemId }),
    });

    if (res.ok) {
      alert('✅ Install requested successfully!');
    } else {
      const error = await res.json();
      alert(`❌ Install failed: ${error.error}`);
    }
  };

  if (loading) {
    return <div className="p-6">Loading marketplace...</div>;
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🛍️ Marketplace</h1>

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No marketplace items available yet
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl p-6 border hover:shadow-lg transition">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-lg">{item.title}</h3>
              {item.verified && <span className="text-blue-500 text-xl">✓</span>}
            </div>

            <div className="text-xs text-gray-600 mb-2">
              {item.category}
            </div>

            <p className="text-sm opacity-70 mb-4">{item.brief}</p>

            {item.docsUrl && (
              <a
                href={item.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline block mb-3"
              >
                📖 Documentation
              </a>
            )}

            <button
              onClick={() => install(item.id)}
              className="w-full px-4 py-2 rounded bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-medium hover:opacity-90"
            >
              Install
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
