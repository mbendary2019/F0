/**
 * Admin Alerts Management Page
 * Create and manage alert rules
 */

import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { AlertRuleForm } from '@/components/admin/AlertRuleForm';
import { AlertRulesTable } from '@/components/admin/AlertRulesTable';
import Link from 'next/link';

export default async function AlertsPage() {
  await assertAdminReq();

  return (
    <main className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alert Rules</h1>
          <p className="text-gray-600 mt-1">Configure automated alerts for system metrics</p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            href="/admin/dashboard"
          >
            Dashboard
          </Link>
          <Link
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            href="/admin/audit"
          >
            Audit Viewer
          </Link>
        </nav>
      </header>

      {/* Create Form */}
      <AlertRuleForm />

      {/* Rules Table */}
      <AlertRulesTable />

      {/* Info Box */}
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">About Alert Rules</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>
            Alert rules are evaluated every minute. When a metric exceeds the threshold within the specified window,
            an alert is triggered.
          </p>
          <p className="mt-2">
            <strong>Metrics:</strong>
          </p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li><strong>Errors per Minute:</strong> Number of 4xx/5xx responses</li>
            <li><strong>Calls per Minute:</strong> Total API requests</li>
            <li><strong>P95 Latency:</strong> 95th percentile response time in milliseconds</li>
          </ul>
          <p className="mt-2">
            <strong>Actions:</strong>
          </p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li><strong>Slack:</strong> Send notification to configured Slack webhook</li>
            <li><strong>Browser:</strong> Show alert in admin dashboard (coming soon)</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
