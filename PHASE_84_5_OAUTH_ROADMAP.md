# Phase 84.5: OAuth Integration - Implementation Roadmap

**Status**: Backend Ready, Extension Integration Pending
**Date**: 2025-11-19

---

## Overview

Phase 84.5 adds seamless OAuth authentication to replace manual token entry. Users click "Sign In" → browser opens → authenticate with Firebase → token automatically returns to VS Code.

---

## ✅ Completed: Backend OAuth Infrastructure

### 1. OAuth Login Endpoint

**File**: [src/app/api/auth/vscode/login/route.ts](src/app/api/auth/vscode/login/route.ts)

```typescript
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const redirectUri = searchParams.get('redirectUri');
  const state = searchParams.get('state');

  // Security: validate vscode:// URI
  if (!redirectUri?.startsWith('vscode://')) {
    return NextResponse.json({ error: 'Invalid redirectUri' }, { status: 400 });
  }

  // Redirect to F0 login page with callback info
  const loginPageUrl = new URL('/auth/signin', req.url);
  loginPageUrl.searchParams.set('vscode_callback', redirectUri);
  if (state) loginPageUrl.searchParams.set('state', state);

  return NextResponse.redirect(loginPageUrl.toString());
}
```

### 2. OAuth Callback Endpoint

**File**: [src/app/api/auth/vscode/callback/route.ts](src/app/api/auth/vscode/callback/route.ts)

```typescript
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idToken = searchParams.get('id_token');
  const redirectUri = searchParams.get('redirect_uri');

  // Verify Firebase ID token
  const decodedToken = await adminAuth.verifyIdToken(idToken);

  // Create custom token for VS Code
  const customToken = await adminAuth.createCustomToken(decodedToken.uid);

  // Deep link back to VS Code
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('token', customToken);

  return NextResponse.redirect(callbackUrl.toString());
}
```

### 3. VS Code URI Handler Registration

**File**: [ide/vscode-f0-bridge/package.json](ide/vscode-f0-bridge/package.json)

```json
{
  "activationEvents": [
    "onCommand:f0.openAssistant",
    "onCommand:f0.linkProject",
    "onCommand:f0.signOut",
    "onUri"  // ✅ Added for OAuth callback handling
  ]
}
```

---

## 📋 Remaining Work: Extension Integration

### 1. Update AuthManager with OAuth Methods

**File**: [ide/vscode-f0-bridge/src/auth/authManager.ts](ide/vscode-f0-bridge/src/auth/authManager.ts)

**Current State**: Manual token entry only

**Required Changes**:

```typescript
export interface AuthManager {
  getToken(): Promise<AuthToken | null>;
  ensureSignedIn(): Promise<AuthToken>;
  signOut(): Promise<void>;

  // NEW: OAuth methods
  startOAuthLogin(apiBase: string): Promise<void>;
  finishOAuth(customToken: string, expiresInSeconds?: number): Promise<void>;
}

export function createAuthManager(context: vscode.ExtensionContext): AuthManager {
  return {
    // ... existing methods ...

    async startOAuthLogin(apiBase: string) {
      const callbackUri = "vscode://fromzero.f0/callback";
      const loginUrl = `${apiBase}/api/auth/vscode/login?redirectUri=${encodeURIComponent(callbackUri)}`;

      await vscode.env.openExternal(vscode.Uri.parse(loginUrl));
      vscode.window.showInformationMessage("Opening F0 login in your browser…");
    },

    async finishOAuth(customToken: string, expiresInSeconds?: number) {
      const expiresAt = Date.now() + (expiresInSeconds ? expiresInSeconds * 1000 : 60 * 60 * 1000);

      const auth: AuthToken = {
        accessToken: customToken,
        expiresAt,
      };

      await context.globalState.update(GLOBAL_KEY, auth);
      vscode.window.showInformationMessage("✅ Signed in to F0 successfully!");
    },
  };
}
```

### 2. Register URI Handler in Extension

**File**: [ide/vscode-f0-bridge/src/extension.ts](ide/vscode-f0-bridge/src/extension.ts)

**Add after creating authManager**:

```typescript
export function activate(context: vscode.ExtensionContext) {
  const authManager = createAuthManager(context);

  // ... existing commands ...

  // NEW: URI Handler for OAuth callback
  const uriHandler: vscode.UriHandler = {
    async handleUri(uri: vscode.Uri) {
      if (uri.path !== "/callback") return;

      const params = new URLSearchParams(uri.query);
      const token = params.get("token");
      const expiresIn = params.get("expiresIn");

      if (!token) {
        vscode.window.showErrorMessage("F0: Missing token in OAuth callback.");
        return;
      }

      await authManager.finishOAuth(
        token,
        expiresIn ? Number(expiresIn) : undefined
      );

      // Notify user and refresh panel if open
      vscode.window.showInformationMessage("✅ Successfully signed in to F0!");
    },
  };

  context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));
}
```

### 3. Update Sign In Flow in AuthManager

**File**: [ide/vscode-f0-bridge/src/auth/authManager.ts](ide/vscode-f0-bridge/src/auth/authManager.ts)

**Replace `askUserForManualToken()` with**:

```typescript
async ensureSignedIn(): Promise<AuthToken> {
  const existing = await this.getToken();
  if (existing) return existing;

  // Phase 84.5: Prefer OAuth, fallback to manual
  const choice = await vscode.window.showInformationMessage(
    'F0 requires authentication.',
    'Sign In with Browser',
    'Enter Token Manually',
    'Cancel'
  );

  if (choice === 'Sign In with Browser') {
    const binding = getProjectBinding();
    if (!binding) {
      throw new Error('No project linked. Please link a project first.');
    }

    await this.startOAuthLogin(binding.apiBase);

    // Throw error to prevent immediate retry - user will sign in via browser
    throw new Error('OAuth login started. Please complete authentication in your browser.');
  }

  if (choice === 'Enter Token Manually') {
    return await askUserForManualToken(context);
  }

  throw new Error('Authentication cancelled');
}
```

### 4. Update F0Panel Sign In Button

**File**: [ide/vscode-f0-bridge/src/panels/F0Panel.ts](ide/vscode-f0-bridge/src/panels/F0Panel.ts)

**Current**: Calls `authManager.ensureSignedIn()` which shows modal

**Better**: Direct OAuth trigger

```typescript
case 'signIn':
  // User clicked "Sign In" in onboarding UI
  try {
    const binding = getProjectBinding();
    if (!binding) {
      this._panel.webview.postMessage({
        type: 'error',
        payload: 'No project linked. Please link a project first.',
      });
      return;
    }

    // Phase 84.5: Start OAuth flow directly
    await this._authManager.startOAuthLogin(binding.apiBase);

    this._panel.webview.postMessage({
      type: 'system',
      payload: '🔐 Opening F0 login in your browser...',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this._panel.webview.postMessage({
      type: 'error',
      payload: `Authentication failed: ${errorMsg}`,
    });
  }
  return;
```

### 5. Create Login Page with OAuth Callback Support

**File**: [src/app/auth/signin/page.tsx](src/app/auth/signin/page.tsx) *(if not exists)*

```typescript
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function SignInPage() {
  const searchParams = useSearchParams();
  const vscodeCallback = searchParams.get('vscode_callback');
  const state = searchParams.get('state');

  useEffect(() => {
    if (vscodeCallback) {
      // Auto-trigger sign in for VS Code OAuth flow
      handleVSCodeSignIn();
    }
  }, [vscodeCallback]);

  const handleVSCodeSignIn = async () => {
    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();

      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      // Redirect to callback endpoint
      const callbackUrl = new URL('/api/auth/vscode/callback', window.location.origin);
      callbackUrl.searchParams.set('id_token', idToken);
      callbackUrl.searchParams.set('redirect_uri', vscodeCallback);
      if (state) callbackUrl.searchParams.set('state', state);

      window.location.href = callbackUrl.toString();
    } catch (error) {
      console.error('Sign in failed:', error);
      // Show error UI
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <h2 className="text-3xl font-bold text-center">
          {vscodeCallback ? 'Signing in to F0 from VS Code...' : 'Sign In to F0'}
        </h2>

        {!vscodeCallback && (
          <button
            onClick={handleVSCodeSignIn}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Sign In with Google
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## OAuth Flow Diagram

```
┌─────────────┐                    ┌──────────────┐                    ┌─────────────┐
│   VS Code   │                    │  F0 Backend  │                    │  Firebase   │
│  Extension  │                    │              │                    │    Auth     │
└──────┬──────┘                    └───────┬──────┘                    └──────┬──────┘
       │                                   │                                  │
       │ 1. User clicks "Sign In"          │                                  │
       │────────────────────────────────>  │                                  │
       │    startOAuthLogin(apiBase)       │                                  │
       │                                   │                                  │
       │ 2. Open browser                   │                                  │
       │    vscode.env.openExternal()      │                                  │
       │────────────────────────────────>  │                                  │
       │    /api/auth/vscode/login         │                                  │
       │    ?redirectUri=vscode://...      │                                  │
       │                                   │                                  │
       │                        3. Redirect to /auth/signin                   │
       │                                   │──────────────────────────────────>│
       │                                   │    with vscode_callback param    │
       │                                   │                                  │
       │                        4. User signs in with Google                  │
       │                                   │<─────────────────────────────────│
       │                                   │    signInWithPopup()             │
       │                                   │                                  │
       │                        5. Get Firebase ID token                      │
       │                                   │──────────────────────────────────>│
       │                                   │    getIdToken()                  │
       │                                   │                                  │
       │                        6. POST to /api/auth/vscode/callback          │
       │                                   │<─────────────────────────────────│
       │                                   │    id_token + redirect_uri       │
       │                                   │                                  │
       │                        7. Verify token + create custom token         │
       │                                   │──────────────────────────────────>│
       │                                   │    adminAuth.verifyIdToken()     │
       │                                   │    adminAuth.createCustomToken() │
       │                                   │                                  │
       │ 8. Deep link redirect              │                                  │
       │<──────────────────────────────────│                                  │
       │    vscode://fromzero.f0/callback  │                                  │
       │    ?token=CUSTOM_TOKEN            │                                  │
       │                                   │                                  │
       │ 9. handleUri() receives token     │                                  │
       │    finishOAuth(token)             │                                  │
       │    Store in globalState           │                                  │
       │                                   │                                  │
       │ 10. Show success message          │                                  │
       │     Panel auto-refreshes          │                                  │
```

---

## Security Considerations

### 1. Deep Link Validation

Both backend endpoints validate that `redirectUri` starts with `vscode://`:

```typescript
if (!redirectUri?.startsWith('vscode://')) {
  return NextResponse.json({ error: 'Invalid redirectUri' }, { status: 400 });
}
```

### 2. Token Verification

Callback endpoint verifies Firebase ID token before creating custom token:

```typescript
const decodedToken = await adminAuth.verifyIdToken(idToken);
const customToken = await adminAuth.createCustomToken(decodedToken.uid);
```

### 3. Secure Storage

Custom token stored in VS Code's encrypted `globalState`, not workspace settings:

```typescript
await context.globalState.update(GLOBAL_KEY, {
  accessToken: customToken,
  expiresAt: Date.now() + expiresInSeconds * 1000
});
```

---

## Testing Checklist

### Backend OAuth Endpoints

- [ ] `/api/auth/vscode/login` redirects to login page with callback params
- [ ] `/api/auth/vscode/callback` verifies ID token correctly
- [ ] `/api/auth/vscode/callback` creates custom token
- [ ] `/api/auth/vscode/callback` redirects to `vscode://` deep link

### Extension OAuth Flow

- [ ] `startOAuthLogin()` opens browser with correct URL
- [ ] URI handler receives callback with token
- [ ] `finishOAuth()` stores token in globalState
- [ ] Success message shown to user
- [ ] Panel auto-refreshes to READY state after OAuth

### Login Page

- [ ] Auto-triggers sign in when `vscode_callback` param present
- [ ] Google sign in popup works correctly
- [ ] Redirects to callback endpoint with ID token
- [ ] Handles errors gracefully

---

## Migration from Phase 84.4

### For Developers

**Before (Phase 84.4)**:
- Manual token entry via input box
- User copies token from DevTools
- Tokens expire after 1 hour

**After (Phase 84.5)**:
- One-click OAuth sign in
- Browser-based authentication
- Automatic token refresh (future enhancement)

### Code Changes Required

1. Update `authManager.ts` with OAuth methods
2. Add URI handler to `extension.ts`
3. Update sign in flow in F0Panel
4. Create/update login page with OAuth support
5. Remove or deprecate manual token entry UI

---

## Future Enhancements (Phase 84.6+)

### 1. Automatic Token Refresh

```typescript
async refreshToken(): Promise<AuthToken> {
  // Exchange custom token for new ID token
  // Update globalState
  // Return new token
}
```

### 2. Multi-Account Support

```typescript
interface AuthAccount {
  uid: string;
  email: string;
  token: AuthToken;
}

// Store multiple accounts
// Switch between accounts per workspace
```

### 3. Offline Token Caching

```typescript
// Cache token with longer expiry
// Validate on first API call
// Refresh if expired
```

---

## Summary

**Phase 84.5 Status**:

- ✅ Backend OAuth endpoints complete
- ✅ VS Code URI handler registration complete
- 🔄 Extension OAuth integration (roadmap provided)
- 🔄 Login page OAuth callback support (roadmap provided)

**Estimated Time to Complete**: 1-2 hours of focused integration work

**Files to Modify**:
1. [auth/authManager.ts](ide/vscode-f0-bridge/src/auth/authManager.ts) - Add OAuth methods
2. [extension.ts](ide/vscode-f0-bridge/src/extension.ts) - Register URI handler
3. [panels/F0Panel.ts](ide/vscode-f0-bridge/src/panels/F0Panel.ts) - Update sign in button
4. [src/app/auth/signin/page.tsx](src/app/auth/signin/page.tsx) - Create OAuth-enabled login page

**Next Step**: Implement OAuth methods in AuthManager and test the complete flow.

---

**Date**: 2025-11-19
**Phase**: 84.5 - OAuth Integration Roadmap
