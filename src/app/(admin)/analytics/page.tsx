"use client";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const user = getAuth().currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/analytics/summary", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setStats(json);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="p-6">Loading analytics...</div>;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold mb-6">Analytics Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 border rounded-lg">
          <div className="text-sm opacity-70">Total Orders (24h)</div>
          <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm opacity-70">Total Revenue (24h)</div>
          <div className="text-2xl font-bold">${(stats?.totalRevenue || 0).toFixed(2)}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm opacity-70">Platform Revenue (24h)</div>
          <div className="text-2xl font-bold">${(stats?.platformRevenue || 0).toFixed(2)}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-sm opacity-70">Creator Revenue (24h)</div>
          <div className="text-2xl font-bold">${(stats?.creatorRevenue || 0).toFixed(2)}</div>
        </div>
      </div>

      {stats?.date && (
        <div className="text-sm opacity-70">
          Last updated: {new Date(stats.computedAt).toLocaleString()} (Date: {stats.date})
        </div>
      )}
    </div>
  );
}
