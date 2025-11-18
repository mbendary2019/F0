/**
 * POST /api/ops/validate/calibrate
 *
 * Calibrate a new validation model based on labeled samples.
 * Trains weights and optimizes thresholds, then saves new model version.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { loadLatestModel, saveModel, type ModelDoc } from "@/orchestrator/rag/scorerModel";
import { calibrateModel } from "@/orchestrator/rag/calibrator";
import { getSampleStats } from "@/orchestrator/rag/online_learning";

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let userId: string;

    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      userId = decodedToken.uid;
    } catch (authError) {
      console.error("[validate/calibrate] auth error:", authError);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // TODO: Add RBAC check for admin/ops role
    // For now, allow all authenticated users

    // Parse options
    const body = await req.json().catch(() => ({}));
    const { targetAcc, epochs, notes } = body;

    console.log("[validate/calibrate] Starting calibration...");

    // Get sample statistics
    const stats = await getSampleStats();
    console.log(`[validate/calibrate] Sample stats:`, stats);

    if (stats.total < 50) {
      return NextResponse.json(
        {
          error: "Insufficient samples for calibration",
          required: 50,
          available: stats.total,
        },
        { status: 400 }
      );
    }

    // Load base model
    const baseModel = await loadLatestModel();
    console.log(`[validate/calibrate] Base model: ${baseModel.version}`);

    // Calibrate new model
    const startTime = Date.now();
    const calibrationResult = await calibrateModel(
      {
        weights: baseModel.weights,
        thresholds: baseModel.thresholds,
      },
      {
        targetAcc: targetAcc ?? 0.78,
        epochs: epochs ?? 4,
        minSamples: 50,
      }
    );

    const calibrationTime = Date.now() - startTime;

    // Generate new version
    const version = `v${Math.random().toString(36).slice(2, 6)}_${Date.now()}`;

    // Create new model document
    const newModel: ModelDoc = {
      version,
      ts: Date.now(),
      weights: calibrationResult.weights,
      thresholds: calibrationResult.thresholds,
      metrics: {
        acc: calibrationResult.metrics.acc,
        auc: calibrationResult.metrics.precision, // Using precision as proxy for AUC
      },
      notes: notes || `Auto-calibrated from ${stats.total} samples in ${calibrationTime}ms`,
    };

    // Save new model
    await saveModel(newModel);

    console.log(
      `[validate/calibrate] Calibration complete: ${version} (acc=${calibrationResult.metrics.acc.toFixed(3)})`
    );

    return NextResponse.json({
      ok: true,
      version,
      weights: newModel.weights,
      thresholds: newModel.thresholds,
      metrics: {
        accuracy: calibrationResult.metrics.acc,
        precision: calibrationResult.metrics.precision,
        recall: calibrationResult.metrics.recall,
        samples: calibrationResult.metrics.samples,
      },
      calibrationTimeMs: calibrationTime,
      baseModel: baseModel.version,
      sampleStats: stats,
    });
  } catch (error) {
    console.error("[validate/calibrate] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
