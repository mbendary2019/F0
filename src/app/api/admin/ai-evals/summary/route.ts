export * from '@/app/api/dynamic';
/**
 * GET /api/admin/ai-evals/summary
 * Returns aggregated AI evaluation metrics (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminFromHeaders } from '@/lib/admin-auth';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication
    await requireAdminFromHeaders(req);

    // Get all evaluation runs (collection group query)
    const snaps = await db.collectionGroup('runs').limit(2000).get();

    const docs = snaps.docs.map((d) => d.data());
    const total = docs.length || 1;

    // Helper function to sum a field
    const sum = (key: string) =>
      docs.reduce((acc: number, doc: any) => acc + (doc?.[key] || 0), 0);

    // Count flagged outputs
    const flagged = docs.filter((doc: any) => doc.flagged === true).length;

    // Count PII leaks
    const piiLeaks = docs.filter((doc: any) => doc.piiLeak === true).length;

    // Calculate averages
    const avgQuality = sum('quality') / total;
    const avgBias = sum('bias') / total;
    const avgToxicity = sum('toxicity') / total;
    const avgLatency = sum('latencyMs') / total;
    const totalCost = sum('costUsd');

    // Count by model
    const modelCounts: Record<string, number> = {};
    docs.forEach((doc: any) => {
      const model = doc.model || 'unknown';
      modelCounts[model] = (modelCounts[model] || 0) + 1;
    });

    const topModels = Object.entries(modelCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([model, count]) => ({ model, count }));

    // Calculate flag rate
    const flagRate = (flagged / total) * 100;

    return NextResponse.json({
      total,
      avgQuality,
      avgBias,
      avgToxicity,
      avgLatency,
      totalCost,
      flagged,
      flagRate,
      piiLeaks,
      topModels,
    });
  } catch (error: any) {
    console.error('Error fetching AI eval summary:', error);

    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch AI eval summary' }, { status: 500 });
  }
}
