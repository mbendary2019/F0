import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "@/lib/firebaseAdmin";
import type { ContextHandle } from "@/lib/types/context";
import type { AgentMessage } from "@/lib/types/agent";
import { ResearcherAgent } from "@/orchestrator/agents/roles/researcherAgent";
import { SynthesizerAgent } from "@/orchestrator/agents/roles/synthesizerAgent";
import { CriticAgent } from "@/orchestrator/agents/roles/criticAgent";
import { runMesh } from "@/orchestrator/mesh/router";
import type { MeshRoute } from "@/orchestrator/mesh/protocol";
import { validateConsensus } from "@/orchestrator/rag/consensus";

/**
 * POST /api/mesh/continue
 * Continue an existing mesh session with feedback
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
      console.error("[mesh/continue] auth error:", authError);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Parse request
    const body = await req.json();
    const { sessionId, feedback } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    if (!feedback || typeof feedback !== "string") {
      return NextResponse.json({ error: "feedback is required" }, { status: 400 });
    }

    // Load existing session
    const sessionDoc = await adminDb.collection("ops_mesh_sessions").doc(sessionId).get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const sessionData = sessionDoc.data();

    // Verify ownership
    if (sessionData?.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const startTime = Date.now();

    // Build context from session
    const ctx: ContextHandle = {
      userId,
      sessionId,
      goal: sessionData.goal,
      hints: [...(sessionData.hints ?? []), feedback],
      clusterIds: sessionData.clusterIds ?? [],
      limits: {
        tokens: 4000,
        latencyMs: 30000,
      },
    };

    // Initialize agents
    const agents = {
      researcher: new ResearcherAgent(),
      synthesizer: new SynthesizerAgent(),
      critic: new CriticAgent(),
    };

    // Build mesh route
    const route: MeshRoute = {
      from: "researcher",
      to: ["researcher"],
      policy: {
        strategy: sessionData.strategy ?? "critic",
        maxHops: 4,
        timeout: 30000,
      },
    };

    // Entry message with feedback
    const entry: AgentMessage = {
      type: "CRITIQUE",
      content: feedback,
      from: "user",
      to: ["researcher"],
    };

    // Run mesh
    console.log(`[mesh/continue] continuing mesh session=${sessionId} with feedback="${feedback}"`);
    const result = await runMesh(agents, entry, route, ctx);

    // Validate consensus
    const consensus = await validateConsensus(result.trace, sessionData.strategy ?? "critic", ctx);

    // Calculate metrics
    const totalMs = Date.now() - startTime;
    const citationsCount = result.final.evidence?.length ?? 0;
    const tokensUsed = result.trace.reduce((sum, msg) => sum + (msg.content?.length ?? 0), 0);

    // Update session in Firestore
    await adminDb.collection("ops_mesh_sessions").doc(sessionId).update({
      continuedAt: new Date(),
      lastFeedback: feedback,
      trace: [...(sessionData.trace ?? []), ...result.trace],
      final: result.final,
      consensus,
      metrics: {
        totalMs: (sessionData.metrics?.totalMs ?? 0) + totalMs,
        tokensUsed: (sessionData.metrics?.tokensUsed ?? 0) + tokensUsed,
        citationsCount,
      },
    });

    console.log(`[mesh/continue] completed in ${totalMs}ms, consensus=${consensus.accepted}`);

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
    console.error("[mesh/continue] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
