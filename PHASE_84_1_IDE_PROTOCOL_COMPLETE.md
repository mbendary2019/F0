# Phase 84.1: IDE Protocol & API Shape - COMPLETE ✅

**Status**: Fully Implemented
**Date**: 2025-11-18

---

## 🎯 Overview

Phase 84.1 establishes the backend API foundation for IDE integration with F0 Agent. This enables VS Code (and future IDE clients) to communicate with F0's agent pipeline, task classification, and patch generation systems.

**Key Achievement**: F0 now has a dedicated IDE API layer that VS Code extensions can use for live, context-aware code assistance.

---

## ✅ Implementation Summary

### 1. Type Definitions ✅

**File**: [src/types/ideBridge.ts](src/types/ideBridge.ts)

Created comprehensive TypeScript interfaces for IDE-F0 communication:

```typescript
export type IdeClientKind = 'vscode' | 'cursor-like';

export interface IdeSession {
  id: string;
  projectId: string;
  clientKind: IdeClientKind;
  createdAt: string;
  createdBy: string; // uid
}

export interface IdeChatRequest {
  sessionId: string;
  projectId: string;
  message: string;
  locale?: string;
  fileContext?: {
    filePath: string;
    content: string;
    languageId?: string;
    selection?: {
      startLine: number;
      startCol: number;
      endLine: number;
      endCol: number;
    };
  };
}

export interface IdeChatResponse {
  messageId: string;
  replyText: string;
  patchSuggestion?: {
    hasPatch: boolean;
    patchText?: string; // unified diff block
  };
  taskKind?: string;
}
```

**Features**:
- Client type identification (VS Code, Cursor-like)
- Session management with project association
- File context support (path, content, language, selection)
- Structured patch suggestions in unified diff format
- Task classification metadata

---

### 2. Session Management API ✅

**Endpoint**: `POST /api/ide/session`
**File**: [src/app/api/ide/session/route.ts](src/app/api/ide/session/route.ts)

**Purpose**: Create and manage IDE sessions for projects

**Request**:
```json
{
  "projectId": "project-123",
  "clientKind": "vscode"
}
```

**Response** (201):
```json
{
  "sessionId": "session-abc",
  "projectId": "project-123",
  "clientKind": "vscode"
}
```

**Features**:
- Firebase Auth token verification (Bearer token)
- Project ownership validation
- Session persistence in Firestore: `projects/{projectId}/ideSessions/{sessionId}`
- Automatic timestamp tracking (createdAt, lastActiveAt)

**Error Handling**:
- 401: Unauthorized (no token, invalid token)
- 400: Missing projectId
- 404: Project not found
- 403: Access denied (not project owner)
- 500: Internal server error

---

### 3. IDE Chat API ✅

**Endpoint**: `POST /api/ide/chat`
**File**: [src/app/api/ide/chat/route.ts](src/app/api/ide/chat/route.ts)

**Purpose**: Handle chat requests from IDE clients with full agent pipeline integration

**Request**:
```json
{
  "sessionId": "session-abc",
  "projectId": "project-123",
  "message": "Fix this authentication bug",
  "locale": "en",
  "fileContext": {
    "filePath": "src/auth/login.ts",
    "content": "...(file content)...",
    "languageId": "typescript",
    "selection": {
      "startLine": 42,
      "startCol": 0,
      "endLine": 58,
      "endCol": 0
    }
  }
}
```

**Response** (200):
```json
{
  "messageId": "msg-xyz",
  "replyText": "I found the issue in the authentication flow...",
  "patchSuggestion": {
    "hasPatch": true,
    "patchText": "--- a/src/auth/login.ts\n+++ b/src/auth/login.ts\n@@ -45,7 +45,7 @@\n..."
  },
  "taskKind": "bug_fix"
}
```

**Pipeline Integration**:

1. **Authentication & Authorization**
   - Verify Firebase Auth token
   - Validate session ownership
   - Check project access

2. **Context Loading**
   - Project brief
   - Tech stack analysis (Phase 74)
   - Project memory (Phase 75)

3. **File Context Enhancement**
   - If `fileContext` provided, prepend to message:
   ```
   File: src/auth/login.ts
   Selection (lines 42-58):
   ```typescript
   ...(selected code)...
   ```

   User request: Fix this authentication bug
   ```

4. **Task Classification** (Phase 76)
   - Uses LLM to classify task kind
   - Considers project type, features, context
   - Returns: `bug_fix`, `code_edit`, `refactor`, etc.

5. **Agent Invocation**
   - Calls `askAgent()` with full context
   - Brief, tech stack, memory, task classification
   - Language preference (locale)

6. **Patch Generation** (Phase 78-82)
   - If task kind supports patches (`shouldUsePatchMode`)
   - Calls `previewPatch()` to extract/generate unified diff
   - Returns structured patch text if available

7. **Session History**
   - Saves message to Firestore: `projects/{projectId}/ideSessions/{sessionId}/messages/{messageId}`
   - Non-blocking (errors logged but don't fail request)

**Error Handling**:
- 401: Unauthorized
- 400: Missing required fields
- 404: Session or project not found
- 403: Access denied
- 500: Internal server error

---

## 📊 Data Model

### Firestore Structure

```
projects/
  {projectId}/
    ideSessions/
      {sessionId}/
        - id: string
        - projectId: string
        - clientKind: 'vscode' | 'cursor-like'
        - createdAt: Timestamp
        - createdBy: string (uid)
        - lastActiveAt: Timestamp

        messages/
          {messageId}/
            - id: string
            - role: 'assistant'
            - text: string
            - taskKind: string
            - hasPatch: boolean
            - createdAt: Timestamp
```

**Benefits**:
- Session isolation per project
- Message history for debugging/analytics
- Last active tracking for session cleanup
- Hierarchical structure for efficient queries

---

## 🔐 Security

### Authentication
- **Bearer Token Required**: All endpoints require Firebase Auth ID token
- **Token Verification**: Uses Firebase Admin SDK `verifyIdToken()`
- **No Public Access**: All endpoints require authenticated user

### Authorization
- **Project Ownership**: Only project creator can create sessions
- **Session Ownership**: Only session creator can use that session
- **Firestore Rules**: Should enforce ownership checks (future enhancement)

### Best Practices Followed
- No sensitive data in responses
- Errors don't leak internal details
- Token validation before any operations
- Firestore security through ownership checks

---

## 🧪 Testing Guide

### Prerequisites
1. Firebase Emulators running (auth, firestore)
2. Next.js dev server on port 3030
3. Valid Firebase Auth token (from F0 web app)

### Test 1: Create IDE Session

```bash
# Get auth token from browser (F0 web app)
# Chrome DevTools -> Application -> IndexedDB -> firebaseLocalStorageDb
TOKEN="your-firebase-id-token"

curl -X POST http://localhost:3030/api/ide/session \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "your-project-id",
    "clientKind": "vscode"
  }'
```

**Expected Response**:
```json
{
  "sessionId": "abc123...",
  "projectId": "your-project-id",
  "clientKind": "vscode"
}
```

### Test 2: Send Chat Message

```bash
SESSION_ID="session-from-previous-test"
PROJECT_ID="your-project-id"

curl -X POST http://localhost:3030/api/ide/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "'$SESSION_ID'",
    "projectId": "'$PROJECT_ID'",
    "message": "What does this project do?",
    "locale": "en"
  }'
```

**Expected Response**:
```json
{
  "messageId": "msg-xyz...",
  "replyText": "Based on the project brief and analysis...",
  "taskKind": "question"
}
```

### Test 3: Chat with File Context

```bash
curl -X POST http://localhost:3030/api/ide/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "'$SESSION_ID'",
    "projectId": "'$PROJECT_ID'",
    "message": "Fix the bug in this function",
    "locale": "en",
    "fileContext": {
      "filePath": "src/index.ts",
      "content": "function hello() {\n  consol.log(\"hello\");\n}",
      "languageId": "typescript",
      "selection": {
        "startLine": 1,
        "startCol": 0,
        "endLine": 3,
        "endCol": 0
      }
    }
  }'
```

**Expected Response**:
```json
{
  "messageId": "msg-abc...",
  "replyText": "I found a typo: `consol` should be `console`...",
  "patchSuggestion": {
    "hasPatch": true,
    "patchText": "--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,3 @@\n function hello() {\n-  consol.log(\"hello\");\n+  console.log(\"hello\");\n }\n"
  },
  "taskKind": "bug_fix"
}
```

### Test 4: Verify Session in Firestore

1. Open Firestore Emulator UI: http://localhost:4000/firestore
2. Navigate to: `projects/{your-project-id}/ideSessions`
3. Verify session document exists with:
   - `createdBy`: your uid
   - `clientKind`: "vscode"
   - `createdAt`, `lastActiveAt` timestamps
4. Check `messages` subcollection for chat history

---

## 🎉 Phase 84.1 Deliverables

- [x] **Type Definitions**: `src/types/ideBridge.ts`
- [x] **Session API**: `POST /api/ide/session`
- [x] **Chat API**: `POST /api/ide/chat`
- [x] **Authentication**: Firebase Auth token verification
- [x] **Authorization**: Project and session ownership checks
- [x] **Context Integration**: Brief, tech stack, memory
- [x] **Task Classification**: LLM-based task kind detection
- [x] **Patch Generation**: Unified diff extraction for code tasks
- [x] **File Context Support**: Path, content, language, selection
- [x] **Session History**: Message persistence in Firestore
- [x] **Error Handling**: Comprehensive error responses
- [x] **Documentation**: This guide

---

## 🚀 What's Next: Phase 84.2

**VS Code Extension Skeleton**

With the backend API complete, we can now build the VS Code extension:

1. **Extension Setup**:
   - `package.json` with VS Code engine
   - Activation events
   - Commands registration

2. **Extension Architecture**:
   - Main extension file: `extension.ts`
   - Webview panel: `F0Panel.ts`
   - API client for F0 endpoints

3. **Key Commands**:
   - `F0: Open Assistant` - Opens chat panel
   - `F0: Fix Selected Code` - Sends selection to agent

4. **Webview UI**:
   - React-based chat interface
   - Message list with streaming
   - File context display
   - Patch preview/apply buttons

**File Structure**:
```
ide/vscode-f0-bridge/
├── package.json
├── tsconfig.json
├── src/
│   ├── extension.ts
│   ├── panels/
│   │   └── F0Panel.ts
│   ├── api/
│   │   └── f0Client.ts
│   └── webview/
│       ├── main.tsx
│       └── components/
│           ├── ChatPanel.tsx
│           ├── MessageList.tsx
│           └── PatchPreview.tsx
└── webpack.config.js
```

---

## 📝 Technical Notes

### Why Separate IDE Endpoints?

Instead of reusing `/api/chat`, we created dedicated IDE endpoints for:

1. **Different Auth Flow**: IDE extensions use long-lived tokens vs web sessions
2. **File Context**: IDEs send file content, selections, diagnostics
3. **Patch Optimization**: IDE clients expect structured diffs, not HTML UI
4. **Session Management**: Track IDE sessions separately from web chat
5. **Rate Limiting**: Different limits for IDE vs web (future)
6. **Analytics**: Separate tracking for IDE vs web usage

### Patch Format

The `patchText` field uses standard **unified diff format**:

```diff
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -45,7 +45,7 @@
 function validatePassword(password: string) {
-  if (password.length < 6) {
+  if (password.length < 8) {
     throw new Error('Password too short');
   }
 }
```

This format is:
- Standard across version control systems
- Parseable by VS Code APIs
- Human-readable
- Supports multi-file patches

### Performance Considerations

- **Async Operations**: All Firestore ops are non-blocking
- **Optional History**: Message saving failures don't fail requests
- **Patch Caching**: Consider caching patch results (future)
- **Token Caching**: Consider caching decoded tokens (future)

---

## 🔄 Integration Points

Phase 84.1 integrates with:

- **Phase 74**: Project Analysis (tech stack detection)
- **Phase 75**: Project Memory (context accumulation)
- **Phase 76**: Task Classification (intent detection)
- **Phase 78-82**: Patch Pipeline (generation, application, recovery)
- **Phase 83**: VFS + GitHub (for future file operations)

---

**Phase 84.1 Status**: ✅ **COMPLETE**

**Next Phase**: Phase 84.2 - VS Code Extension Skeleton

**Date**: 2025-11-18
