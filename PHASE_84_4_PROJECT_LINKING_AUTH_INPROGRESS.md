# Phase 84.4: Project Linking + Auth - IN PROGRESS

**Status**: Partially Implemented
**Date**: 2025-11-19

---

## 🎯 Overview

Phase 84.4 improves the VS Code extension by:
1. **Project Binding Model** - Clean workspace-to-project linking
2. **Auth Manager** - Secure token management (replaces apiKey in settings)
3. **Onboarding Wizard** - Guided setup for first-time users

---

## ✅ Completed (Phase 84.4.1)

### 1. Project Binding Model

**File**: [config/projectBinding.ts](ide/vscode-f0-bridge/src/config/projectBinding.ts)

```typescript
export interface F0ProjectBinding {
  projectId: string;
  apiBase: string;
}

export function getProjectBinding(): F0ProjectBinding | null;
export async function setProjectBinding(binding: F0ProjectBinding): Promise<void>;
export async function clearProjectBinding(): Promise<void>;
export function hasProjectBinding(): boolean;
```

**Benefits**:
- Centralized configuration management
- Type-safe project binding
- Easy validation

### 2. Link Project Command

**File**: [commands/linkProject.ts](ide/vscode-f0-bridge/src/commands/linkProject.ts)

**Flow**:
1. Ask for Project ID
2. Choose environment (Local/Production/Custom)
3. Save to workspace settings
4. Show confirmation

**UI**: Smart quick pick with descriptions

---

## ✅ Completed (Phase 84.4.2)

### Auth Manager

**File**: [auth/authManager.ts](ide/vscode-f0-bridge/src/auth/authManager.ts)

```typescript
export interface AuthToken {
  accessToken: string;
  expiresAt: number;
}

export interface AuthManager {
  getToken(): Promise<AuthToken | null>;
  ensureSignedIn(): Promise<AuthToken>;
  signOut(): Promise<void>;
}
```

**Features**:
- **Phase 84.4**: Manual token entry (temporary)
- **Phase 84.5+**: OAuth flow (planned)
- Token expiry checking
- Secure storage in `globalState`

**Security Improvements**:
- No more `f0.apiKey` in settings.json
- Tokens stored in VS Code secure storage
- Automatic expiry handling

---

## 🚧 Remaining Work

### 1. Update package.json

Add new commands:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "f0.linkProject",
        "title": "F0: Link Project"
      },
      {
        "command": "f0.signOut",
        "title": "F0: Sign Out"
      }
    ]
  }
}
```

### 2. Update extension.ts

```typescript
import { createAuthManager } from './auth/authManager';
import { linkProjectCommand } from './commands/linkProject';

export function activate(context: vscode.ExtensionContext) {
  const authManager = createAuthManager(context);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('f0.linkProject', linkProjectCommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('f0.signOut', () => authManager.signOut())
  );

  // Pass authManager to F0Panel...
}
```

### 3. Refactor f0Client.ts

Replace static config with AuthManager:

```typescript
export class F0Client {
  constructor(private authManager: AuthManager) {}

  private async getAuthHeader(): Promise<string> {
    const token = await this.authManager.ensureSignedIn();
    return `Bearer ${token.accessToken}`;
  }

  async createIdeSession(): Promise<IdeSession> {
    const binding = getProjectBinding();
    if (!binding) throw new Error('No project linked');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': await this.getAuthHeader(),
    };

    // ...
  }
}
```

### 4. Update F0Panel with Onboarding

Add states to webview:

```typescript
enum PanelState {
  LOADING = 'loading',
  NO_PROJECT = 'no_project',    // Show "Link Project" button
  NO_AUTH = 'no_auth',          // Show "Sign In" button
  READY = 'ready',              // Show chat interface
  ERROR = 'error',
}
```

**Onboarding UI** (in HTML):

```html
<!-- State: NO_PROJECT -->
<div id="onboarding-no-project" class="onboarding">
  <h2>Welcome to F0!</h2>
  <p>Link this workspace to an F0 project to get started.</p>
  <button onclick="linkProject()">Link Project</button>
</div>

<!-- State: NO_AUTH -->
<div id="onboarding-no-auth" class="onboarding">
  <h2>Sign in to F0</h2>
  <p>Authentication required to connect to F0 backend.</p>
  <button onclick="signIn()">Sign In</button>
</div>

<!-- State: READY -->
<div id="chat-interface">
  <!-- Existing chat UI -->
</div>
```

**Flow**:
1. Panel opens → check project binding
2. If no project → show "Link Project" UI
3. If project exists but no auth → show "Sign In" UI
4. If both exist → initialize session and show chat

---

## 📝 Implementation Guide

### Step-by-Step Integration

#### 1. Update package.json

```bash
cd /Users/abdo/Desktop/from-zero-working/ide/vscode-f0-bridge
```

Edit `package.json`, add to `contributes.commands`:

```json
{
  "command": "f0.linkProject",
  "title": "F0: Link Project"
},
{
  "command": "f0.signOut",
  "title": "F0: Sign Out"
}
```

#### 2. Update extension.ts

Import new modules:

```typescript
import { createAuthManager } from './auth/authManager';
import { linkProjectCommand } from './commands/linkProject';
import { getProjectBinding } from './config/projectBinding';
```

In `activate()`:

```typescript
const authManager = createAuthManager(context);

// Command: Link Project
context.subscriptions.push(
  vscode.commands.registerCommand('f0.linkProject', linkProjectCommand)
);

// Command: Sign Out
context.subscriptions.push(
  vscode.commands.registerCommand('f0.signOut', async () => {
    await authManager.signOut();
  })
);

// Command: Open Assistant (updated)
context.subscriptions.push(
  vscode.commands.registerCommand('f0.openAssistant', () => {
    // Check project binding
    if (!getProjectBinding()) {
      vscode.window.showErrorMessage(
        'No F0 project linked. Run "F0: Link Project" first.',
        'Link Project'
      ).then(choice => {
        if (choice === 'Link Project') {
          vscode.commands.executeCommand('f0.linkProject');
        }
      });
      return;
    }

    // Open panel with authManager
    F0Panel.createOrShow(context, authManager);
  })
);
```

#### 3. Refactor f0Client.ts

Current implementation uses static `IdeApiClientConfig`. Update to use `AuthManager`:

```typescript
export class F0Client {
  constructor(private authManager: AuthManager) {}

  private async getConfig() {
    const binding = getProjectBinding();
    if (!binding) {
      throw new Error('No F0 project linked');
    }

    const token = await this.authManager.ensureSignedIn();

    return {
      apiBase: binding.apiBase,
      projectId: binding.projectId,
      accessToken: token.accessToken,
    };
  }

  async createIdeSession(): Promise<IdeSession> {
    const { apiBase, projectId, accessToken } = await this.getConfig();

    const res = await fetch(`${apiBase}/api/ide/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ projectId, clientKind: 'vscode' }),
    });

    // ... handle response
  }

  // Similar for sendIdeChat...
}
```

#### 4. Update F0Panel.ts

**Constructor signature**:

```typescript
export class F0Panel {
  public static createOrShow(
    context: vscode.ExtensionContext,
    authManager: AuthManager
  ) {
    // ...
    F0Panel.currentPanel = new F0Panel(panel, context.extensionUri, authManager);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private authManager: AuthManager
  ) {
    // ...
  }
}
```

**Add state management**:

```typescript
private async _initializePanel() {
  // Check 1: Project binding
  const binding = getProjectBinding();
  if (!binding) {
    this._panel.webview.postMessage({ type: 'setState', state: 'no_project' });
    return;
  }

  // Check 2: Auth token
  const token = await this.authManager.getToken();
  if (!token) {
    this._panel.webview.postMessage({ type: 'setState', state: 'no_auth' });
    return;
  }

  // All good → create session
  this._initializeSession();
  this._panel.webview.postMessage({ type: 'setState', state: 'ready' });
}
```

**Handle onboarding messages**:

```typescript
this._panel.webview.onDidReceiveMessage(async (message) => {
  switch (message.type) {
    case 'linkProject':
      await vscode.commands.executeCommand('f0.linkProject');
      // Re-check state after linking
      await this._initializePanel();
      return;

    case 'signIn':
      try {
        await this.authManager.ensureSignedIn();
        await this._initializePanel();
      } catch (error) {
        this._panel.webview.postMessage({
          type: 'error',
          message: 'Authentication failed',
        });
      }
      return;

    case 'chat':
      // ... existing chat logic
      return;
  }
});
```

---

## 🧪 Testing Flow

### Scenario 1: Fresh Workspace (No Project Linked)

1. Open VS Code in new workspace
2. Run `F0: Open Assistant`
3. Expected: Shows "Link Project" UI
4. Click "Link Project" → enters projectId + apiBase
5. Panel updates → shows "Sign In" UI

### Scenario 2: Project Linked, No Auth

1. Workspace has `.vscode/settings.json` with `f0.projectId`
2. No auth token in globalState
3. Run `F0: Open Assistant`
4. Expected: Shows "Sign In" UI
5. Click "Sign In" → enters token manually
6. Panel updates → shows chat interface

### Scenario 3: Full Setup

1. Project linked + auth token exists
2. Run `F0: Open Assistant`
3. Expected: Directly shows chat interface
4. Can chat with F0 immediately

---

## 📊 Migration Guide

### For Users Migrating from Phase 84.3

**Before (Phase 84.3)**:

`.vscode/settings.json`:
```json
{
  "f0.projectId": "my-project-id",
  "f0.apiBase": "http://localhost:3030",
  "f0.apiKey": "eyJhbGciOiJSUzI1..."
}
```

**After (Phase 84.4)**:

`.vscode/settings.json`:
```json
{
  "f0.projectId": "my-project-id",
  "f0.apiBase": "http://localhost:3030"
}
```

Auth token stored securely in VS Code `globalState`, not in settings.

**Migration Steps**:
1. Copy your `f0.apiKey` value
2. Run `F0: Sign Out` (clears old data)
3. Run `F0: Open Assistant`
4. When prompted, paste the token
5. Remove `f0.apiKey` from settings.json

---

## 🔐 Security Improvements

| Aspect | Phase 84.3 | Phase 84.4 |
|--------|-----------|-----------|
| Token Storage | `.vscode/settings.json` (plaintext) | VS Code `globalState` (encrypted) |
| Token Visibility | Visible in workspace settings | Hidden from user |
| Token Expiry | No checking | Automatic expiry detection |
| Multi-workspace | Token duplicated per workspace | Single token for all workspaces |
| Accidental Commit | High risk (settings.json) | No risk (globalState not in repo) |

---

## 🚀 Next Steps: Phase 84.5

**OAuth Integration** (replacing manual token entry):

1. **OAuth Flow**:
   - User clicks "Sign In"
   - Opens browser → F0 dashboard login
   - Callback to extension with token
   - Token stored automatically

2. **Token Refresh**:
   - Automatic token refresh before expiry
   - Background token management
   - No user interruption

3. **Multi-Account Support**:
   - Switch between F0 accounts
   - Per-workspace account binding

---

## 📝 Status

**Phase 84.4.1**: ✅ Complete (Project Binding Model)
**Phase 84.4.2**: ✅ Complete (Auth Manager Core)
**Phase 84.4.3**: 🚧 In Progress (Integration + Onboarding UI)

**Estimated Completion**: 30-45 minutes of focused integration work

---

**Date**: 2025-11-19
**Next**: Complete integration in extension.ts, f0Client.ts, and F0Panel.ts
