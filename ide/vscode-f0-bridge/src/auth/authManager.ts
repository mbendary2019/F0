/**
 * Auth Manager
 * Phase 84.4.2: Manages F0 authentication tokens
 */

import * as vscode from 'vscode';

export interface AuthToken {
  accessToken: string; // Firebase ID token or F0 JWT
  expiresAt: number; // timestamp (ms)
}

export interface AuthManager {
  getToken(): Promise<AuthToken | null>;
  ensureSignedIn(): Promise<AuthToken>;
  signOut(): Promise<void>;

  // Phase 84.5: OAuth methods
  startOAuthLogin(apiBase: string): Promise<void>;
  finishOAuth(customToken: string, expiresInSeconds?: number): Promise<void>;
}

const GLOBAL_KEY = 'f0.authToken';

/**
 * Create auth manager instance
 * Phase 84.4: Uses manual token entry (temporary)
 * Phase 84.5+: Will use OAuth flow
 */
export function createAuthManager(context: vscode.ExtensionContext): AuthManager {
  return {
    async getToken() {
      const stored = context.globalState.get<AuthToken>(GLOBAL_KEY);
      if (!stored) {
        return null;
      }

      // Check if token is expired (with 1 minute buffer)
      if (stored.expiresAt && stored.expiresAt < Date.now() + 60_000) {
        return null;
      }

      return stored;
    },

    async ensureSignedIn() {
      const existing = await this.getToken();
      if (existing) {
        return existing;
      }

      // Phase 84.5: Prefer OAuth, fallback to manual token entry
      const choice = await vscode.window.showInformationMessage(
        'F0 requires authentication.',
        'Sign In with Browser',
        'Enter Token Manually',
        'Cancel'
      );

      if (choice === 'Sign In with Browser') {
        const { getProjectBinding } = await import('../config/projectBinding');
        const binding = getProjectBinding();
        if (!binding) {
          throw new Error('No project linked. Please link a project first.');
        }

        await this.startOAuthLogin(binding.apiBase);

        // Throw error to prevent immediate retry - user will sign in via browser
        throw new Error('OAuth login started. Please complete authentication in your browser.');
      }

      if (choice === 'Enter Token Manually') {
        const token = await askUserForManualToken();
        const parsed: AuthToken = {
          accessToken: token,
          expiresAt: Date.now() + 60 * 60 * 1000,
        };

        await context.globalState.update(GLOBAL_KEY, parsed);
        return parsed;
      }

      throw new Error('Authentication cancelled');
    },

    async signOut() {
      await context.globalState.update(GLOBAL_KEY, undefined);
      vscode.window.showInformationMessage('✅ Signed out from F0');
    },

    // Phase 84.5: OAuth Methods
    async startOAuthLogin(apiBase: string) {
      const callbackUri = 'vscode://fromzero.f0/callback';
      const loginUrl = `${apiBase}/api/auth/vscode/login?redirectUri=${encodeURIComponent(callbackUri)}`;

      await vscode.env.openExternal(vscode.Uri.parse(loginUrl));
      vscode.window.showInformationMessage('🔐 Opening F0 login in your browser...');
    },

    async finishOAuth(customToken: string, expiresInSeconds?: number) {
      const expiresAt = Date.now() + (expiresInSeconds ? expiresInSeconds * 1000 : 60 * 60 * 1000);

      const auth: AuthToken = {
        accessToken: customToken,
        expiresAt,
      };

      await context.globalState.update(GLOBAL_KEY, auth);
      vscode.window.showInformationMessage('✅ Signed in to F0 successfully!');
    },
  };
}

/**
 * Ask user to manually enter auth token
 * Temporary solution for Phase 84.4
 * Will be replaced with OAuth in Phase 84.5+
 */
async function askUserForManualToken(): Promise<string> {
  const choice = await vscode.window.showInformationMessage(
    'F0 requires authentication. How would you like to sign in?',
    'Enter Token Manually',
    'Open F0 Dashboard',
    'Cancel'
  );

  if (choice === 'Open F0 Dashboard') {
    // Open F0 dashboard in browser where user can get token
    await vscode.env.openExternal(
      vscode.Uri.parse('http://localhost:3030') // TODO: Use actual apiBase from config
    );
  }

  if (choice !== 'Enter Token Manually') {
    throw new Error('Authentication cancelled');
  }

  const token = await vscode.window.showInputBox({
    title: 'F0 Auth Token',
    placeHolder: 'Paste your F0 auth token',
    prompt: 'Get your token from F0 Dashboard → DevTools → Application → Local Storage → firebase:authUser → stsTokenManager.accessToken',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Token cannot be empty';
      }
      return null;
    },
  });

  if (!token) {
    throw new Error('No token provided');
  }

  return token.trim();
}

/**
 * Check if user is currently signed in
 */
export async function isSignedIn(authManager: AuthManager): Promise<boolean> {
  const token = await authManager.getToken();
  return token !== null;
}
