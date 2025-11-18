// API route to fetch tasks from F0 Orchestrator

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

import { NextResponse } from "next/server";

export async function GET() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_F0_BASE || "http://localhost:8787";
    const apiKey = process.env.F0_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "F0_API_KEY not configured" },
        { status: 500 }
      );
    }

    console.log(`Fetching tasks from: ${baseUrl}/api/last`);

    const response = await fetch(`${baseUrl}/api/last`, {
      headers: {
        "x-f0-key": apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`F0 API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { ok: false, error: `F0 API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // F0 /api/last returns a single task, not an array
    // Convert to array format for dashboard
    let tasks: any[] = [];

    if (data.ok && data.data) {
      // Single task from /api/last
      tasks = [{
        id: data.data.ts || Date.now(),
        prompt: data.data.plan?.prompt || "Unknown task",
        tags: data.data.plan?.tags || [],
        status: "completed", // /api/last only returns completed tasks
        createdAt: data.data.ts,
        result: data.data.result,
      }];
    } else if (data.tasks) {
      // Array format (if F0 returns this in the future)
      tasks = data.tasks;
    }

    console.log(`Fetched ${tasks.length} task(s)`);

    return NextResponse.json({
      ok: true,
      tasks,
      total: tasks.length,
    });
  } catch (error: any) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to fetch tasks",
      },
      { status: 500 }
    );
  }
}

