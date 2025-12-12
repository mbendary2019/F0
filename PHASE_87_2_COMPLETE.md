# Phase 87.2: Code Agent Real LLM Integration + Queue Automation ✅

**Status**: Complete
**Date**: 2025-11-27

## Overview

Phase 87.2 upgrades the Code Agent from skeleton implementation (Phase 87.1) to full OpenAI integration with automated task queue execution.

---

## What Was Built

### 1. LLM Integration Infrastructure

#### `/src/lib/llm/callOpenAI.ts`
Simple wrapper for OpenAI API calls:
- Model: `gpt-4o-mini` (fast and cheap for code generation)
- Temperature: `0.2` (low for predictable code output)
- Max tokens: `4000`
- **JSON mode enforced**: `response_format: { type: 'json_object' }`

```typescript
export async function callOpenAI(messages: LLMMessage[]): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });
  // ...
}
```

#### `/src/lib/agent/prompts/codeAgentSystemPrompt.ts`
Strict system prompt that enforces JSON-only output:

```typescript
export const CODE_AGENT_SYSTEM_PROMPT = `You are a Code Agent that generates code by outputting ONLY valid JSON.

CRITICAL RULES:
1. You MUST respond with ONLY valid JSON - no explanations, no markdown, no extra text
2. Your entire response must be parseable JSON
3. Do NOT wrap JSON in markdown code blocks
4. Do NOT add any text before or after the JSON
// ... JSON schema and examples follow
`;
```

#### `/src/lib/llm/extractJsonFromText.ts`
Robust JSON extraction helper with multiple fallback strategies:
1. Extract from markdown code blocks
2. Extract first `{` to last `}`
3. Parse entire text as JSON

#### `/src/lib/llm/validateCodeAgentResponse.ts`
Validates LLM response matches `CodeAgentResponse` schema:
- Checks `summary` is non-empty string
- Validates `patches` array structure
- Ensures each patch has valid `path`, `action`, `content`

---

### 2. Updated Code Agent API

#### `/src/app/api/f0/code-agent/route.ts`
**Changes** (lines 115-143):
- Replaced skeleton code generation with real OpenAI calls
- Added JSON extraction and validation
- Stores patches in `code_patches` collection
- Sends formatted code to `agent_messages` chat
- Fallback to skeleton code if LLM fails

**Flow**:
```
User clicks "Ask Agent to implement" button
  ↓
API calls OpenAI with task details
  ↓
Extract and validate JSON response
  ↓
Store patches in code_patches collection
  ↓
Send message to agent_messages chat
  ↓
Mark task as completed
  ↓
UI updates automatically via Firestore listeners
```

---

### 3. Queue Automation System

#### `/src/app/api/f0/auto-execute-queue/route.ts` (NEW)
One-click automation endpoint that:
1. Uses Firestore transaction to atomically pick first pending `queued_action`
2. Marks it as `in_progress`
3. Executes the task with Code Agent
4. Updates task and action status
5. Sends system message to chat explaining what happened
6. Returns execution result

**Key Features**:
- Transaction-based queue picking (prevents race conditions)
- Real-time status updates via Firestore
- Comprehensive error handling
- System messages for transparency

**API Endpoint**:
```
POST /api/f0/auto-execute-queue
Body: { projectId: string }
```

#### `/src/app/api/f0/run-next-task/route.ts` (UPDATED)
**Changes** (lines 132-250):
- Replaced `setTimeout` skeleton with real Code Agent calls
- Same LLM integration as `/code-agent` endpoint
- Stores patches and sends messages
- Marks tasks as completed

---

### 4. UI Enhancements

#### `/src/app/[locale]/f0/projects/[id]/continue/page.tsx`
**Added** (lines 238-264):
- New "Run next queued task" button in header
- Auto-execute queue handler
- Loading and error states
- Bilingual support (Arabic/English)

**Button Features**:
- Green gradient styling (distinct from purple Code Agent button)
- Shows "Executing..." state during processing
- Displays error messages if execution fails
- Real-time updates via Firestore listeners

---

## Technical Improvements

### 1. Fixed Collection Name Mismatch
**Issue**: Messages not appearing in chat
**Root Cause**: API wrote to `messages`, UI read from `agent_messages`
**Fix**: Updated API to write to `agent_messages` (lines 89, 141 in `code-agent/route.ts`)

### 2. Fixed JSON Extraction Failure
**Issue**: LLM returned text instead of pure JSON
**Root Cause**: OpenAI not enforcing JSON mode
**Fix**:
- Added `response_format: { type: 'json_object' }` to API call
- Strengthened system prompt with explicit JSON-only rules
- Created robust extraction helper with fallbacks

### 3. Atomic Queue Operations
**Feature**: Firestore transactions for queue picking
**Benefit**: Prevents race conditions when multiple users/processes access queue
**Code**:
```typescript
await adminDb.runTransaction(async (transaction) => {
  const pendingQuery = await transaction.get(
    actionsRef
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(1)
  );
  // Mark as in_progress atomically
});
```

---

## Files Created

1. ✅ `/src/lib/llm/callOpenAI.ts` - OpenAI API wrapper
2. ✅ `/src/lib/agent/prompts/codeAgentSystemPrompt.ts` - System prompt
3. ✅ `/src/lib/llm/extractJsonFromText.ts` - JSON extraction helper
4. ✅ `/src/lib/llm/validateCodeAgentResponse.ts` - Response validator
5. ✅ `/src/app/api/f0/auto-execute-queue/route.ts` - Queue automation endpoint
6. ✅ `/test-phase87-2-queue-automation.ts` - Test script

## Files Modified

1. ✅ `/src/app/api/f0/code-agent/route.ts` - Real LLM integration
2. ✅ `/src/app/api/f0/run-next-task/route.ts` - Replace skeleton with Code Agent
3. ✅ `/src/app/[locale]/f0/projects/[id]/continue/page.tsx` - Add queue button

---

## Testing

### Test Script: `test-phase87-2-queue-automation.ts`

**What it tests**:
1. Seeds test project with tasks and queued_actions
2. Calls `/api/f0/auto-execute-queue`
3. Verifies task execution and status updates
4. Checks agent_messages for system notifications
5. Verifies code_patches stored in Firestore
6. Cleans up test data

**Run with**:
```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm tsx test-phase87-2-queue-automation.ts
```

---

## How to Use

### Manual Task Execution
1. Go to Continue page: `/[locale]/f0/projects/[id]/continue`
2. Select a task from the list
3. Click "🤖 Ask Agent to implement this task"
4. Watch real-time updates in chat panel
5. Code patches appear in Firestore

### Automated Queue Execution
1. Go to Continue page
2. Click "⚡ Run next queued task" button in header
3. System picks first pending task from queue
4. Executes it automatically
5. Updates appear in real-time via Firestore listeners

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Continue Page (UI)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Phases Panel │  │ Tasks Panel  │  │ Chat Panel   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↑                 ↑                   ↑              │
│         └─────────────────┴───────────────────┘              │
│                  Firestore Listeners                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Firestore Collections                       │
│  • projects/{id}/phases                                      │
│  • projects/{id}/tasks                                       │
│  • projects/{id}/queued_actions                             │
│  • projects/{id}/code_patches                               │
│  • projects/{id}/agent_messages                             │
└─────────────────────────────────────────────────────────────┘
                            ↑
                            │
                    ┌───────┴────────┐
                    │                │
┌───────────────────┴─────┐  ┌──────┴──────────────────────┐
│ /api/f0/code-agent      │  │ /api/f0/auto-execute-queue  │
│                         │  │                             │
│ • Manual execution      │  │ • Auto queue picking        │
│ • Task-specific         │  │ • One-click automation      │
│ • Real-time updates     │  │ • Transaction-based         │
└─────────────┬───────────┘  └──────────┬──────────────────┘
              │                         │
              └────────┬────────────────┘
                       ↓
          ┌────────────────────────┐
          │   LLM Infrastructure   │
          │                        │
          │  • callOpenAI()        │
          │  • System Prompt       │
          │  • JSON Extraction     │
          │  • Response Validation │
          └────────────┬───────────┘
                       ↓
              ┌────────────────┐
              │  OpenAI API    │
              │  gpt-4o-mini   │
              │  JSON mode     │
              └────────────────┘
```

---

## What's Next

Phase 87.2 is complete. The Code Agent now has:
- ✅ Real LLM integration (OpenAI)
- ✅ Automated queue execution
- ✅ Real-time UI updates
- ✅ Comprehensive error handling
- ✅ Test coverage

**Potential Next Steps**:
1. **Phase 87.3**: Apply patches to GitHub VFS
2. **Phase 87.4**: Vercel deployment automation
3. **Phase 87.5**: Live preview integration
4. **Phase 88**: Code review and iteration loop

---

## Summary

Phase 87.2 transforms the Code Agent from a skeleton to a fully functional AI-powered code generation system with:

- **Real AI**: OpenAI GPT-4o-mini generates actual code
- **JSON-enforced**: Structured output guaranteed
- **Automated Queue**: One-click execution of pending tasks
- **Real-time Updates**: Firestore listeners keep UI in sync
- **Production Ready**: Error handling, fallbacks, and comprehensive logging

The system is now ready for testing and integration with the rest of the F0 platform! 🚀
