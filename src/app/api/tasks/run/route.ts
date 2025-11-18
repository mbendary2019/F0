// API route to run a task on F0 Orchestrator
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_F0_BASE || "http://localhost:8787";
    const apiKey = process.env.F0_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "F0_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();

    console.log("Running F0 task:", body);

    const response = await fetch(`${baseUrl}/api/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-f0-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    console.log("F0 task response:", data);

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error("Error running task:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to run task",
      },
      { status: 500 }
    );
  }
}


