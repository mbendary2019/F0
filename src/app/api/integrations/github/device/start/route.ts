/**
 * Phase 70.2: GitHub OAuth Device Flow - Start
 * POST /api/integrations/github/device/start
 * Initiates GitHub OAuth device flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import type { GitHubDeviceCodeResponse } from '@/types/integrations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    await requireUser(req);

    const clientId = process.env.F0_GITHUB_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'GitHub OAuth not configured. Please set F0_GITHUB_CLIENT_ID.' },
        { status: 500 }
      );
    }

    // Start GitHub device flow
    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: 'repo user',
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[GitHub OAuth] Device flow start failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to start GitHub OAuth flow' },
        { status: 500 }
      );
    }

    const json = await res.json();

    const response: GitHubDeviceCodeResponse = {
      user_code: json.user_code,
      device_code: json.device_code,
      verification_uri: json.verification_uri,
      expires_in: json.expires_in,
      interval: json.interval,
    };

    console.log(
      `[GitHub OAuth] Device flow started. User code: ${response.user_code}`
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[GitHub OAuth] Start endpoint error:', error);

    // Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
