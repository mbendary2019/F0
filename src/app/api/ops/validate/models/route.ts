/**
 * GET /api/ops/validate/models
 *
 * List all validation models sorted by timestamp (newest first).
 * Shows model versions, accuracy, thresholds, and training metadata.
 *
 * Query params:
 * - limit: Number of models to return (default: 10)
 *
 * Response:
 * {
 *   ok: true,
 *   models: [
 *     {
 *       version: "v3d4e_1699123456789",
 *       ts: 1699123456789,
 *       weights: { citation: 0.3, context: 0.25, source: 0.2, relevance: 0.25 },
 *       thresholds: { default: 0.55, critic: 0.60, majority: 0.50 },
 *       metrics: { acc: 0.853, samples: 150 },
 *       active: true
 *     },
 *     ...
 *   ]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { listModels, loadLatestModel } from "@/orchestrator/rag/scorerModel";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Get models list
    const models = await listModels(limit);

    // Get current active model
    let activeVersion = "";
    try {
      const latestModel = await loadLatestModel();
      activeVersion = latestModel.version;
    } catch (err) {
      console.warn("[validate/models] Could not load latest model:", err);
    }

    // Add active flag to each model
    const modelsWithActive = models.map((model) => ({
      version: model.version,
      ts: model.ts,
      weights: model.weights,
      thresholds: model.thresholds,
      metrics: model.metrics,
      active: model.version === activeVersion,
    }));

    return NextResponse.json({
      ok: true,
      models: modelsWithActive,
      count: modelsWithActive.length,
    });
  } catch (error) {
    console.error("[validate/models] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
