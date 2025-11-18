/**
 * GitHub OAuth Callback Handler
 *
 * Handles the redirect from GitHub OAuth authorization
 * Exchanges the authorization code for an access token
 *
 * Phase 52 - GitHub Integration
 */

import {NextRequest, NextResponse} from 'next/server';
import {getFunctions, httpsCallable} from 'firebase/functions';
import {app} from '@/lib/firebaseClient';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Handle OAuth errors from GitHub
  if (error) {
    console.error('GitHub OAuth error:', error);
    const errorDescription = url.searchParams.get('error_description') || 'OAuth authorization failed';
    return NextResponse.redirect(
      new URL(`/ops/github?error=${encodeURIComponent(errorDescription)}`, url.origin)
    );
  }

  // Validate authorization code
  if (!code) {
    return NextResponse.redirect(
      new URL('/ops/github?error=missing_code', url.origin)
    );
  }

  try {
    // Call Cloud Function to exchange code for token
    const functions = getFunctions(app);
    const exchange = httpsCallable(functions, 'exchangeOAuthCode');

    const result = await exchange({code, state});

    // Redirect to success page
    return NextResponse.redirect(
      new URL('/ops/github?connected=1', url.origin)
    );
  } catch (error: any) {
    console.error('OAuth exchange error:', error);

    const errorMessage = error.message || 'oauth_failed';
    return NextResponse.redirect(
      new URL(`/ops/github?error=${encodeURIComponent(errorMessage)}`, url.origin)
    );
  }
}
