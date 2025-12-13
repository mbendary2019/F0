/**
 * GET /api/ops/timeline
 *
 * List timeline events with filters and pagination.
 * Consumes ops_events collection and returns normalized timeline items.
 *
 * Query params:
 * - from: Start timestamp (unix ms)
 * - to: End timestamp (unix ms)
 * - sessionId: Filter by session ID
 * - strategy: Filter by strategy (for rag.validate events)
 * - type: Filter by event type
 * - limit: Max items to return (default: 200, max: 500)
 * - cursor: Document ID for pagination
 *
 * Response:
 * {
 *   items: TimelineItem[],
 *   nextCursor: string | null,
 *   count: number
 * }
 *
 * Examples:
 * - GET /api/ops/timeline?limit=50
 * - GET /api/ops/timeline?sessionId=abc123
 * - GET /api/ops/timeline?from=1699123456789&to=1699209856789
 * - GET /api/ops/timeline?strategy=critic&limit=100
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { buildTimelineVM, buildPaginatedResponse } from "@/orchestrator/ops/timeline/viewmodel";
import type { AnyEvent } from "@/orchestrator/ops/timeline/types";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const sessionId = searchParams.get("sessionId");
    const strategy = searchParams.get("strategy");
    const type = searchParams.get("type");
    const limit = searchParams.get("limit");
    const cursor = searchParams.get("cursor");

    // Build Firestore query
    let query: FirebaseFirestore.Query = db
      .collection("ops_events")
      .orderBy("ts", "desc");

    // Apply filters
    if (from) {
      query = query.where("ts", ">=", Number(from));
    }

    if (to) {
      query = query.where("ts", "<=", Number(to));
    }

    if (sessionId) {
      query = query.where("sessionId", "==", sessionId);
    }

    if (strategy) {
      // Strategy filter (for rag.validate events)
      query = query.where("strategy", "==", strategy);
    }

    if (type) {
      // Type filter
      query = query.where("type", "==", type);
    }

    // Apply limit (default 200, max 500)
    const lim = Math.min(Number(limit || 200), 500);

    // Apply cursor for pagination
    if (cursor) {
      const curDoc = await db.collection("ops_events").doc(cursor).get();
      if (curDoc.exists) {
        query = query.startAfter(curDoc);
      }
    }

    // Execute query
    const snap = await query.limit(lim).get();

    // Transform to view model
    const docs = snap.docs.map((d) => ({
      id: d.id,
      data: d.data() as AnyEvent,
    }));

    const items = buildTimelineVM(docs);

    // Get next cursor (last document ID)
    const nextCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1].id : null;

    // Build response
    const response = buildPaginatedResponse(items, nextCursor);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[timeline] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
