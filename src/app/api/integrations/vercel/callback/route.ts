/**
 * Phase 72: Vercel OAuth Integration
 * GET /api/integrations/vercel/callback
 *
 * Handles Vercel OAuth callback
 * - Exchanges authorization code for access token
 * - Stores token in Firestore
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface VercelTokenResponse {
  access_token: string;
  token_type: string;
  installation_id?: string;
  user_id?: string;
  team_id?: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[Vercel OAuth] Authorization error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=vercel_auth_failed&message=${error}`
      );
    }

    // Validate code
    if (!code) {
      console.error('[Vercel OAuth] Missing authorization code');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=vercel_missing_code`
      );
    }

    const clientId = process.env.VERCEL_CLIENT_ID;
    const clientSecret = process.env.VERCEL_CLIENT_SECRET;
    const redirectUri = process.env.VERCEL_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('[Vercel OAuth] Missing environment variables');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=vercel_config_error`
      );
    }

    // Exchange code for access token
    console.log('[Vercel OAuth] Exchanging code for access token...');

    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Vercel OAuth] Token exchange failed:', errorText);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=vercel_token_failed`
      );
    }

    const tokenData: VercelTokenResponse = await tokenResponse.json();

    console.log('[Vercel OAuth] Token received:', {
      hasAccessToken: !!tokenData.access_token,
      userId: tokenData.user_id,
      teamId: tokenData.team_id,
      installationId: tokenData.installation_id,
    });

    // Store token in Firestore
    console.log('[Vercel OAuth] Storing token in Firestore...');

    const vercelDoc = doc(db, 'ops_integrations', 'vercelAdmin');

    await setDoc(
      vercelDoc,
      {
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type || 'Bearer',
        userId: tokenData.user_id || null,
        teamId: tokenData.team_id || null,
        installationId: tokenData.installation_id || null,
        connectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    console.log('[Vercel OAuth] ✅ Token stored successfully');

    // Redirect to integrations page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=vercel_connected`
    );
  } catch (error: any) {
    console.error('[Vercel OAuth] Error in callback:', error);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=vercel_callback_error&message=${encodeURIComponent(error.message)}`
    );
  }
}
