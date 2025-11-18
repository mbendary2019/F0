// src/app/api/ops/memory/feedback/route.ts
// API endpoint for submitting cluster feedback

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { recordFeedback } from "@/lib/ai/feedback/recordFeedback";
import { updateClusterWeight } from "@/lib/ai/feedback/updateClusterWeights";
import type { Thumb } from "@/lib/ai/feedback/feedbackSchema";

// === Request/Response Types ===

type FeedbackRequest = {
  clusterId: string;
  feedback: {
    thumb?: Thumb;
    stars?: number;
  };
  turnId?: string;
  metadata?: {
    session_id?: string;
    query?: string;
    context?: string;
  };
  autoUpdateWeight?: boolean; // If true, update cluster weight immediately
};

type FeedbackResponse =
  | {
      success: true;
      feedbackId: string;
      reward: number;
      confidence: number;
      weightUpdated?: boolean;
      newWeight?: number;
    }
  | {
      success: false;
      error: string;
      code?: string;
    };

// === POST /api/ops/memory/feedback ===

/**
 * Submit feedback for a memory cluster
 *
 * @example
 * ```typescript
 * // Thumbs up
 * fetch('/api/ops/memory/feedback', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     clusterId: 'cl_abc123',
 *     feedback: { thumb: 'up' },
 *     autoUpdateWeight: true
 *   })
 * });
 *
 * // Star rating
 * fetch('/api/ops/memory/feedback', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     clusterId: 'cl_abc123',
 *     feedback: { stars: 4 },
 *     turnId: 'turn_456',
 *     metadata: { query: 'How do I deploy?' }
 *   })
 * });
 * ```
 */
export async function POST(req: NextRequest): Promise<NextResponse<FeedbackResponse>> {
  try {
    // 1) Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid authorization header",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    let decodedToken;

    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error("[POST /api/ops/memory/feedback] Token verification failed:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired authentication token",
          code: "AUTH_INVALID",
        },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // 2) Parse request body
    let body: FeedbackRequest;
    try {
      body = await req.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON body",
          code: "INVALID_JSON",
        },
        { status: 400 }
      );
    }

    // 3) Validate required fields
    if (!body.clusterId) {
      return NextResponse.json(
        {
          success: false,
          error: "clusterId is required",
          code: "MISSING_CLUSTER_ID",
        },
        { status: 400 }
      );
    }

    if (!body.feedback || (!body.feedback.thumb && !body.feedback.stars)) {
      return NextResponse.json(
        {
          success: false,
          error: "feedback.thumb or feedback.stars is required",
          code: "MISSING_FEEDBACK",
        },
        { status: 400 }
      );
    }

    // Validate thumb value
    if (body.feedback.thumb && !["up", "down"].includes(body.feedback.thumb)) {
      return NextResponse.json(
        {
          success: false,
          error: "feedback.thumb must be 'up' or 'down'",
          code: "INVALID_THUMB",
        },
        { status: 400 }
      );
    }

    // Validate stars value
    if (
      body.feedback.stars !== undefined &&
      (body.feedback.stars < 1 || body.feedback.stars > 5)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "feedback.stars must be between 1 and 5",
          code: "INVALID_STARS",
        },
        { status: 400 }
      );
    }

    // 4) Record feedback
    console.log(
      `[POST /api/ops/memory/feedback] Recording feedback for user ${userId}, cluster ${body.clusterId}`
    );

    const result = await recordFeedback({
      userId,
      clusterId: body.clusterId,
      feedback: body.feedback,
      turnId: body.turnId,
      metadata: body.metadata,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to record feedback",
          code: "RECORD_FAILED",
        },
        { status: 500 }
      );
    }

    // 5) Optionally update cluster weight immediately
    let weightUpdated = false;
    let newWeight: number | undefined;

    if (body.autoUpdateWeight) {
      console.log(
        `[POST /api/ops/memory/feedback] Auto-updating weight for cluster ${body.clusterId}`
      );

      const weightResult = await updateClusterWeight(body.clusterId);

      if (weightResult.success) {
        weightUpdated = true;
        newWeight = weightResult.weight;
      } else {
        console.warn(
          `[POST /api/ops/memory/feedback] Failed to update weight: ${weightResult.error}`
        );
        // Don't fail the request, just log the warning
      }
    }

    // 6) Return success response
    return NextResponse.json(
      {
        success: true,
        feedbackId: result.feedbackId!,
        reward: result.reward!,
        confidence: result.confidence!,
        ...(weightUpdated && { weightUpdated, newWeight }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/ops/memory/feedback] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

// === GET /api/ops/memory/feedback (optional: query feedback history) ===

type FeedbackHistoryRequest = {
  clusterId?: string;
  limit?: number;
};

/**
 * Get feedback history for authenticated user
 *
 * @example
 * ```typescript
 * // Get all feedback for a cluster
 * fetch('/api/ops/memory/feedback?clusterId=cl_abc123', {
 *   headers: { 'Authorization': `Bearer ${idToken}` }
 * });
 *
 * // Get recent feedback for user
 * fetch('/api/ops/memory/feedback?limit=20', {
 *   headers: { 'Authorization': `Bearer ${idToken}` }
 * });
 * ```
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // 1) Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid authorization header",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    let decodedToken;

    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired authentication token",
          code: "AUTH_INVALID",
        },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // 2) Parse query parameters
    const { searchParams } = new URL(req.url);
    const clusterId = searchParams.get("clusterId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // 3) Fetch feedback (implementation depends on requirements)
    // For now, return a placeholder response
    console.log(
      `[GET /api/ops/memory/feedback] Fetching feedback for user ${userId}, cluster ${clusterId || "all"}`
    );

    // TODO: Implement getFeedbackForUser or getFeedbackForCluster
    // This would require importing from recordFeedback.ts

    return NextResponse.json(
      {
        success: true,
        feedback: [],
        message: "Feedback history endpoint - coming soon",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/ops/memory/feedback] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

// === OPTIONS (CORS preflight) ===

export async function OPTIONS(req: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
