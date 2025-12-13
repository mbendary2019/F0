import { NextRequest, NextResponse } from 'next/server';
import { executeTask, executePhase, preflightCheck } from '@/lib/agents/runner';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { projectId, taskId, phaseId, action } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 422 });
    }

    // Preflight check
    if (action === 'preflight') {
      const check = await preflightCheck();
      return NextResponse.json(check);
    }

    // Execute single task
    if (action === 'execute-task' && taskId) {
      // TODO: Fetch task from Firestore
      return NextResponse.json({ error: 'Not implemented yet' }, { status: 501 });
    }

    // Execute entire phase
    if (action === 'execute-phase' && phaseId) {
      const result = await executePhase(projectId, phaseId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 422 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
