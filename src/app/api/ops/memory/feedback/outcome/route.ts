// src/app/api/ops/memory/feedback/outcome/route.ts
// API endpoint for submitting implicit outcome feedback
// Phase 57.1: Task success/failure signals

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  submitOutcome,
  submitOutcomeBatch,
  type Outcome,
} from "@/lib/ai/feedback/outcomeSignals";

export const runtime = "nodejs";

// === Types ===

type OutcomeRequest = {
  clusterId: string;
  outcome: Outcome;
  turnId?: string;
  taskId?: string;
  metadata?: {
    taskType?: string;
    duration?: number;
    errorMessage?: string;
    context?: string;
    [key: string]: unknown;
  };
};

type BatchOutcomeRequest = {
  outcomes: OutcomeRequest[];
};

type OutcomeResponse =
  | {
      success: true;
      feedbackId: string;
      reward: number;
      confidence: number;
      outcome: Outcome;
    }
  | {
      success: false;
      error: string;
      code?: string;
    };

// === POST /api/ops/memory/feedback/outcome ===

/**
 * Submit implicit outcome feedback for a cluster
 *
 * @example
 * ```typescript
 * // Success outcome
 * fetch('/api/ops/memory/feedback/outcome', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     clusterId: 'cl_deploy_guide',
 *     outcome: 'success',
 *     taskId: 'deploy_prod_123',
 *     metadata: {
 *       taskType: 'deploy',
 *       duration: 45000
 *     }
 *   })
 * });
 *
 * // Failure outcome
 * fetch('/api/ops/memory/feedback/outcome', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': `Bearer ${idToken}`
 *   },
 *   body: JSON.stringify({
 *     clusterId: 'cl_test_setup',
 *     outcome: 'failure',
 *     taskId: 'test_run_456',
 *     metadata: {
 *       taskType: 'test',
 *       errorMessage: 'Connection timeout'
 *     }
 *   })
 * });
 * ```
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<OutcomeResponse | { success: false; error: string }>> {
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
        "[POST /api/ops/memory/feedback/outcome] Token verification failed:",
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
    let body: OutcomeRequest | BatchOutcomeRequest;
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
    if ("outcomes" in body) {
      return handleBatchOutcome(userId, body);
    }

    // 4) Validate single outcome request
    const outcomeReq = body as OutcomeRequest;

    if (!outcomeReq.clusterId) {
      return NextResponse.json(
        {
          success: false,
          error: "clusterId is required",
          code: "MISSING_CLUSTER_ID",
        },
        { status: 400 }
      );
    }

    if (!outcomeReq.outcome) {
      return NextResponse.json(
        {
          success: false,
          error: "outcome is required",
          code: "MISSING_OUTCOME",
        },
        { status: 400 }
      );
    }

    // Validate outcome value
    const validOutcomes: Outcome[] = ["success", "failure", "rollback", "partial", "timeout"];
    if (!validOutcomes.includes(outcomeReq.outcome)) {
      return NextResponse.json(
        {
          success: false,
          error: `outcome must be one of: ${validOutcomes.join(", ")}`,
          code: "INVALID_OUTCOME",
        },
        { status: 400 }
      );
    }

    // 5) Submit outcome feedback
    console.log(
      `[POST /api/ops/memory/feedback/outcome] Submitting outcome for user ${userId}, cluster ${outcomeReq.clusterId}, outcome: ${outcomeReq.outcome}`
    );

    const result = await submitOutcome({
      userId,
      clusterId: outcomeReq.clusterId,
      outcome: outcomeReq.outcome,
      turnId: outcomeReq.turnId,
      taskId: outcomeReq.taskId,
      metadata: outcomeReq.metadata,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to submit outcome",
          code: "SUBMIT_FAILED",
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
        outcome: result.outcome!,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/ops/memory/feedback/outcome] Unexpected error:", error);
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

/**
 * Handle batch outcome submission
 */
async function handleBatchOutcome(
  userId: string,
  body: BatchOutcomeRequest
): Promise<NextResponse> {
  if (!Array.isArray(body.outcomes) || body.outcomes.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "outcomes array is required and must not be empty",
        code: "INVALID_BATCH",
      },
      { status: 400 }
    );
  }

  console.log(
    `[POST /api/ops/memory/feedback/outcome] Batch submitting ${body.outcomes.length} outcomes for user ${userId}`
  );

  const results = await submitOutcomeBatch(
    body.outcomes.map((outcome) => ({
      userId,
      clusterId: outcome.clusterId,
      outcome: outcome.outcome,
      turnId: outcome.turnId,
      taskId: outcome.taskId,
      metadata: outcome.metadata,
    }))
  );

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json(
    {
      success: true,
      total: body.outcomes.length,
      successful,
      failed,
      results: results.map((r) => ({
        success: r.success,
        feedbackId: r.feedbackId,
        reward: r.reward,
        confidence: r.confidence,
        outcome: r.outcome,
        error: r.error,
      })),
    },
    { status: 200 }
  );
}

// === GET /api/ops/memory/feedback/outcome (statistics) ===

/**
 * Get outcome statistics for authenticated user
 *
 * @example
 * ```typescript
 * // Get outcome stats
 * fetch('/api/ops/memory/feedback/outcome?clusterId=cl_deploy_guide', {
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

    console.log(
      `[GET /api/ops/memory/feedback/outcome] Fetching outcome stats for user ${userId}, cluster ${clusterId || "all"}`
    );

    // 3) TODO: Implement getOutcomeStats query
    // This would require importing getFeedbackForUser/getFeedbackForCluster
    // and filtering by metadata.implicit_signal = true

    return NextResponse.json(
      {
        success: true,
        message: "Outcome statistics endpoint - coming soon",
        userId,
        clusterId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[GET /api/ops/memory/feedback/outcome] Unexpected error:", error);
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
