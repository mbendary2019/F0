// src/app/api/ops/memory/snippet/feedback/route.ts
// API endpoint for per-snippet feedback
// Phase 57.2: Fine-grained quality signals

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  recordSnippetFeedback,
  recordSnippetFeedbackBatch,
  getSnippetStats,
  type RecordSnippetFeedbackParams,
} from "@/lib/ai/memory/snippetFeedback";
import type { Thumb } from "@/lib/ai/feedback/feedbackSchema";

export const runtime = "nodejs";

// === Types ===

type SnippetFeedbackRequest = {
  snipId: string;
  clusterId?: string;
  turnId?: string;
  thumb?: Thumb;
  stars?: number;
  metadata?: {
    snippet_text?: string;
    context?: string;
    position?: number;
  };
};

type BatchSnippetFeedbackRequest = {
  feedback: SnippetFeedbackRequest[];
};

type SnippetFeedbackResponse =
  | {
      success: true;
      feedbackId: string;
      reward: number;
      confidence: number;
    }
  | {
      success: false;
      error: string;
      code?: string;
    };

// === POST /api/ops/memory/snippet/feedback ===

/**
 * Submit feedback for a snippet
 *
 * @example
 * ```typescript
 * // Thumbs up
 * fetch('/api/ops/memory/snippet/feedback', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     snipId: 'snp_abc123',
 *     clusterId: 'cl_deploy',
 *     thumb: 'up',
 *     metadata: {
 *       snippet_text: 'Deploy to production using Firebase',
 *       position: 2
 *     }
 *   })
 * });
 *
 * // Star rating
 * fetch('/api/ops/memory/snippet/feedback', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     snipId: 'snp_xyz789',
 *     stars: 4,
 *     metadata: { context: 'cluster_detail_drawer' }
 *   })
 * });
 * ```
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<SnippetFeedbackResponse | { success: false; error: string }>> {
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
      console.error(
        "[POST /api/ops/memory/snippet/feedback] Token verification failed:",
        error
      );
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
    let body: SnippetFeedbackRequest | BatchSnippetFeedbackRequest;
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

    // 3) Check if batch request
    if ("feedback" in body) {
      return handleBatchFeedback(userId, body);
    }

    // 4) Validate single feedback request
    const feedbackReq = body as SnippetFeedbackRequest;

    if (!feedbackReq.snipId) {
      return NextResponse.json(
        {
          success: false,
          error: "snipId is required",
          code: "MISSING_SNIP_ID",
        },
        { status: 400 }
      );
    }

    if (!feedbackReq.thumb && !feedbackReq.stars) {
      return NextResponse.json(
        {
          success: false,
          error: "Either thumb or stars feedback is required",
          code: "MISSING_FEEDBACK",
        },
        { status: 400 }
      );
    }

    // Validate thumb value
    if (
      feedbackReq.thumb &&
      !["up", "down"].includes(feedbackReq.thumb)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "thumb must be 'up' or 'down'",
          code: "INVALID_THUMB",
        },
        { status: 400 }
      );
    }

    // Validate stars value
    if (
      feedbackReq.stars !== undefined &&
      (feedbackReq.stars < 1 || feedbackReq.stars > 5)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "stars must be between 1 and 5",
          code: "INVALID_STARS",
        },
        { status: 400 }
      );
    }

    // 5) Record snippet feedback
    console.log(
      `[POST /api/ops/memory/snippet/feedback] Recording feedback for user ${userId}, snippet ${feedbackReq.snipId}`
    );

    const result = await recordSnippetFeedback({
      userId,
      snipId: feedbackReq.snipId,
      clusterId: feedbackReq.clusterId,
      turnId: feedbackReq.turnId,
      thumb: feedbackReq.thumb,
      stars: feedbackReq.stars,
      metadata: feedbackReq.metadata,
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

    // 6) Return success response
    return NextResponse.json(
      {
        success: true,
        feedbackId: result.feedbackId!,
        reward: result.reward!,
        confidence: result.confidence!,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "[POST /api/ops/memory/snippet/feedback] Unexpected error:",
      error
    );
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle batch feedback submission
 */
async function handleBatchFeedback(
  userId: string,
  body: BatchSnippetFeedbackRequest
): Promise<NextResponse> {
  if (!Array.isArray(body.feedback) || body.feedback.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "feedback array is required and must not be empty",
        code: "INVALID_BATCH",
      },
      { status: 400 }
    );
  }

  console.log(
    `[POST /api/ops/memory/snippet/feedback] Batch recording ${body.feedback.length} feedback events for user ${userId}`
  );

  const feedbackParams: RecordSnippetFeedbackParams[] = body.feedback.map(
    (fb) => ({
      userId,
      snipId: fb.snipId,
      clusterId: fb.clusterId,
      turnId: fb.turnId,
      thumb: fb.thumb,
      stars: fb.stars,
      metadata: fb.metadata,
    })
  );

  const results = await recordSnippetFeedbackBatch(feedbackParams);

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json(
    {
      success: true,
      total: body.feedback.length,
      successful,
      failed,
      results: results.map((r) => ({
        success: r.success,
        feedbackId: r.feedbackId,
        reward: r.reward,
        confidence: r.confidence,
        error: r.error,
      })),
    },
    { status: 200 }
  );
}

// === GET /api/ops/memory/snippet/feedback (statistics) ===

/**
 * Get snippet feedback statistics
 *
 * @example
 * ```typescript
 * // Get stats for a snippet
 * fetch('/api/ops/memory/snippet/feedback?snipId=snp_abc123', {
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
    const snipId = searchParams.get("snipId");

    if (!snipId) {
      return NextResponse.json(
        {
          success: false,
          error: "snipId query parameter is required",
          code: "MISSING_SNIP_ID",
        },
        { status: 400 }
      );
    }

    console.log(
      `[GET /api/ops/memory/snippet/feedback] Fetching stats for snippet ${snipId}`
    );

    // 3) Get snippet stats
    const stats = await getSnippetStats(snipId);

    return NextResponse.json(
      {
        success: true,
        snipId,
        stats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "[GET /api/ops/memory/snippet/feedback] Unexpected error:",
      error
    );
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
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
