/**
 * Phase 70.2: GitHub OAuth Device Flow - Poll
 * POST /api/integrations/github/device/poll
 * Polls GitHub for OAuth token after user authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import type {

export const dynamic = 'force-dynamic';
  GitHubDevicePollRequest,
  GitHubDevicePollResponse,
} from '@/types/integrations';

export async function POST(req: NextRequest) {
  try {
    const body: GitHubDevicePollRequest = await req.json();
    const { device_code } = body;

    if (!device_code) {
      return NextResponse.json(
        { error: 'device_code is required' },
        { status: 400 }
      );
    }

    const clientId = process.env.F0_GITHUB_CLIENT_ID;
    const clientSecret = process.env.F0_GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'GitHub OAuth not configured' },
        { status: 500 }
      );
    }

    // Poll GitHub for access token
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[GitHub OAuth] Poll failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to poll GitHub OAuth' },
        { status: 500 }
      );
    }

    const json = await res.json();

    // Handle pending authorization
    if (json.error === 'authorization_pending') {
      const response: GitHubDevicePollResponse = {
        status: 'pending',
      };
      return NextResponse.json(response, { status: 200 });
    }

    // Handle errors
    if (json.error) {
      console.error('[GitHub OAuth] Poll error:', json.error);
      const response: GitHubDevicePollResponse = {
        status: 'error',
        error: json.error,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // Success - return access token
    const response: GitHubDevicePollResponse = {
      status: 'ok',
      access_token: json.access_token,
    };

    console.log('[GitHub OAuth] Poll successful - token acquired');

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[GitHub OAuth] Poll endpoint error:', error);

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
