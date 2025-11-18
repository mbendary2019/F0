/**
 * /ops/branding - Dynamic Branding Settings (Admin Only)
 * Manage colors, logo, mascot, and navigation routes
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface BrandingData {
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  mascot?: {
    name?: string;
    mood?: string;
    svgUrl?: string;
  };
  routes?: Array<{ path: string; label: string; visible: boolean }>;
}

export default function BrandingPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<BrandingData>({
    primaryColor: '#7C3AED',
    accentColor: '#22D3EE',
    logoUrl: '',
    mascot: { name: '', mood: '', svgUrl: '' },
    routes: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/branding')
      .then((r) => r.json())
      .then((data) => {
        setForm({ ...form, ...data });
        setLoading(false);
      });
  }, []);

  const save = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/branding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      alert('✅ Branding saved!');
    } else {
      alert('❌ Save failed');
    }
  };

  const addRoute = () => {
    setForm({
      ...form,
      routes: [...(form.routes || []), { path: '', label: '', visible: true }],
    });
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">🎨 Branding Settings</h1>

      {/* Colors */}
      <section className="space-y-3 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold">Colors</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium">Primary Color</span>
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              className="mt-1 w-full h-10 rounded border"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Accent Color</span>
            <input
              type="color"
              value={form.accentColor}
              onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
              className="mt-1 w-full h-10 rounded border"
            />
          </label>
        </div>
      </section>

      {/* Logo */}
      <section className="space-y-3 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold">Logo</h2>
        <input
          type="text"
          placeholder="Logo URL"
          value={form.logoUrl}
          onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
          className="w-full px-3 py-2 border rounded"
        />
      </section>

      {/* Mascot */}
      <section className="space-y-3 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold">Mascot</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <input
            placeholder="Name"
            value={form.mascot?.name || ''}
            onChange={(e) => setForm({ ...form, mascot: { ...form.mascot, name: e.target.value } })}
            className="px-3 py-2 border rounded"
          />
          <input
            placeholder="Mood"
            value={form.mascot?.mood || ''}
            onChange={(e) => setForm({ ...form, mascot: { ...form.mascot, mood: e.target.value } })}
            className="px-3 py-2 border rounded"
          />
          <input
            placeholder="SVG URL"
            value={form.mascot?.svgUrl || ''}
            onChange={(e) => setForm({ ...form, mascot: { ...form.mascot, svgUrl: e.target.value } })}
            className="px-3 py-2 border rounded"
          />
        </div>
      </section>

      {/* Routes */}
      <section className="space-y-3 p-4 border rounded-lg">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Navigation Routes</h2>
          <button onClick={addRoute} className="px-3 py-1 bg-black text-white rounded text-sm">
            + Add Route
          </button>
        </div>
        <div className="space-y-2">
          {form.routes?.map((route, i) => (
            <div key={i} className="grid md:grid-cols-4 gap-2">
              <input
                placeholder="Path"
                value={route.path}
                onChange={(e) => {
                  const newRoutes = [...(form.routes || [])];
                  newRoutes[i] = { ...route, path: e.target.value };
                  setForm({ ...form, routes: newRoutes });
                }}
                className="px-3 py-2 border rounded"
              />
              <input
                placeholder="Label"
                value={route.label}
                onChange={(e) => {
                  const newRoutes = [...(form.routes || [])];
                  newRoutes[i] = { ...route, label: e.target.value };
                  setForm({ ...form, routes: newRoutes });
                }}
                className="px-3 py-2 border rounded"
              />
              <label className="flex items-center px-3 gap-2">
                <input
                  type="checkbox"
                  checked={route.visible}
                  onChange={(e) => {
                    const newRoutes = [...(form.routes || [])];
                    newRoutes[i] = { ...route, visible: e.target.checked };
                    setForm({ ...form, routes: newRoutes });
                  }}
                />
                <span className="text-sm">Visible</span>
              </label>
            </div>
          ))}
        </div>
      </section>

      <button onClick={save} className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800">
        💾 Save Branding
      </button>
    </main>
  );
}
