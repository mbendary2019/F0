# Phase 75 - Step 1: GitHub API Client ✅ COMPLETE

## التاريخ
2025-11-18

## ما تم إنجازه

### 1. GitHub API Client Library
✅ **File**: `functions/src/integrations/github/client.ts`

**Features Implemented**:
- GitHub API wrapper using Octokit
- Repository operations (get repo, branches, commits)
- File operations (create, update, get file content)
- Branch management (create, list branches)
- Multi-file commits (pushFiles method)
- GitHub Actions integration (trigger workflows, get runs)
- URL parsing utility

**Key Methods**:
```typescript
class GitHubClient {
  // Repository Info
  getRepo()
  getDefaultBranch()
  getLatestCommit(branch)

  // File Operations
  createOrUpdateFile({ path, content, message, branch })
  getFileContent(path, branch)

  // Branch Management
  createBranch(newBranch, fromBranch)
  listBranches()

  // Multi-File Operations
  pushFiles({ branch, message, files[] })
  createTree(files, baseTreeSha)
  createCommit(message, treeSha, parentSha)
  updateRef(branch, sha)

  // GitHub Actions
  triggerWorkflow(workflowId, inputs)
  getWorkflowRuns(workflowId?)
}

// Utility
parseGitHubUrl(url) → { owner, repo }
```

### 2. Dependencies Installed
✅ `@octokit/rest@22.0.1` - GitHub REST API client

---

## الخطوات التالية

### Step 2: Cloud Functions Implementation

#### 2.1 Push to GitHub Function
**File**: `functions/src/integrations/github/push.ts`
```typescript
export const pushToGitHub = onCall(async (request) => {
  // 1. Verify auth & ownership
  // 2. Get project from Firestore
  // 3. Get GitHub token from integrations
  // 4. Initialize GitHubClient
  // 5. Push files using client.pushFiles()
  // 6. Update project.integrations.github.lastCommit
  // 7. Return success with commit SHA
});
```

#### 2.2 Sync from GitHub Function
**File**: `functions/src/integrations/github/sync.ts`
```typescript
export const syncFromGitHub = onCall(async (request) => {
  // 1. Verify auth & ownership
  // 2. Get project from Firestore
  // 3. Initialize GitHubClient
  // 4. Get latest commit
  // 5. Get changed files
  // 6. Return files data
  // 7. Update project.integrations.github.lastSync
});
```

#### 2.3 Create Branch Function
**File**: `functions/src/integrations/github/branch.ts`
```typescript
export const createGitHubBranch = onCall(async (request) => {
  // 1. Verify auth & ownership
  // 2. Get project from Firestore
  // 3. Initialize GitHubClient
  // 4. Create branch using client.createBranch()
  // 5. Return branch info
});
```

#### 2.4 Deploy Trigger Function
**File**: `functions/src/integrations/github/deploy.ts`
```typescript
export const triggerGitHubDeploy = onCall(async (request) => {
  // 1. Verify auth & ownership
  // 2. Get project from Firestore
  // 3. Initialize GitHubClient
  // 4. Trigger workflow using client.triggerWorkflow()
  // 5. Return success
});
```

---

## Security Considerations

### GitHub Token Storage
حالياً الـ token يتخزن في `integrations.github.accessToken` في Firestore بدون encryption.

**TODO - Security Enhancement**:
1. استخدام Cloud KMS لتشفير الـ tokens
2. أو استخدام Secret Manager
3. أو OAuth flow بدلاً من Personal Access Tokens

**Temporary Solution** (للتطوير):
- تخزين PAT مباشرة في project document
- ⚠️ **WARNING**: لا تستخدم هذا في production!

### Permissions Required
GitHub Personal Access Token يحتاج:
- `repo` (full control of private repositories)
- `workflow` (trigger workflows)

---

## Data Structure

### Project Document Update:
```typescript
{
  integrations: {
    github: {
      repoUrl: string,           // e.g., "https://github.com/user/repo"
      owner: string,             // extracted from repoUrl
      repo: string,              // extracted from repoUrl
      branch: string,            // default branch, e.g., "main"
      accessToken: string,       // GitHub PAT (⚠️ should be encrypted)

      // Metadata (updated by functions)
      lastSync: Timestamp,
      lastCommit: {
        sha: string,
        message: string,
        author: string,
        date: Timestamp
      },

      // Optional
      defaultBranch: string,
      workflowId?: string,       // e.g., "f0-agent.yml"
    }
  }
}
```

---

## Testing Plan

### Unit Tests (Optional):
```typescript
// Test parseGitHubUrl
expect(parseGitHubUrl('https://github.com/user/repo'))
  .toEqual({ owner: 'user', repo: 'repo' });

expect(parseGitHubUrl('git@github.com:user/repo.git'))
  .toEqual({ owner: 'user', repo: 'repo' });
```

### Manual Testing:
1. Create test project with GitHub repo URL
2. Add GitHub PAT to project integrations
3. Call pushToGitHub with test files
4. Verify commit appears on GitHub
5. Call syncFromGitHub
6. Verify files are returned
7. Call createGitHubBranch
8. Verify branch exists on GitHub
9. Call triggerGitHubDeploy
10. Verify GitHub Actions workflow runs

---

## Usage Example

### 1. Setup GitHub Integration
```typescript
// In Settings page, user enters:
- GitHub Repo URL: https://github.com/myuser/myrepo
- GitHub Token: ghp_xxxxxxxxxxxx

// saveProjectIntegrations() will save:
{
  integrations: {
    github: {
      repoUrl: "https://github.com/myuser/myrepo",
      owner: "myuser",
      repo: "myrepo",
      branch: "main",
      accessToken: "ghp_xxxxxxxxxxxx"
    }
  }
}
```

### 2. Push Files to GitHub
```typescript
// From F0 UI, user creates files:
// - src/index.ts
// - package.json
// - README.md

// User clicks "Push to GitHub"
// Frontend calls: pushToGitHub({
//   projectId,
//   branch: "main",
//   message: "Initial commit from F0",
//   files: [
//     { path: "src/index.ts", content: "..." },
//     { path: "package.json", content: "..." },
//     { path: "README.md", content: "..." }
//   ]
// })

// Backend:
// 1. Gets project & GitHub config
// 2. Creates GitHubClient
// 3. Calls client.pushFiles()
// 4. Updates project.integrations.github.lastCommit
// 5. Returns: { success: true, sha: "abc123", url: "..." }
```

### 3. Create Feature Branch
```typescript
// User clicks "Create Branch"
// Enters: "feature/new-auth"
// Frontend calls: createGitHubBranch({
//   projectId,
//   name: "feature/new-auth",
//   from: "main"
// })

// Backend creates branch on GitHub
// Returns: { branch: "feature/new-auth", sha: "..." }
```

### 4. Trigger Deploy
```typescript
// User clicks "Deploy"
// Frontend calls: triggerGitHubDeploy({
//   projectId,
//   workflow: "f0-agent.yml",
//   inputs: { environment: "production" }
// })

// Backend triggers GitHub Actions workflow
// Returns: { success: true }
```

---

## GitHub Actions Workflow Template

Create `.github/workflows/f0-agent.yml` in the repo:

```yaml
name: F0 Agent Deploy

on:
  repository_dispatch:
    types: [f0-deploy]
  push:
    branches:
      - main
      - 'f0/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Deploy
        run: |
          echo "Deploying to production..."
          # Add your deploy commands here
          # npm run deploy

      - name: Notify F0 (Optional)
        if: always()
        run: |
          curl -X POST https://your-f0-instance.com/api/webhooks/github \
            -H "Content-Type: application/json" \
            -d '{"status": "${{ job.status }}", "run_id": "${{ github.run_id }}"}'
```

---

## Next Steps - Priority Order

### 🔥 High Priority (Implement Next):
1. **Push Function** - Core feature for Git workflow
2. **GitHub Token Input UI** - Users need way to add PAT
3. **Push Dialog UI** - Frontend for pushing files

### 🟡 Medium Priority:
4. **Sync Function** - Pull changes from GitHub
5. **Branch Management** - Create/switch branches
6. **GitHub Actions Status** - Show workflow runs

### 🔵 Low Priority:
7. **Webhook Receiver** - Real-time updates from GitHub
8. **Pull Request Creation** - From F0 UI
9. **OAuth Flow** - Replace PAT with OAuth

---

## Files Created:
- ✅ `functions/src/integrations/github/client.ts`
- ✅ `PHASE_75_GITHUB_PUSH_PLAN.md`
- ✅ `PHASE_75_STEP1_COMPLETE.md` (this file)

## Files to Create Next:
- ⏳ `functions/src/integrations/github/push.ts`
- ⏳ `functions/src/integrations/github/sync.ts`
- ⏳ `functions/src/integrations/github/branch.ts`
- ⏳ `functions/src/integrations/github/deploy.ts`

---

## Status
🟢 **STEP 1 COMPLETE** - GitHub API Client Ready
⏳ **NEXT**: Implement Cloud Functions (Step 2)
