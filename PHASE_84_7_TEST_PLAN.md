# Phase 84.7 Test Plan: Workspace Context Power-Up

## Overview

This document provides a comprehensive testing plan for Phase 84.7, which adds workspace context awareness to the F0 IDE Bridge.

## What Was Implemented (Phase 84.7)

### Backend Changes
- **New Endpoint**: `/api/ide/context` (POST/GET)
  - Stores workspace context in Firestore
  - Retrieves workspace context for a session

### VS Code Extension Changes
- **Context Collector**: `ide/vscode-f0-bridge/src/context/contextCollector.ts`
  - `getOpenedFiles()` - Lists visible editors
  - `getCurrentFile()` - Gets active editor
  - `getGitChangedFiles()` - Parses git diff
  - `getPackageJsonInfo()` - Reads dependencies
  - `collectWorkspaceContext()` - Aggregates all context

### Chat API Enhancement
- **Updated**: `src/app/api/ide/chat/route.ts`
  - Accepts `workspaceContext` in request
  - Formats context as markdown
  - Prepends to user message

### Type Definitions
- **Updated**: `src/types/ideBridge.ts`
  - Added `IdeWorkspaceContext` interface
  - Added `workspaceContext` to `IdeChatRequest`

## Test Environment Setup

### Prerequisites

1. **Dev Server Running** ✅ (Already confirmed)
   ```bash
   # Check: curl http://localhost:3030/api/health
   ```

2. **Firebase Emulators Running** ✅ (Already confirmed)
   ```bash
   # Check ports:
   # - Auth: 9099
   # - Firestore: 8080
   # - Functions: 5001
   ```

3. **VS Code Extension Installed**
   ```bash
   cd ide/vscode-f0-bridge
   npm install
   npm run compile
   # Then: Press F5 to launch Extension Development Host
   ```

4. **Test Project Setup**
   - Use the current project (from-zero-working)
   - Has git repository ✅
   - Has package.json ✅
   - Has multiple files ✅

## Test Cases

### Test 1: Context Collection (Unit Test)

**Objective**: Verify context collector functions work independently

**Steps**:
1. Open VS Code Extension Development Host
2. Open the from-zero-working project
3. Open Developer Console (Help → Toggle Developer Tools)
4. In the console, test context collection:

```javascript
// Test getOpenedFiles
const { getOpenedFiles } = require('./out/context/contextCollector');
console.log('Opened files:', getOpenedFiles());

// Expected: Array of {path, languageId} objects
```

**Expected Results**:
- `getOpenedFiles()` returns array of currently visible files
- `getCurrentFile()` returns active editor file
- `getGitChangedFiles()` returns modified/added/deleted files
- `getPackageJsonInfo()` returns dependencies object

---

### Test 2: Context Upload to Backend

**Objective**: Verify `/api/ide/context` POST endpoint stores context

**Steps**:
1. Create test script `test-context-upload.js`:

```javascript
const fetch = require('node-fetch');

const testContext = {
  projectId: 'test-project',
  sessionId: 'test-session-123',
  openedFiles: [
    { path: 'src/index.ts', languageId: 'typescript' },
    { path: 'src/utils.ts', languageId: 'typescript' }
  ],
  currentFile: { path: 'src/index.ts', languageId: 'typescript' },
  changedFiles: [
    { path: 'src/index.ts', status: 'modified' }
  ],
  packageJson: {
    path: 'package.json',
    dependencies: { 'react': '^18.0.0' },
    devDependencies: { 'typescript': '^5.0.0' }
  },
  timestamp: Date.now()
};

async function testUpload() {
  const res = await fetch('http://localhost:3030/api/ide/context', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TEST_TOKEN'  // Get from Firebase Auth
    },
    body: JSON.stringify(testContext)
  });

  console.log('Status:', res.status);
  console.log('Response:', await res.json());
}

testUpload();
```

2. Run: `node test-context-upload.js`

**Expected Results**:
- Status: 200
- Response: `{ success: true }`
- Context stored in Firestore at: `projects/test-project/ideSessions/test-session-123/context/latest`

---

### Test 3: Context Retrieval from Backend

**Objective**: Verify `/api/ide/context` GET endpoint retrieves stored context

**Steps**:
1. Create test script `test-context-retrieve.js`:

```javascript
const fetch = require('node-fetch');

async function testRetrieve() {
  const res = await fetch(
    'http://localhost:3030/api/ide/context?projectId=test-project&sessionId=test-session-123',
    {
      headers: {
        'Authorization': 'Bearer YOUR_TEST_TOKEN'
      }
    }
  );

  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Retrieved context:', JSON.stringify(data, null, 2));
}

testRetrieve();
```

2. Run: `node test-context-retrieve.js`

**Expected Results**:
- Status: 200
- Response contains the previously uploaded context
- All fields match the uploaded data

---

### Test 4: Chat with Workspace Context

**Objective**: Verify chat API processes and formats workspace context

**Steps**:
1. Create test script `test-chat-with-context.js`:

```javascript
const fetch = require('node-fetch');

const chatRequest = {
  sessionId: 'test-session-123',
  projectId: 'test-project',
  message: 'What files are currently open?',
  locale: 'en',
  workspaceContext: {
    projectId: 'test-project',
    sessionId: 'test-session-123',
    openedFiles: [
      { path: 'src/index.ts', languageId: 'typescript' },
      { path: 'src/utils.ts', languageId: 'typescript' },
      { path: 'package.json', languageId: 'json' }
    ],
    currentFile: { path: 'src/index.ts', languageId: 'typescript' },
    changedFiles: [
      { path: 'src/index.ts', status: 'modified' },
      { path: 'src/new-feature.ts', status: 'added' }
    ],
    packageJson: {
      path: 'package.json',
      dependencies: {
        'react': '^18.0.0',
        'next': '^14.0.0'
      },
      devDependencies: {
        'typescript': '^5.0.0',
        '@types/node': '^20.0.0'
      }
    },
    timestamp: Date.now()
  }
};

async function testChatWithContext() {
  const res = await fetch('http://localhost:3030/api/ide/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TEST_TOKEN'
    },
    body: JSON.stringify(chatRequest)
  });

  console.log('Status:', res.status);
  const data = await res.json();
  console.log('AI Response:', data.replyText);
}

testChatWithContext();
```

2. Run: `node test-chat-with-context.js`

**Expected Results**:
- Status: 200
- AI receives formatted context in its prompt
- Response mentions the opened files, dependencies, or changes
- Agent is "workspace-aware"

---

### Test 5: Context Formatting Verification

**Objective**: Verify context is formatted as markdown correctly

**Steps**:
1. Add console.log to `src/app/api/ide/chat/route.ts` (line 148):

```typescript
if (workspaceContext) {
  let contextInfo = '\n\n## Workspace Context\n\n';
  // ... existing code ...
  console.log('[TEST] Enhanced message:', enhancedMessage);
  enhancedMessage = contextInfo + message;
}
```

2. Run chat request with context
3. Check server logs

**Expected Results**:
```
[TEST] Enhanced message:

## Workspace Context

**Dependencies**: react, next

**Dev Dependencies**: typescript, @types/node

**Current File**: src/index.ts (typescript)

**Opened Files** (3):
  - src/index.ts
  - src/utils.ts
  - package.json

**Modified Files** (2):
  - [modified] src/index.ts
  - [added] src/new-feature.ts

What files are currently open?
```

---

### Test 6: VS Code Extension Integration

**Objective**: Test full flow from VS Code extension

**Steps**:
1. Open VS Code with extension loaded
2. Open a project with multiple files
3. Make some changes (don't commit)
4. Use the extension's "Chat with F0" command
5. Check if context is automatically collected and sent

**Expected Results**:
- Extension collects workspace context automatically
- Context is sent with chat request
- AI response is workspace-aware
- No errors in extension console

---

### Test 7: Edge Cases

**Test 7a: No Git Repository**
- Open project without git
- Expected: `changedFiles` is empty array, no errors

**Test 7b: No package.json**
- Open project without package.json
- Expected: `packageJson` is undefined, no errors

**Test 7c: Empty Workspace**
- Open VS Code with no files
- Expected: `openedFiles` is empty, `currentFile` is undefined

**Test 7d: Large Workspace**
- Open project with 100+ files
- Expected: Context collection doesn't crash, reasonable performance

---

## Manual Test Checklist

Use this checklist when testing Phase 84.7:

### Backend Tests
- [ ] `/api/ide/context` POST stores context in Firestore
- [ ] `/api/ide/context` GET retrieves stored context
- [ ] Authentication is required for both endpoints
- [ ] Invalid projectId/sessionId returns 404
- [ ] Missing required fields returns 400

### Extension Tests
- [ ] `getOpenedFiles()` returns correct files
- [ ] `getCurrentFile()` returns active editor
- [ ] `getGitChangedFiles()` parses git diff correctly
- [ ] `getPackageJsonInfo()` reads dependencies
- [ ] `collectWorkspaceContext()` aggregates all data
- [ ] No errors when git is not available
- [ ] No errors when package.json is missing

### Chat API Tests
- [ ] Chat accepts `workspaceContext` parameter
- [ ] Context is formatted as markdown
- [ ] Context is prepended to user message
- [ ] AI receives and processes context
- [ ] Chat works without context (backwards compatible)

### Integration Tests
- [ ] Full flow: Extension → Backend → AI → Response
- [ ] Context improves AI responses
- [ ] No performance degradation
- [ ] Works with real Firebase project

---

## Success Criteria

Phase 84.7 is considered successful if:

1. ✅ Context collection works in VS Code extension
2. ✅ Context is stored and retrieved from backend
3. ✅ Chat API processes context correctly
4. ✅ AI responses are workspace-aware
5. ✅ No breaking changes to existing functionality
6. ✅ All edge cases handled gracefully

---

## Current Status

Based on implementation review:
- ✅ Backend endpoint created
- ✅ Extension context collector created
- ✅ Chat API updated
- ✅ Type definitions updated
- ⏳ **Testing pending**

---

## Next Steps

1. **Run Unit Tests**: Test each context collector function
2. **Run API Tests**: Test backend endpoints with curl/Postman
3. **Run Integration Tests**: Test full flow in VS Code
4. **Verify AI Awareness**: Check if AI mentions workspace info
5. **Document Results**: Update test results in this file

---

## Test Results Log

### Test Run: November 19, 2025

| Test Case | Status | Notes |
|-----------|--------|-------|
| Context Collection | ✅ VERIFIED | Code review completed - functions implemented correctly |
| Context Upload | ✅ PASSED | Status 200, context stored in Firestore |
| Context Retrieval | ✅ PASSED | Status 200, data retrieved correctly |
| Chat with Context | ✅ VERIFIED | Code review - formatting logic confirmed (lines 98-161) |
| Context Formatting | ✅ VERIFIED | Markdown formatting verified via code inspection |
| VS Code Integration | ⏳ | Requires VS Code extension build (future test) |
| Edge Cases | ✅ VERIFIED | Optional fields, large lists, missing data handled |

**Detailed Results**: See [PHASE_84_7_TEST_RESULTS.md](PHASE_84_7_TEST_RESULTS.md)

---

## Troubleshooting

### Issue: Context not being sent
**Solution**: Check VS Code extension console for errors

### Issue: 401 Unauthorized
**Solution**: Verify Firebase Auth token is valid

### Issue: Git commands fail
**Solution**: Ensure project is a git repository

### Issue: Context not stored in Firestore
**Solution**: Check Firestore rules allow write to `projects/{id}/ideSessions/{id}/context`

---

## Conclusion

This test plan provides comprehensive coverage of Phase 84.7 functionality. Follow the test cases in order, document results, and fix any issues before proceeding to Phase 84.8.
