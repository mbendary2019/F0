/**
 * VS Code OAuth Callback Endpoint
 * Phase 84.5: Handles OAuth callback and returns token to VS Code
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idToken = searchParams.get('id_token');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');

  // Validation
  if (!idToken) {
    return NextResponse.json(
      { error: 'Missing id_token parameter' },
      { status: 400 }
    );
  }

  if (!redirectUri || !redirectUri.startsWith('vscode://')) {
    return NextResponse.json(
      { error: 'Invalid or missing redirect_uri' },
      { status: 400 }
    );
  }

  try {
    // Verify the Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Create a custom token for the VS Code extension
    // This token can be used to authenticate with Firebase on the extension side
    const customToken = await adminAuth.createCustomToken(uid);

    // Build the VS Code deep link callback
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set('token', customToken);
    if (state) {
      callbackUrl.searchParams.set('state', state);
    }

    // Redirect to VS Code
    return NextResponse.redirect(callbackUrl.toString());
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      { error: 'Failed to verify token or create custom token' },
      { status: 500 }
    );
  }
}
