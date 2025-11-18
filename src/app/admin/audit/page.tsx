/**
 * Admin Audit Viewer Page
 * Filter and export audit logs
 */

import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { AuditTable } from '@/components/admin/AuditTable';
import Link from 'next/link';

export default async function AuditPage() {
  // Ensure admin authentication
  await assertAdminReq();

  return (
    <main className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Audit Viewer</h1>
          <p className="text-gray-600 mt-1">View and filter admin activity logs</p>
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
            href="/admin"
          >
            Admin Control
          </Link>
        </nav>
      </header>

      {/* Audit Table */}
      <AuditTable />

      {/* Info Box */}
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">About Audit Logs</h3>
        <p className="text-sm text-blue-800">
          All admin actions are automatically logged with timestamp, actor, target, IP address, and user agent. 
          Use the filters above to search for specific events or export the data for compliance reporting.
        </p>
      </section>
    </main>
  );
}

