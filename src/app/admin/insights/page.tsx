/**
 * Admin Insights Page
 * Shows AI-generated insights from anomaly detection
 */

import { assertAdminReq } from '@/lib/admin/assertAdminReq';
import { InsightList } from '@/components/admin/InsightCard';
import { AnomalyTable } from '@/components/admin/AnomalyTable';
import { TuningForm } from '@/components/admin/TuningForm';
import Link from 'next/link';

async function getRecentInsights() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${base}/api/admin/anomaly/insights`, {
      cache: 'no-store',
      headers: { 'x-internal': '1' }
    });
    if (!res.ok) throw new Error('Failed to fetch insights');
    return res.json();
  } catch (err) {
    console.error('[insights page] Error:', err);
    return { insights: [] };
  }
}

export default async function InsightsPage() {
  await assertAdminReq();
  const data = await getRecentInsights();

  return (
    <main className="p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI Insights & Anomaly Detection</h1>
          <p className="text-sm opacity-70 mt-1">
            Automated anomaly detection with AI-powered insights
          </p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href="/admin/dashboard" className="underline">
            Dashboard
          </Link>
          <Link href="/admin/audit" className="underline">
            Audit
          </Link>
          <Link href="/admin/alerts" className="underline">
            Alerts
          </Link>
        </nav>
      </header>

      {/* Recent Insights */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Recent Insights</h2>
        <InsightList insights={data.insights || []} />
      </section>

      {/* Anomaly Events Table */}
      <AnomalyTable />

      {/* Tuning Form */}
      <TuningForm />
    </main>
  );
}

