/**
 * GET /api/ops/validate/stats
 *
 * Get statistics about labeled validation samples.
 * Returns total count, pass/fail counts, and breakdown by strategy.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSampleStats } from "@/orchestrator/rag/online_learning";

export async function GET(req: NextRequest) {
  try {
    // Get sample statistics
    const stats = await getSampleStats();

    return NextResponse.json({
      ok: true,
      total: stats.total,
      passed: stats.passed,
      failed: stats.failed,
      passRate: stats.total > 0 ? Number((stats.passed / stats.total).toFixed(3)) : 0,
      byStrategy: stats.byStrategy,
    });
  } catch (error) {
    console.error("[validate/stats] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
