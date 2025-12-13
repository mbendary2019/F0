/**
 * GET /api/ops/validate/recent
 *
 * Get recent validation events from telemetry.
 * Shows scores, subscores, model versions, and strategies.
 *
 * Query params:
 * - limit: Number of validations to return (default: 20)
 * - strategy: Filter by strategy (critic, majority, default)
 *
 * Response:
 * {
 *   ok: true,
 *   validations: [
 *     {
 *       id: "doc-id",
 *       ts: 1699123456789,
 *       sessionId: "sess123",
 *       score: 0.68,
 *       subscores: { citation: 0.7, context: 0.8, source: 0.6, relevance: 0.65 },
 *       model_version: "v3d4e_1699123456789+linear",
 *       strategy: "critic",
 *       passed: true
 *     },
 *     ...
 *   ]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const strategyFilter = searchParams.get("strategy");

    // Query recent validations
    let query = db
      .collection("ops_events")
      .where("type", "==", "rag.validate")
      .orderBy("ts", "desc")
      .limit(limit);

    // Add strategy filter if specified
    if (strategyFilter) {
      query = query.where("strategy", "==", strategyFilter);
    }

    const snapshot = await query.get();

    // Map to response format
    const validations = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ts: data.ts || 0,
        sessionId: data.sessionId || "",
        userId: data.userId || "",
        score: Number((data.score || 0).toFixed(3)),
        subscores: {
          citation: Number((data.subscores?.citation || 0).toFixed(3)),
          context: Number((data.subscores?.context || 0).toFixed(3)),
          source: Number((data.subscores?.source || 0).toFixed(3)),
          relevance: Number((data.subscores?.relevance || 0).toFixed(3)),
        },
        model_version: data.model_version || "unknown",
        strategy: data.strategy || "default",
        // Assuming threshold of 0.55 for default (would need to fetch actual threshold)
        passed: data.score >= 0.55,
      };
    });

    return NextResponse.json({
      ok: true,
      validations,
      count: validations.length,
    });
  } catch (error) {
    console.error("[validate/recent] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
