# Phase 75: GitHub Push & Actions Integration

## الهدف
ربط F0 بـ GitHub بشكل كامل مع إمكانية Push و Sync و Deploy تلقائي.

## الخطوات

### Part 1: Backend - Cloud Functions

#### 1. Push to GitHub
- **Function**: `pushToGitHub`
- **Location**: `functions/src/integrations/github/push.ts`
- **Features**:
  - إنشاء/تحديث branch جديد
  - Push files من F0 إلى GitHub
  - Create commit with message
  - Support for multiple files

#### 2. Sync from GitHub
- **Function**: `syncFromGitHub`
- **Location**: `functions/src/integrations/github/sync.ts`
- **Features**:
  - Pull latest changes من GitHub
  - Update project files في F0
  - Detect conflicts

#### 3. Create Branch
- **Function**: `createGitHubBranch`
- **Location**: `functions/src/integrations/github/branch.ts`
- **Features**:
  - إنشاء branch جديد من base branch
  - تلقائي naming (f0/feature-*, f0/agent-*)

#### 4. Deploy Trigger
- **Function**: `triggerGitHubDeploy`
- **Location**: `functions/src/integrations/github/deploy.ts`
- **Features**:
  - Trigger GitHub Actions workflow
  - Repository dispatch event
  - Pass custom payload

### Part 2: GitHub API Integration

#### Setup Required:
```typescript
// GitHub Personal Access Token (PAT) or GitHub App
// Stored in: ops_projects/{id}.integrations.github.accessToken (encrypted)

// Permissions needed:
- repo (full control)
- workflow (trigger workflows)
```

#### GitHub Actions Workflow Template:
```yaml
# .github/workflows/f0-agent.yml
name: F0 Agent Deploy

on:
  repository_dispatch:
    types: [f0-deploy]
  push:
    branches:
      - main
      - 'f0/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
      - name: Install & Build
        run: |
          npm install
          npm run build
      - name: Deploy
        run: npm run deploy
```

### Part 3: Frontend UI

#### 1. GitHub Integration Card (Project Page)
- **Location**: `src/app/[locale]/projects/[id]/page.tsx`
- **Features**:
  - Show connected repo
  - Show last commit
  - Show branch info
  - Quick actions: Push, Sync, Deploy

#### 2. GitHub Actions Status
- **Location**: `src/components/github/ActionsStatus.tsx`
- **Features**:
  - Show workflow runs
  - Show status (pending, success, failed)
  - Link to GitHub Actions page

#### 3. Push Dialog
- **Location**: `src/components/github/PushDialog.tsx`
- **Features**:
  - Commit message input
  - Branch selector
  - File changes preview
  - Push button

### Part 4: API Routes

#### 1. `/api/projects/[projectId]/github/push`
```typescript
POST /api/projects/{projectId}/github/push
Body: {
  branch: string,
  message: string,
  files: { path: string, content: string }[]
}
```

#### 2. `/api/projects/[projectId]/github/sync`
```typescript
GET /api/projects/{projectId}/github/sync
Response: {
  latestCommit: string,
  files: { path: string, content: string }[]
}
```

#### 3. `/api/projects/[projectId]/github/create-branch`
```typescript
POST /api/projects/{projectId}/github/create-branch
Body: {
  name: string,
  from: string
}
```

#### 4. `/api/projects/[projectId]/github/deploy`
```typescript
POST /api/projects/{projectId}/github/deploy
Body: {
  workflow: string,
  inputs?: Record<string, any>
}
```

## Data Structure

### Project Schema Update:
```typescript
{
  integrations: {
    github: {
      repoUrl: string,
      owner: string,      // e.g., "username"
      repo: string,       // e.g., "my-repo"
      branch: string,     // default: "main"
      accessToken?: string, // encrypted
      lastSync?: Timestamp,
      lastCommit?: {
        sha: string,
        message: string,
        author: string,
        date: Timestamp
      }
    }
  }
}
```

## Security

### 1. Token Storage:
- Store GitHub tokens encrypted in Firestore
- Use Cloud Functions to decrypt
- Never expose tokens to client

### 2. Permissions:
- Verify project ownership before GitHub operations
- Rate limit GitHub API calls
- Log all GitHub operations for audit

### 3. Webhook Security:
- Verify GitHub webhook signatures
- Validate payload structure

## Implementation Order

### Step 1: GitHub Token Setup ✅ (Already Done)
- [x] `saveProjectIntegrations` function
- [x] Store `githubRepoUrl` in project

### Step 2: GitHub API Utilities
- [ ] Create GitHub API client wrapper
- [ ] Add authentication helpers
- [ ] Add rate limiting

### Step 3: Push Functionality
- [ ] Backend: `pushToGitHub` function
- [ ] API route: `/api/projects/[id]/github/push`
- [ ] Frontend: Push dialog UI

### Step 4: Sync Functionality
- [ ] Backend: `syncFromGitHub` function
- [ ] API route: `/api/projects/[id]/github/sync`
- [ ] Frontend: Sync button

### Step 5: Branch Management
- [ ] Backend: `createGitHubBranch` function
- [ ] API route: `/api/projects/[id]/github/create-branch`
- [ ] Frontend: Branch selector

### Step 6: GitHub Actions Integration
- [ ] Backend: `triggerGitHubDeploy` function
- [ ] API route: `/api/projects/[id]/github/deploy`
- [ ] Frontend: Deploy button + status

### Step 7: Webhook Handling
- [ ] Backend: GitHub webhook receiver
- [ ] Handle push events
- [ ] Handle workflow events
- [ ] Update project status

## Testing Plan

### Manual Testing:
1. Connect GitHub repo
2. Create test files in F0
3. Push to GitHub
4. Verify commit appears on GitHub
5. Make changes on GitHub
6. Sync to F0
7. Trigger deploy
8. Verify GitHub Actions runs

### Automated Testing:
- Unit tests for GitHub API wrapper
- Integration tests for push/sync
- E2E tests for full workflow

## Future Enhancements

### Phase 75.1: Pull Requests
- Create PR from F0
- Review PR status
- Merge PR from F0

### Phase 75.2: GitHub Issues
- Create issues from F0
- Link tasks to issues
- Sync issue status

### Phase 75.3: GitHub Discussions
- Create discussions
- Comment on discussions

### Phase 75.4: Multiple Repo Support
- Support monorepos
- Support multiple repos per project

## Resources

- GitHub REST API: https://docs.github.com/rest
- GitHub Actions API: https://docs.github.com/rest/actions
- Octokit (GitHub SDK): https://github.com/octokit/octokit.js

## Status
🟡 **PLANNING** - Ready to implement Step 2
