/**
 * GET /api/ops/validate/uncertain
 *
 * Get validation samples that are uncertain and should be reviewed/labeled.
 * Uses confidence bands (0.45-0.60) and low confidence threshold (< 0.7).
 *
 * Query params:
 * - limit: Number of samples to return (default: 10)
 * - sort: Sort order - "uncertainty" (default) or "recent"
 *
 * Response:
 * {
 *   ok: true,
 *   samples: [
 *     {
 *       id: "doc-id",
 *       ts: 1699123456789,
 *       sessionId: "sess123",
 *       score: 0.52,
 *       confidence: 0.65,
 *       uncertainty: 0.78,
 *       subscores: { ... },
 *       model_version: "v3d4e+linear",
 *       strategy: "critic",
 *       needsReview: true
 *     },
 *     ...
 *   ]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { isUncertain, getUncertaintyScore, suggestSamplesForLabeling } from "@/orchestrator/rag/activeLabeling";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const sortBy = searchParams.get("sort") || "uncertainty";

    // Query recent validations
    // Note: In production, we'd store confidence in the event
    // For now, we'll query recent events and filter client-side
    const snapshot = await db
      .collection("ops_events")
      .where("type", "==", "rag.validate")
      .orderBy("ts", "desc")
      .limit(100) // Query more to find uncertain ones
      .get();

    // Map to samples with uncertainty calculation
    const allSamples = snapshot.docs.map((doc) => {
      const data = doc.data();
      const score = data.score || 0;

      // TODO: Store confidence in events
      // For now, estimate confidence from score variance
      const confidence = estimateConfidence(score);

      return {
        id: doc.id,
        ts: data.ts || 0,
        sessionId: data.sessionId || "",
        userId: data.userId || "",
        score: Number(score.toFixed(3)),
        confidence: Number(confidence.toFixed(3)),
        subscores: {
          citation: Number((data.subscores?.citation || 0).toFixed(3)),
          context: Number((data.subscores?.context || 0).toFixed(3)),
          source: Number((data.subscores?.source || 0).toFixed(3)),
          relevance: Number((data.subscores?.relevance || 0).toFixed(3)),
        },
        model_version: data.model_version || "unknown",
        strategy: data.strategy || "default",
      };
    });

    // Filter uncertain samples
    const uncertainSamples = allSamples.filter((sample) =>
      isUncertain(sample.score, sample.confidence)
    );

    // Add uncertainty scores and sort
    const samplesWithUncertainty = suggestSamplesForLabeling(
      uncertainSamples,
      limit,
      0.55 // Default threshold
    );

    // Map to response format
    const samples = samplesWithUncertainty.map((sample) => ({
      ...sample,
      needsReview: true,
    }));

    return NextResponse.json({
      ok: true,
      samples,
      count: samples.length,
      totalUncertain: uncertainSamples.length,
    });
  } catch (error) {
    console.error("[validate/uncertain] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * Estimate confidence from score
 *
 * Temporary helper until we store confidence in events.
 * Scores near decision boundary (0.55) get lower confidence.
 */
function estimateConfidence(score: number, threshold: number = 0.55): number {
  // Distance from threshold (0 = at threshold, 0.5 = max distance)
  const distance = Math.abs(score - threshold);

  // Map to confidence (0.5-1.0 range)
  // Far from threshold = high confidence
  // Near threshold = low confidence
  const confidence = 0.5 + distance;

  return Math.min(1.0, confidence);
}
