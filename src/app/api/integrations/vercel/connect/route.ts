/**
 * Phase 72: Vercel OAuth Integration
 * GET /api/integrations/vercel/connect
 *
 * Initiates Vercel OAuth flow by redirecting to Vercel's authorization page
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.VERCEL_CLIENT_ID;
    const redirectUri = process.env.VERCEL_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error('[Vercel OAuth] Missing environment variables:', {
        hasClientId: !!clientId,
        hasRedirectUri: !!redirectUri,
      });

      return NextResponse.json(
        {
          error: 'Server configuration error',
          message: 'VERCEL_CLIENT_ID or VERCEL_REDIRECT_URI is not configured',
        },
        { status: 500 }
      );
    }

    // Generate a random state for CSRF protection
    const state = Math.random().toString(36).substring(7);

    // Build Vercel OAuth URL
    // Docs: https://vercel.com/docs/rest-api/authentication#oauth2
    const authUrl = new URL('https://vercel.com/oauth/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'user,projects');

    console.log('[Vercel OAuth] Redirecting to:', authUrl.toString());

    // Redirect user to Vercel OAuth page
    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    console.error('[Vercel OAuth] Error in /connect:', error);

    return NextResponse.json(
      {
        error: 'Failed to initiate OAuth',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
