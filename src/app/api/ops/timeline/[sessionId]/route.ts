/**
 * GET /api/ops/timeline/[sessionId]
 *
 * Get detailed session summary with all events and statistics.
 * Returns a complete timeline for a single session with aggregated metrics.
 *
 * Path params:
 * - sessionId: Session identifier
 *
 * Response:
 * {
 *   sessionId: string,
 *   userId?: string,
 *   startedAt?: number,
 *   endedAt?: number,
 *   durationMs?: number,
 *   events: TimelineItem[],
 *   stats: {
 *     validations: {
 *       count: number,
 *       avgScore?: number,
 *       byModel?: Record<string, number>,
 *       byStrategy?: Record<string, number>,
 *       passed?: number,
 *       failed?: number
 *     },
 *     citations?: {
 *       total?: number,
 *       average?: number
 *     },
 *     retrievals?: {
 *       count: number,
 *       avgMs?: number
 *     }
 *   }
 * }
 *
 * Examples:
 * - GET /api/ops/timeline/abc123
 * - GET /api/ops/timeline/sess_20231105_123456
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { buildSessionSummaryVM } from "@/orchestrator/ops/timeline/viewmodel";
import type { AnyEvent } from "@/orchestrator/ops/timeline/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    // Query all events for this session
    const snap = await db
      .collection("ops_events")
      .where("sessionId", "==", sessionId)
      .orderBy("ts", "asc")
      .limit(1000) // Reasonable limit per session
      .get();

    if (snap.empty) {
      return NextResponse.json(
        { error: `No events found for session: ${sessionId}` },
        { status: 404 }
      );
    }

    // Transform to view model
    const docs = snap.docs.map((d) => ({
      id: d.id,
      data: d.data() as AnyEvent,
    }));

    const summary = buildSessionSummaryVM(docs);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[timeline/sessionId] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
