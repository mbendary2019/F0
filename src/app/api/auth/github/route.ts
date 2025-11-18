/**
 * GitHub OAuth Token Exchange
 *
 * This endpoint exchanges the OAuth code for an access token
 * and stores it securely in Firestore vault.
 */

import { NextRequest, NextResponse } from 'next/server';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      );
    }

    console.log('[GitHub OAuth] Exchanging code for token...');

    // Exchange code for access token
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('[GitHub OAuth] Token exchange error:', data);
      return NextResponse.json(
        { error: data.error_description || data.error },
        { status: 400 }
      );
    }

    const { access_token } = data;

    if (!access_token) {
      return NextResponse.json(
        { error: 'No access token received' },
        { status: 400 }
      );
    }

    console.log('[GitHub OAuth] ✅ Access token received');

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
      },
    });

    const userData = await userResponse.json();
    console.log('[GitHub OAuth] User:', userData.login);

    // Save to vault using Cloud Function
    const saveToken = httpsCallable(functions, 'saveIntegrationToken');
    await saveToken({
      provider: 'github',
      tokens: {
        accessToken: access_token,
      },
    });

    console.log('[GitHub OAuth] ✅ Token saved to vault');

    return NextResponse.json({
      success: true,
      user: {
        login: userData.login,
        name: userData.name,
        avatar_url: userData.avatar_url,
      },
    });
  } catch (error: any) {
    console.error('[GitHub OAuth] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
