import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { ContextHandle } from "@/lib/types/context";
import type { AgentMessage } from "@/lib/types/agent";
import { PlannerAgent } from "@/orchestrator/agents/roles/plannerAgent";
import { ResearcherAgent } from "@/orchestrator/agents/roles/researcherAgent";
import { SynthesizerAgent } from "@/orchestrator/agents/roles/synthesizerAgent";
import { CriticAgent } from "@/orchestrator/agents/roles/criticAgent";
import { ValidatorAgent } from "@/orchestrator/agents/roles/validatorAgent";
import { runMesh } from "@/orchestrator/mesh/router";
import type { MeshRoute } from "@/orchestrator/mesh/protocol";
import { validateConsensus } from "@/orchestrator/rag/consensus";
import { logEvent } from "@/lib/telemetry/log";
import { ensureUser, ensureFeature, ensureQuota } from "@/lib/security/rbac";

/**
 * POST /api/mesh/execute
 * Execute a new cognitive mesh task
 */
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
      console.error("[mesh/execute] auth error:", authError);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // RBAC: Ensure user exists
    await ensureUser(userId);

    // RBAC: Ensure feature is enabled
    await ensureFeature(userId, "feature.mesh_rag");

    // RBAC: Ensure quota not exceeded
    await ensureQuota(userId, { key: "mesh.execute", dailyLimit: 200 });

    // Parse request
    const body = await req.json();
    const { goal, hints, clusterIds, strategy = "critic" } = body;

    if (!goal || typeof goal !== "string") {
      return NextResponse.json({ error: "goal is required" }, { status: 400 });
    }

    // Create session
    const sessionId = `mesh_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();

    // Telemetry: Log mesh start
    await logEvent({
      type: "mesh.start",
      ts: startTime,
      sessionId,
      userId,
      goal,
    });

    // Build context
    const ctx: ContextHandle = {
      userId,
      sessionId,
      goal,
      hints: hints ?? [],
      clusterIds: clusterIds ?? [],
      limits: {
        tokens: 4000,
        latencyMs: 30000,
      },
    };

    // Initialize agents (including validator for Phase 61)
    const agents = {
      planner: new PlannerAgent(),
      researcher: new ResearcherAgent(),
      synthesizer: new SynthesizerAgent(),
      critic: new CriticAgent(),
      validator: new ValidatorAgent(),
    };

    // Build mesh route (maxHops increased to 7 to accommodate validator)
    const route: MeshRoute = {
      from: "planner",
      to: ["researcher"],
      policy: {
        strategy,
        maxHops: 7,
        timeout: 30000,
      },
    };

    // Entry message
    const entry: AgentMessage = {
      type: "TASK",
      content: goal,
      from: "user",
      to: ["planner"],
    };

    // Run mesh
    console.log(`[mesh/execute] starting mesh for user=${userId} goal="${goal}"`);
    const result = await runMesh(agents, entry, route, ctx);

    // Validate consensus
    const consensus = await validateConsensus(result.trace, strategy, ctx);

    // Calculate metrics
    const totalMs = Date.now() - startTime;
    const citationsCount = result.final.evidence?.length ?? 0;
    const tokensUsed = result.trace.reduce((sum, msg) => sum + (msg.content?.length ?? 0), 0);

    // Store session in Firestore
    await adminDb.collection("ops_mesh_sessions").doc(sessionId).set({
      userId,
      goal,
      hints,
      clusterIds,
      strategy,
      startedAt: new Date(),
      completedAt: new Date(),
      trace: result.trace,
      final: result.final,
      consensus,
      metrics: {
        totalMs,
        tokensUsed,
        citationsCount,
      },
    });

    // Telemetry: Log mesh completion
    await logEvent({
      type: "mesh.final",
      ts: Date.now(),
      sessionId,
      userId,
      tokens: tokensUsed,
      ms_total: totalMs,
      citations_count: citationsCount,
    });

    console.log(`[mesh/execute] completed in ${totalMs}ms, consensus=${consensus.accepted}`);

    return NextResponse.json({
      sessionId,
      final: result.final,
      trace: result.trace,
      consensus: {
        accepted: consensus.accepted,
        disagreements: consensus.disagreements,
      },
      metrics: {
        totalMs,
        tokensUsed,
        citationsCount,
      },
    });
  } catch (error) {
    console.error("[mesh/execute] error:", error);

    // Handle RBAC errors with specific status codes
    if (error instanceof Error) {
      if (error.message.startsWith("feature_disabled") || error.message.startsWith("feature_not_found")) {
        return NextResponse.json({ error: "Feature not enabled" }, { status: 403 });
      }
      if (error.message.startsWith("quota_exceeded")) {
        return NextResponse.json({ error: "Quota exceeded" }, { status: 429 });
      }
      if (error.message === "user_not_found") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
