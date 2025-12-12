# 🟣 PHASE 107 — Context-Aware Code Generation (Complete)

**Status:** ✅ Completed
**Scope:** Context-aware code generation with refactor vs generate mode detection
**Date:** 2025-11-27

---

## 🎯 Goal

Enhance F0's OpenAI-compatible API to understand workspace context from Continue.dev and other IDEs:

- **Distinguish between REFACTOR mode** (user selected code → modify existing code)
- **Distinguish between GENERATE mode** (no selection → create new code)
- **Support file context** (current file, open files, selection)
- **Normalize context** from multiple input formats (Phase 106 legacy + Phase 107 new format)

---

## ✅ What Was Implemented

### 1) New Context Types (`src/types/context.ts`)

Created comprehensive type definitions for workspace context:

```typescript
// Selection within a file (character positions)
export type F0Selection = {
  start: number;
  end: number;
  text?: string;
};

// File context from IDE
export type F0ContextFile = {
  path: string;
  content: string;
  languageId?: string;
  isOpen?: boolean;
  selection?: F0Selection | null;
};

// Complete workspace context
export type F0WorkspaceContext = {
  currentFile?: F0ContextFile;  // Primary file being edited
  openFiles?: F0ContextFile[];  // Additional context files
  workspaceRoot?: string;
  projectType?: string;
};

// Code generation mode enum
export enum CodeGenerationMode {
  REFACTOR = 'REFACTOR',  // User selected code → modify existing
  GENERATE = 'GENERATE',  // No selection → create new code
  UNKNOWN = 'UNKNOWN',
}
```

**Helper Functions:**
- `inferGenerationMode(context)` - Detects REFACTOR vs GENERATE based on selection presence
- `extractSelectionText(content, selection)` - Extracts selected text from file content

---

### 2) Updated OpenAI Request Types (`src/types/openaiCompat.ts`)

Added `fz_context` field to support Phase 107 workspace context:

```typescript
export interface F0ChatCompletionRequest {
  // Standard OpenAI fields
  model?: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;

  // Phase 106: Legacy file context
  files?: {
    path: string;
    content: string;
    languageId?: string;
    isOpen?: boolean;
  }[];

  // Phase 107: Workspace context (new format)
  fz_context?: F0WorkspaceContext;
}
```

---

### 3) Updated IDE Bridge Types (`src/types/ideBridge.ts`)

Enhanced `IdeChatRequest` with Phase 107 fields:

```typescript
export interface IdeChatRequest {
  sessionId: string;
  projectId: string;
  message: string;

  // ... existing fields ...

  // Phase 107: Context-aware fields
  primaryFilePath?: string;           // Main file being edited
  selection?: F0Selection;            // Selection in primary file
  contextFiles?: F0ContextFile[];     // Enhanced file context
}
```

---

### 4) Context Normalization Layer (`src/lib/agent/context/normalizeContext.ts`)

Created unified context extraction from multiple formats:

**Key Functions:**

```typescript
// Extract context from OpenAI request (supports fz_context and legacy files)
export function buildFileContextFromOpenAIRequest(
  req: F0ChatCompletionRequest
): {
  contextFiles: F0ContextFile[];
  primaryFilePath?: string;
  workspaceContext?: F0WorkspaceContext;
}

// Extract context from IDE chat request
export function buildFileContextFromIdeChatRequest(
  req: IdeChatRequest
): {
  contextFiles: F0ContextFile[];
  primaryFilePath?: string;
}

// Create minimal workspace context from file list
export function createMinimalWorkspaceContext(
  contextFiles: F0ContextFile[],
  primaryFilePath?: string
): F0WorkspaceContext | undefined
```

**Backward Compatibility:**
- ✅ Supports Phase 106 `files` format
- ✅ Supports Phase 107 `fz_context` format
- ✅ Prefers new format when both are provided

---

### 5) Updated Bridge Layer (`src/lib/agent/code/fromOpenAICompat.ts`)

Integrated context normalization into OpenAI→IDE chat mapping:

```typescript
export function mapOpenAIRequestToIdeChat(body: F0ChatCompletionRequest): IdeChatRequest {
  // ... existing prompt extraction ...

  // Phase 107: Extract context using normalization layer
  const { contextFiles, primaryFilePath, workspaceContext } =
    buildFileContextFromOpenAIRequest(body);

  // Extract selection from workspace context (if any)
  const selection = workspaceContext?.currentFile?.selection ?? undefined;

  return {
    projectId: body.projectId ?? 'default',
    sessionId: body.workspaceId ?? `continue-${Date.now()}`,

    // Phase 107: New context format
    contextFiles: contextFiles.length > 0 ? contextFiles : undefined,
    primaryFilePath,
    selection,

    // Phase 106: Legacy file context (for backward compatibility)
    fileContext: (body.files ?? []).map((f) => ({
      path: f.path,
      content: f.content,
      languageId: f.languageId ?? 'typescript',
      selection: null,
      isOpen: f.isOpen ?? true,
    })),

    // Store workspace context in metadata
    metadata: {
      source: 'openai_compat',
      originalMessages: body.messages,
      workspaceContext,
    },
  };
}
```

---

### 6) Enhanced IDE Chat Runner (`src/lib/agent/code/runIdeChat.ts`)

Implemented mode-based code generation:

**Key Changes:**

```typescript
export async function runIdeChat(req: IdeChatRequest): Promise<IdeChatResponse> {
  const userInput = (req.input ?? req.prompt ?? req.message ?? '').toString().trim();

  // Phase 107: Extract context using normalization layer
  const { contextFiles, primaryFilePath } = buildFileContextFromIdeChatRequest(req);

  // Phase 107: Create workspace context for mode detection
  const workspaceContext = createMinimalWorkspaceContext(contextFiles, primaryFilePath);

  // Phase 107: Determine generation mode (REFACTOR vs GENERATE)
  const generationMode = inferGenerationMode(workspaceContext);

  // Phase 107: Build task description based on mode
  let enhancedUserInput = userInput;
  if (generationMode === CodeGenerationMode.REFACTOR && primaryFilePath) {
    enhancedUserInput = `Refactor code in ${primaryFilePath}:\n${userInput}`;
  }

  // Phase 107: Build existing files map from context
  const existingFiles: Record<string, string> = {};
  for (const file of contextFiles) {
    existingFiles[file.path] = file.content;
  }

  // Call code generator with mode-aware params
  const result = await runCodeGeneratorAgent({
    projectId: req.projectId,
    userId: 'continue-user',
    userInput: enhancedUserInput,  // Enhanced with mode-specific prefix
    task: decomposedTask,
    architectPlan: {
      role: 'ARCHITECT',
      projectId: req.projectId,
      summary: generationMode === CodeGenerationMode.REFACTOR
        ? 'Refactor existing code based on user request'
        : 'Generate new code based on user request',
      // ... other fields ...
    },
    fileTree: contextFiles.map(f => f.path),
    existingFiles,
  });

  // ... rest of response building ...
}
```

**Debug Logging:**

```typescript
if (process.env.NODE_ENV !== 'production') {
  console.log('[F0::DEBUG] runIdeChat request:', {
    generationMode,        // REFACTOR or GENERATE
    primaryFilePath,       // Main file path
    hasSelection,          // Selection presence
    hasContextFiles,       // New context format
  });
}
```

---

## 📊 Before vs After

### 🔴 Before Phase 107

**Context Handling:**
- ❌ No distinction between refactor and generate modes
- ❌ Single format support (Phase 106 `files` only)
- ❌ No primary file concept
- ❌ No selection awareness

**User Experience:**
- User selects code in Continue → F0 treats it as "generate new code"
- No context about which file is being edited
- Cannot distinguish between "modify this" vs "create new"

---

### 🟢 After Phase 107

**Context Handling:**
- ✅ Automatic REFACTOR vs GENERATE mode detection
- ✅ Multi-format support (Phase 106 + Phase 107)
- ✅ Primary file tracking
- ✅ Selection-aware code generation

**User Experience:**
- User selects code → F0 detects REFACTOR mode → modifies selected code
- User no selection → F0 detects GENERATE mode → creates new code
- Context includes current file + open files
- Better code generation based on workspace context

---

## 🧪 Testing

### Test 1: Generate Mode (No Selection)

**Request:**
```json
{
  "model": "f0-code-agent",
  "messages": [
    {"role": "user", "content": "Create a React login form"}
  ],
  "fz_context": {
    "currentFile": {
      "path": "src/components/NewComponent.tsx",
      "content": ""
    }
  }
}
```

**Expected Behavior:**
- ✅ Mode: `GENERATE`
- ✅ Creates new login form component
- ✅ Targets: `src/components/NewComponent.tsx`

---

### Test 2: Refactor Mode (With Selection)

**Request:**
```json
{
  "model": "f0-code-agent",
  "messages": [
    {"role": "user", "content": "Add TypeScript types to this function"}
  ],
  "fz_context": {
    "currentFile": {
      "path": "src/utils/helpers.ts",
      "content": "function add(a, b) { return a + b; }",
      "selection": {
        "start": 0,
        "end": 38
      }
    }
  }
}
```

**Expected Behavior:**
- ✅ Mode: `REFACTOR`
- ✅ Modifies existing `add` function
- ✅ Adds TypeScript types: `function add(a: number, b: number): number`

---

### Test 3: Backward Compatibility (Phase 106 Format)

**Request:**
```json
{
  "model": "f0-code-agent",
  "messages": [
    {"role": "user", "content": "Create a button component"}
  ],
  "files": [
    {
      "path": "src/components/Button.tsx",
      "content": "",
      "languageId": "typescript"
    }
  ]
}
```

**Expected Behavior:**
- ✅ Mode: `GENERATE` (no selection in legacy format)
- ✅ Uses legacy `files` format
- ✅ Creates button component

---

## 🧠 Implementation Details

### Mode Detection Logic

```typescript
export function inferGenerationMode(context?: F0WorkspaceContext): CodeGenerationMode {
  if (!context || !context.currentFile) {
    return CodeGenerationMode.UNKNOWN;
  }

  const { currentFile } = context;

  // If there's a selection with meaningful range, it's refactor mode
  if (
    currentFile.selection &&
    currentFile.selection.start < currentFile.selection.end
  ) {
    return CodeGenerationMode.REFACTOR;
  }

  // Otherwise, it's generation mode (create new code)
  return CodeGenerationMode.GENERATE;
}
```

**Key Points:**
- Selection presence → `REFACTOR`
- No selection → `GENERATE`
- No context → `UNKNOWN` (fallback to old behavior)

---

### Context Priority (Format Preference)

```typescript
// In buildFileContextFromOpenAIRequest()

// 1. Phase 107: New context format (preferred)
if (req.fz_context) {
  return buildFromWorkspaceContext(req.fz_context);
}

// 2. Phase 106: Legacy files format (fallback)
if (req.files && req.files.length > 0) {
  return buildFromLegacyFiles(req.files);
}

// 3. No context provided
return { contextFiles: [], primaryFilePath: undefined };
```

---

## 📝 Files Modified/Created

| File | Status | Purpose |
|------|--------|---------|
| [src/types/context.ts](src/types/context.ts) | ✅ Created | Context types + mode detection |
| [src/types/openaiCompat.ts](src/types/openaiCompat.ts) | ✅ Updated | Added `fz_context` field |
| [src/types/ideBridge.ts](src/types/ideBridge.ts) | ✅ Updated | Added Phase 107 fields |
| [src/lib/agent/context/normalizeContext.ts](src/lib/agent/context/normalizeContext.ts) | ✅ Created | Context normalization layer |
| [src/lib/agent/code/fromOpenAICompat.ts](src/lib/agent/code/fromOpenAICompat.ts) | ✅ Updated | Integrated context extraction |
| [src/lib/agent/code/runIdeChat.ts](src/lib/agent/code/runIdeChat.ts) | ✅ Updated | Mode-based generation logic |

---

## 🔐 Backward Compatibility

Phase 107 is **100% backward compatible** with Phase 106:

✅ **Legacy `files` format still works**
✅ **Old Continue configs work without changes**
✅ **Gradual migration path** (can mix both formats)
✅ **No breaking changes to existing code**

---

## 🚀 What's Next? (Future Enhancements)

### Phase 107.1: Selection Text Extraction

- Actually extract selected text from file content
- Pass selected text to LLM for more precise refactoring
- Support line-based selection (not just character positions)

### Phase 107.2: Multi-File Refactoring

- Support refactoring across multiple files
- Track dependencies between files
- Generate coordinated changes

### Phase 107.3: Project Type Detection

- Auto-detect Next.js, React, Node.js, etc.
- Use project type for better code generation
- Apply framework-specific best practices

---

## 🎯 Usage Examples

### Example 1: Continue.dev with New Context Format

**Continue Config** (future version):
```yaml
models:
  - name: f0-code-agent
    provider: openai
    model: f0-code-agent
    apiBase: http://localhost:3030/api/openai_compat/v1
    apiKey: "YOUR_API_KEY"
    # Phase 107: Enable workspace context
    workspaceContext: true
```

**Request (auto-generated by Continue):**
```json
{
  "model": "f0-code-agent",
  "messages": [{"role": "user", "content": "Add error handling"}],
  "fz_context": {
    "currentFile": {
      "path": "src/api/users.ts",
      "content": "export async function getUser(id: string) {...}",
      "selection": {"start": 0, "end": 100}
    },
    "openFiles": [
      {"path": "src/types/user.ts", "content": "export type User = {...}"}
    ]
  }
}
```

---

### Example 2: Direct API Call (CURL)

```bash
curl -X POST http://localhost:3030/api/openai_compat/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "f0-code-agent",
    "messages": [
      {"role": "user", "content": "Refactor this to use async/await"}
    ],
    "fz_context": {
      "currentFile": {
        "path": "src/utils/fetchData.ts",
        "content": "function fetchData() { return fetch(...).then(...) }",
        "selection": {"start": 0, "end": 60}
      }
    }
  }'
```

---

## 🟢 Phase 107 — Final Evaluation

| Criteria | Status | Notes |
|----------|--------|-------|
| Context Types Created | ✅ | `F0Selection`, `F0ContextFile`, `F0WorkspaceContext` |
| OpenAI Types Updated | ✅ | Added `fz_context` field |
| IDE Bridge Types Updated | ✅ | Added `primaryFilePath`, `selection`, `contextFiles` |
| Normalization Layer | ✅ | Handles both Phase 106 and Phase 107 formats |
| Bridge Layer Updated | ✅ | Uses normalization for context extraction |
| IDE Chat Runner Updated | ✅ | Mode-based generation implemented |
| Backward Compatibility | ✅ | 100% compatible with Phase 106 |
| Debug Logging | ✅ | Logs generation mode and context info |
| **Overall Phase Status** | ✅ **COMPLETE** | Context-aware code generation ready! |

---

## 🎉 Conclusion

**Phase 107 is complete!**

### Summary of Achievements

- ✅ **Context-Aware Generation**: Detects REFACTOR vs GENERATE modes
- ✅ **Multi-Format Support**: Handles Phase 106 + Phase 107 formats
- ✅ **Normalization Layer**: Unified context extraction
- ✅ **Primary File Tracking**: Knows which file is being edited
- ✅ **Selection Awareness**: Uses selection for mode detection
- ✅ **Backward Compatible**: No breaking changes
- ✅ **Debug Visibility**: Enhanced logging for troubleshooting

### Impact on F0 Platform

**Before Phase 107:**
- All requests treated as "generate new code"
- No context about user's intent (refactor vs generate)
- Single context format (Phase 106 `files`)

**After Phase 107:**
- Smart mode detection based on selection
- Workspace-aware code generation
- Flexible context formats
- Better code generation aligned with user intent

---

**Phase 107 Complete** ✅
**F0 now understands workspace context and adapts code generation to user intent!** 🚀

Continue.dev users can now select code to refactor it, or work without selection to generate new code!

---

## 📚 Related Documentation

- [PHASE_106_OPENAI_COMPAT_COMPLETE.md](PHASE_106_OPENAI_COMPAT_COMPLETE.md) - OpenAI API infrastructure
- [PHASE_106_1_CODE_QUALITY_COMPLETE.md](PHASE_106_1_CODE_QUALITY_COMPLETE.md) - Code quality improvements
- [PHASE_106_2_FALLBACK_COMPLETE.md](PHASE_106_2_FALLBACK_COMPLETE.md) - Fallback generator system
- [PHASE_106_3_CONTINUE_INTEGRATION_COMPLETE.md](PHASE_106_3_CONTINUE_INTEGRATION_COMPLETE.md) - Continue.dev setup
- [PHASE_106_QUICK_START.md](PHASE_106_QUICK_START.md) - Quick start guide

---

**Next Phase:** Phase 108 (Streaming Support) or Phase 107.1 (Selection Text Extraction)
