/**
 * Admin Dashboard Page
 * Displays metrics, charts, and system overview
 */

import { AdminAreaChart } from '@/components/admin/AdminAreaChart';
import { AdminStatCard } from '@/components/admin/AdminStatCard';
import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import Link from 'next/link';

async function getSummary() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  try {
    const res = await fetch(`${baseUrl}/api/admin/metrics/summary`, { 
      cache: 'no-store',
      headers: { 
        'x-internal': '1',
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) {
      console.error('Failed to fetch summary:', res.status, res.statusText);
      throw new Error('Failed to fetch summary');
    }
    
    return res.json();
  } catch (error) {
    console.error('Error fetching summary:', error);
    // Return placeholder data on error
    return {
      totals: { calls24h: 0, errors24h: 0, p95: 0 },
      timeseries: []
    };
  }
}

export default async function AdminDashboardPage() {
  // Ensure admin authentication
  await assertAdminReq();
  
  const data = await getSummary();
  const { totals, timeseries } = data;

  return (
    <main className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">System metrics and observability</p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link 
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium" 
            href="/admin/audit"
          >
            Audit Viewer
          </Link>
          <Link 
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium" 
            href="/admin"
          >
            Admin Control
          </Link>
        </nav>
      </header>

      {/* Stats Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminStatCard 
          label="API Calls (24h)" 
          value={totals.calls24h.toLocaleString()} 
          hint="All endpoints in last 24 hours" 
        />
        <AdminStatCard 
          label="Errors (24h)" 
          value={totals.errors24h.toLocaleString()} 
          hint="4xx + 5xx responses" 
        />
        <AdminStatCard 
          label="p95 Latency" 
          value={`${totals.p95}ms`} 
          hint="95th percentile response time" 
        />
      </section>

      {/* Charts */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">API Activity</h2>
            <p className="text-sm text-gray-600 mt-1">Calls and errors over the last 7 days</p>
          </div>
        </div>
        {timeseries.length > 0 ? (
          <AdminAreaChart data={timeseries} />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No data available yet. Metrics will appear after system usage.
          </div>
        )}
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">System Health</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-green-600">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Error Rate</span>
              <span className="text-sm font-medium text-gray-900">
                {totals.calls24h > 0 
                  ? ((totals.errors24h / totals.calls24h) * 100).toFixed(2)
                  : '0.00'}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Success Rate</span>
              <span className="text-sm font-medium text-gray-900">
                {totals.calls24h > 0 
                  ? (100 - (totals.errors24h / totals.calls24h) * 100).toFixed(2)
                  : '100.00'}%
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Link 
              href="/admin/audit" 
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              → View Audit Logs
            </Link>
            <Link 
              href="/admin" 
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              → Manage Admins
            </Link>
            <a 
              href="/api/admin/audit/export" 
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              download
            >
              → Export Audit CSV
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

