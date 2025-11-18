/**
 * GET /api/ops/validate/metrics
 *
 * Get detailed metrics about validation samples and active learning.
 * Shows labeling progress, uncertainty statistics, and strategy breakdown.
 *
 * Response:
 * {
 *   ok: true,
 *   samples: {
 *     total: 150,
 *     labeled: 150,
 *     unlabeled: 0,
 *     uncertain: 23,
 *     lowConfidence: 18
 *   },
 *   strategies: {
 *     critic: { passed: 42, failed: 35, passRate: 0.545 },
 *     majority: { passed: 30, failed: 18, passRate: 0.625 },
 *     default: { passed: 17, failed: 8, passRate: 0.680 }
 *   },
 *   activeLearning: {
 *     labelingRate: 0.153,
 *     canCalibrate: true,
 *     recommendedStrategy: "critic"
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSampleStats } from "@/orchestrator/rag/online_learning";
import { getActiveLearningMetrics, recommendStrategyToLabel } from "@/orchestrator/rag/activeLabeling";
import { db } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    // Get sample statistics
    const stats = await getSampleStats();

    // Calculate strategy metrics
    const strategies: Record<string, { passed: number; failed: number; passRate: number }> = {};

    for (const [strategy, counts] of Object.entries(stats.byStrategy)) {
      const passed = counts.passed || 0;
      const failed = counts.failed || 0;
      const total = passed + failed;
      const passRate = total > 0 ? Number((passed / total).toFixed(3)) : 0;

      strategies[strategy] = {
        passed,
        failed,
        passRate,
      };
    }

    // Get recent validations to calculate active learning metrics
    const validationsSnap = await db
      .collection("ops_events")
      .where("type", "==", "rag.validate")
      .orderBy("ts", "desc")
      .limit(100)
      .get();

    const recentValidations = validationsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        score: data.score || 0,
        confidence: 1.0, // TODO: Store confidence in events
      };
    });

    // Calculate active learning metrics
    const alMetrics = getActiveLearningMetrics(
      recentValidations,
      Array(stats.total).fill(null) // All samples are labeled
    );

    // Recommend strategy to focus on
    const labeledByStrategy: Record<string, number> = {};
    for (const [strategy, counts] of Object.entries(stats.byStrategy)) {
      labeledByStrategy[strategy] = (counts.passed || 0) + (counts.failed || 0);
    }
    const recommendedStrategy = recommendStrategyToLabel(labeledByStrategy);

    return NextResponse.json({
      ok: true,
      samples: {
        total: stats.total,
        labeled: stats.total,
        unlabeled: 0,
        uncertain: alMetrics.uncertain,
        lowConfidence: alMetrics.lowConfidence,
      },
      strategies,
      activeLearning: {
        labelingRate: alMetrics.labelingRate,
        canCalibrate: alMetrics.canCalibrate,
        recommendedStrategy,
      },
    });
  } catch (error) {
    console.error("[validate/metrics] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
