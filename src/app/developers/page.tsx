'use client';

import { useEffect, useState } from 'react';

export default function DevelopersPortal() {
  const [tab, setTab] = useState('keys');

  return (
    <div className="p-6 mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Developer Portal</h1>
        <p className="text-sm text-gray-600">Manage API keys, usage, and webhooks</p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {['keys', 'usage', 'webhooks', 'console', 'billing'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded ${tab === t ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="border rounded p-6">
        <h2 className="text-xl mb-4">Tab: {tab}</h2>
        <p>Content for {tab} tab will go here.</p>
      </div>
    </div>
  );
}
