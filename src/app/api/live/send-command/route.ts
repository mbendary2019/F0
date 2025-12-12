// src/app/api/live/send-command/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assertAuth } from '@/server/auth';

/**
 * Send Command to IDE
 *
 * This API route sends commands from the Dashboard to the IDE extension
 * by calling the ideSendCommand Cloud Function
 *
 * Body: IdeCommandEnvelope (commandId, sessionId, projectId, kind, ts, payload)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const auth = assertAuth(req);
    if (!auth.ok || !auth.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse command from request body
    const command = await req.json();

    // Validate required fields
    if (!command.commandId || !command.sessionId || !command.projectId) {
      return NextResponse.json(
        { error: 'Missing required fields: commandId, sessionId, or projectId' },
        { status: 400 }
      );
    }

    if (!command.kind || !command.ts) {
      return NextResponse.json(
        { error: 'Missing required fields: kind or ts' },
        { status: 400 }
      );
    }

    // Get Cloud Function URL from environment
    const functionUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL ||
                       'http://127.0.0.1:5001/from-zero-84253/us-central1';

    // Call ideSendCommand Cloud Function
    const response = await fetch(`${functionUrl}/ideSendCommand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error || 'Failed to send command' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[send-command] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
