/**
 * POST /api/ops/validate/sample
 *
 * Save a labeled validation sample for model training.
 * Used for human feedback and continuous learning.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { saveSample, type SampleDoc } from "@/orchestrator/rag/online_learning";

export const dynamic = 'force-dynamic';

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
      console.error("[validate/sample] auth error:", authError);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Parse request
    const body = await req.json();
    const { sessionId, goal, subscores, pass, strategy } = body;

    // Validate required fields
    if (!sessionId || !goal || !subscores || typeof pass !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, goal, subscores, pass" },
        { status: 400 }
      );
    }

    // Validate subscores structure
    if (
      typeof subscores.citation !== "number" ||
      typeof subscores.context !== "number" ||
      typeof subscores.source !== "number" ||
      typeof subscores.relevance !== "number"
    ) {
      return NextResponse.json(
        { error: "Invalid subscores structure" },
        { status: 400 }
      );
    }

    // Save sample
    const sample: SampleDoc = {
      sessionId,
      goal,
      subscores: {
        citation: subscores.citation,
        context: subscores.context,
        source: subscores.source,
        relevance: subscores.relevance,
      },
      pass: !!pass,
      strategy: strategy || "default",
      ts: Date.now(),
    };

    await saveSample(sample);

    console.log(`[validate/sample] Saved sample for session ${sessionId}, pass=${pass}`);

    return NextResponse.json({
      ok: true,
      sessionId,
      pass,
    });
  } catch (error) {
    console.error("[validate/sample] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
