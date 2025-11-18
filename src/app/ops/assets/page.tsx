/**
 * /ops/assets - Figma Assets Browser
 */

'use client';

import { useEffect, useState } from 'react';

interface Asset {
  id: string;
  source: string;
  fileId: string;
  nodeId: string;
  name: string;
  type: string;
  url: string;
  updatedAt: any;
}

export default function AssetsPage() {
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/integrations/figma/files')
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-6">Loading assets...</div>;
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🎨 Design Assets (Figma)</h1>

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No assets found. Configure FIGMA_TOKEN and FIGMA_FILE_IDS to sync.
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        {items.map((asset) => (
          <a
            key={asset.id}
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl p-4 border hover:shadow-lg transition"
          >
            <div className="font-medium text-sm mb-2">{asset.name}</div>
            <div className="text-xs text-gray-600 mb-1">{asset.type}</div>
            <div className="text-xs text-gray-400 font-mono">{asset.fileId.substring(0, 8)}...</div>
          </a>
        ))}
      </div>
    </main>
  );
}
