# Phase 84.6: Auto Project Detection - IN PROGRESS 🚧

**Status**: 60% Complete
**Date**: 2025-11-19

---

## ✅ Completed

### 1. Type Definitions
**File**: [ide/vscode-f0-bridge/src/types/f0ProjectConfig.ts](ide/vscode-f0-bridge/src/types/f0ProjectConfig.ts)

```typescript
export interface F0ProjectConfig {
  projectId: string;
  projectName: string;
  backendUrl: string;
  environment: 'prod' | 'dev' | 'staging';
  lastSync?: number;
}
```

### 2. Auto-Detection Logic
**File**: [ide/vscode-f0-bridge/src/config/projectDetection.ts](ide/vscode-f0-bridge/src/config/projectDetection.ts)

Functions:
- `detectF0Project()` - Scans workspace for `.f0/project.json`
- `writeF0ProjectConfig()` - Writes config to workspace
- `hasF0ProjectConfig()` - Quick check if config exists

### 3. Initialize Project Command
**File**: [ide/vscode-f0-bridge/src/commands/initProject.ts](ide/vscode-f0-bridge/src/commands/initProject.ts)

Interactive wizard:
1. Ask for Project ID
2. Ask for Project Name
3. Select Environment (prod/dev/staging)
4. Write `.f0/project.json`
5. Show success + reload option

---

## 🔄 Remaining Work

### 1. Update projectBinding.ts to use .f0/project.json

**File**: `ide/vscode-f0-bridge/src/config/projectBinding.ts`

**Current**: Uses VS Code workspace settings (`f0.projectId`, `f0.apiBase`)

**Needed**: Fallback to `.f0/project.json` if workspace settings empty

```typescript
export function getProjectBinding(): F0ProjectBinding | null {
  // Priority 1: Check .f0/project.json
  const f0Config = detectF0Project();
  if (f0Config) {
    return {
      projectId: f0Config.projectId,
      apiBase: f0Config.backendUrl,
    };
  }

  // Priority 2: Fallback to workspace settings (legacy)
  const cfg = vscode.workspace.getConfiguration('f0');
  const projectId = cfg.get<string>('projectId');
  const apiBase = cfg.get<string>('apiBase') ?? 'http://localhost:3030';

  if (!projectId) return null;

  return { projectId, apiBase };
}
```

### 2. Register initProject Command

**File**: `ide/vscode-f0-bridge/src/extension.ts`

Add:
```typescript
import { initProjectCommand } from './commands/initProject';

context.subscriptions.push(
  vscode.commands.registerCommand('f0.initProject', initProjectCommand)
);
```

**File**: `ide/vscode-f0-bridge/package.json`

Add to commands:
```json
{
  "command": "f0.initProject",
  "title": "F0: Initialize Project"
}
```

Add to activationEvents:
```json
"onCommand:f0.initProject"
```

### 3. Update F0Panel Onboarding UI

**File**: `ide/vscode-f0-bridge/src/panels/F0Panel.ts`

**Current NO_PROJECT screen**:
```html
<div id="onboarding-no-project" class="onboarding">
  <h2>Welcome to F0!</h2>
  <p>Link this workspace to an F0 project to get started.</p>
  <button onclick="linkProject()">Link Project</button>
</div>
```

**Updated NO_PROJECT screen**:
```html
<div id="onboarding-no-project" class="onboarding">
  <h2>Welcome to F0!</h2>
  <p>This workspace is not an F0 project yet.</p>

  <div style="display: flex; gap: 12px; flex-direction: column; width: 100%; max-width: 400px;">
    <button onclick="initProject()" class="primary-btn">
      Initialize F0 Project
    </button>
    <button onclick="linkProject()" class="secondary-btn">
      Link Existing Project
    </button>
  </div>

  <p style="font-size: 11px; color: #6b7280; margin-top: 16px;">
    Initialize creates a .f0/project.json file in your workspace
  </p>
</div>
```

**Add to webview script**:
```javascript
function initProject() {
  vscode.postMessage({ type: 'initProject' });
}

window.initProject = initProject;
```

**Add to message handler**:
```typescript
case 'initProject':
  await vscode.commands.executeCommand('f0.initProject');
  // Re-check state after init
  await this._initializePanel();
  return;
```

### 4. Auto-Detection on Activation

**File**: `ide/vscode-f0-bridge/src/extension.ts`

**Add after creating AuthManager**:
```typescript
import { detectF0Project } from './config/projectDetection';

export async function activate(context: vscode.ExtensionContext) {
  console.log('F0 Live Bridge extension activated');

  // Create AuthManager instance
  const authManager = createAuthManager(context);

  // Phase 84.6: Auto-detect F0 project on activation
  const f0Config = await detectF0Project();
  if (f0Config) {
    console.log('F0 project auto-detected:', f0Config.projectName);
    // Optionally show notification
    vscode.window.showInformationMessage(
      `F0: Connected to project "${f0Config.projectName}"`
    );
  }

  // ... rest of activation
}
```

### 5. Add .f0/ to .gitignore Recommendation

When writing `.f0/project.json`, check if `.gitignore` exists and suggest adding:

```typescript
// In writeF0ProjectConfig()
const gitignorePath = path.join(rootFolder.uri.fsPath, '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  if (!gitignoreContent.includes('.f0/')) {
    const addToGitignore = await vscode.window.showInformationMessage(
      'Add .f0/ to .gitignore?',
      'Yes',
      'No'
    );

    if (addToGitignore === 'Yes') {
      fs.appendFileSync(gitignorePath, '\n# F0 Project Config\n.f0/\n');
    }
  }
}
```

---

## 📋 Testing Checklist

- [ ] Create new workspace without .f0/project.json
- [ ] Run `F0: Initialize Project`
- [ ] Verify `.f0/project.json` created with correct structure
- [ ] Open `F0: Open Assistant` - should work without "Link Project"
- [ ] Close VS Code, reopen - should auto-detect project
- [ ] Delete `.f0/project.json` - should show "Initialize Project" UI
- [ ] Test with workspace settings (legacy) - should still work
- [ ] Test priority: `.f0/project.json` overrides workspace settings

---

## 🎯 Next Steps

1. Complete remaining integration (steps 1-5 above)
2. Build extension: `npm run build`
3. Test zero-config workflow
4. Create PHASE_84_6_COMPLETE.md when done
5. Move to Phase 84.7 (Workspace Context Power-Up)

---

**Current Progress**: Core types and detection logic complete, integration pending
**Estimated Time to Complete**: 30-45 minutes
