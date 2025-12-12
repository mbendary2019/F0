/**
 * VS Code OAuth Login Endpoint
 * Phase 84.5: Initiates OAuth flow for VS Code extension
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const redirectUri = searchParams.get('redirectUri');
  const state = searchParams.get('state'); // optional session tracking

  if (!redirectUri) {
    return NextResponse.json(
      { error: 'Missing redirectUri parameter' },
      { status: 400 }
    );
  }

  // Validate that redirectUri is a vscode:// URI for security
  if (!redirectUri.startsWith('vscode://')) {
    return NextResponse.json(
      { error: 'Invalid redirectUri - must be a vscode:// URI' },
      { status: 400 }
    );
  }

  // Build Firebase Auth UI URL
  // This will redirect to the web app's login page
  const loginPageUrl = new URL('/auth/signin', req.url);

  // Pass callback info as query params
  loginPageUrl.searchParams.set('vscode_callback', redirectUri);
  if (state) {
    loginPageUrl.searchParams.set('state', state);
  }

  // Redirect to login page
  return NextResponse.redirect(loginPageUrl.toString());
}
