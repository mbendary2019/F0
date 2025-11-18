import { NextRequest, NextResponse } from 'next/server';
import { runPreflight, startRun, runSingleTask } from '@/lib/agents/runner';

export async function POST(req: NextRequest) {
  try {
    const { projectId, action, taskId } = await req.json();

    if (!projectId || !action) {
      return NextResponse.json(
        { error: 'Missing projectId or action' },
        { status: 422 }
      );
    }

    switch (action) {
      case 'preflight': {
        const result = await runPreflight(projectId);
        return NextResponse.json(result);
      }

      case 'execute-first': {
        const result = await startRun(projectId);
        return NextResponse.json(result);
      }

      case 'execute-task': {
        if (!taskId) {
          return NextResponse.json(
            { error: 'Missing taskId' },
            { status: 422 }
          );
        }
        const result = await runSingleTask(projectId, taskId);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Runner error' },
      { status: 500 }
    );
  }
}
