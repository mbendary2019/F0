# ✅ Phase 85.4 - Analysis-Driven Workspace Planning - COMPLETE

**Status**: ✅ Fully Implemented
**Date**: 2025-11-20

---

## 📋 Overview

Phase 85.4 integrates **Phase 85.3 Project Dependency Analysis** with **Phase 85.1 Workspace Planning** to create **analysis-aware planning**. The workspace planner now uses static analysis data (core files, god files, cycles, issues) to generate smarter, more informed refactoring plans.

---

## 🎯 What Changed

### 1. **Extended Workspace Planner Types**
**File**: [src/lib/ide/workspacePlanner.ts:24](src/lib/ide/workspacePlanner.ts#L24)

Added `projectAnalysis` parameter to planner input:

```typescript
interface WorkspacePlannerInput {
  goal: string;
  workspaceContext?: IdeWorkspaceContext;
  locale?: string;
  projectId?: string;
  brief?: string;
  techStack?: any;
  memory?: any;
  // Phase 85.4: Analysis-aware planning
  projectAnalysis?: IdeProjectAnalysisDocument | null;
}
```

### 2. **Built Analysis Context Summary Helper**
**File**: [src/lib/ide/workspacePlanner.ts:27-82](src/lib/ide/workspacePlanner.ts#L27-L82)

Created helper function to convert analysis document into structured text for AI:

```typescript
function buildAnalysisContextSummary(
  analysis?: IdeProjectAnalysisDocument | null
): string {
  // Returns formatted summary with:
  // - File/dependency counts
  // - Top 5 core files (high fan-in)
  // - Top 5 god files (high fan-out)
  // - First 3 detected cycles
  // - Top 8 issues with severity
}
```

### 3. **Enhanced System Prompt**
**File**: [src/lib/ide/workspacePlanner.ts:93-110](src/lib/ide/workspacePlanner.ts#L93-L110)

Updated AI instructions to use analysis data:

```typescript
const systemPrompt = `
You are the F0 Workspace Planner.
...
Rules:
...
- If project dependency analysis is provided, USE IT to inform your plan:
  * Prioritize fixing circular dependencies
  * Be careful with "core files" (high fan-in) - changes may affect many files
  * Consider refactoring "god files" (high fan-out) to reduce complexity
  * Address reported issues by severity
...
`;
```

### 4. **Injected Analysis into User Prompt**
**File**: [src/lib/ide/workspacePlanner.ts:159-164](src/lib/ide/workspacePlanner.ts#L159-L164)

Analysis summary is now added to every planning request:

```typescript
// Build user prompt with workspace context
let userPrompt = `User goal:\n${goal}\n\n`;

// Phase 85.4: Inject analysis summary
const analysisSummary = buildAnalysisContextSummary(projectAnalysis);
userPrompt += analysisSummary;
```

### 5. **Added Analysis Helpers to API Route**
**File**: [src/app/api/ide/chat/route.ts:20-27](src/app/api/ide/chat/route.ts#L20-L27)

Imported analysis storage and graph building functions:

```typescript
import {
  loadProjectAnalysis,
  saveProjectAnalysis,
} from '@/lib/ide/projectAnalysisStore';
import {
  buildDependencyGraph,
  analyzeDependencyGraph,
} from '@/lib/ide/dependencyGraph';
```

### 6. **Created `getOrBuildProjectAnalysis()` Helper**
**File**: [src/app/api/ide/chat/route.ts:32-75](src/app/api/ide/chat/route.ts#L32-L75)

Smart helper that loads cached analysis or builds fresh:

```typescript
async function getOrBuildProjectAnalysis(
  projectId: string,
  workspaceContext?: any
): Promise<IdeProjectAnalysisDocument | null> {
  // 1. Try to load cached analysis from Firestore
  const cached = await loadProjectAnalysis(projectId);
  if (cached) return cached;

  // 2. Build fresh analysis from workspace files
  const files = workspaceContext.openedFiles.map(...);
  const graph = buildDependencyGraph(files);
  const analysis = analyzeDependencyGraph(projectId, graph);

  // 3. Save for future use
  await saveProjectAnalysis(projectId, analysis);

  return analysis;
}
```

### 7. **Integrated Analysis into Multi-File Mode**
**File**: [src/app/api/ide/chat/route.ts:165-178](src/app/api/ide/chat/route.ts#L165-L178)

Multi-file planning now uses analysis:

```typescript
if ((mode === 'multi-file-plan' || mode === 'multi-file-apply') && workspaceContext) {
  console.log(`[IDE Chat] Phase 85.1: Multi-file mode detected: ${mode}`);

  // Phase 85.4: Get or build project analysis
  const projectAnalysis = await getOrBuildProjectAnalysis(projectId, workspaceContext);

  // Step 1: Generate workspace plan with analysis context
  const plan = await planWorkspaceChanges({
    goal: message,
    workspaceContext,
    locale,
    projectId,
    brief,
    techStack,
    memory,
    projectAnalysis, // Phase 85.4: Pass analysis to planner
  });

  // ...
}
```

---

## 🔄 How It Works

### Analysis-Aware Planning Flow

```
┌─────────────────────────────────┐
│ User triggers multi-file plan   │
│ (from Web IDE or VS Code)       │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ API Route: /api/ide/chat        │
│ Mode: multi-file-plan/apply     │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ getOrBuildProjectAnalysis()     │
│ ├─ Try load from Firestore      │
│ ├─ If not found, build fresh    │
│ └─ Cache result                 │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ planWorkspaceChanges()          │
│ ├─ Receive projectAnalysis      │
│ ├─ Build analysis summary       │
│ ├─ Inject into prompts          │
│ └─ AI generates smart plan      │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Return plan with steps that:    │
│ ✓ Fix cycles first              │
│ ✓ Handle core files carefully   │
│ ✓ Refactor god files            │
│ ✓ Address issues by severity    │
└─────────────────────────────────┘
```

---

## 📊 Analysis Context Example

When AI receives a planning request, it now sees rich analysis data:

```
User goal:
Refactor authentication to use JWT tokens

=== PROJECT DEPENDENCY ANALYSIS ===
Files: 45, Dependencies: 123, Issues: 8

**Core Files (Top Fan-In)**:
  - src/lib/auth.ts (↑ 12 dependents)
  - src/middleware/checkAuth.ts (↑ 8 dependents)
  - src/types/user.ts (↑ 7 dependents)

**God Files (Top Fan-Out)**:
  - src/pages/api/auth/login.ts (↓ 15 dependencies)
  - src/lib/db.ts (↓ 12 dependencies)

**Circular Dependencies Detected**:
  1. src/lib/auth.ts → src/lib/session.ts → src/lib/auth.ts
  2. src/components/Header.tsx → src/hooks/useAuth.ts → src/components/Header.tsx

**Issues**:
  - [high] circular-dependency: Circular import detected
    Files: src/lib/auth.ts, src/lib/session.ts
  - [medium] high-fan-out: File has too many dependencies (15)
    Files: src/pages/api/auth/login.ts
  - [low] no-tests: Critical file lacks test coverage
    Files: src/lib/auth.ts

Use this analysis to inform your plan. Prioritize fixing cycles, refactoring god files, and protecting core files.

Workspace context:
...
```

---

## 🎨 AI Planning Improvements

The AI now makes smarter decisions:

### Before Phase 85.4 (Blind Planning):
```json
{
  "goal": "Refactor authentication",
  "steps": [
    {
      "id": "step-1",
      "title": "Update auth.ts",
      "description": "Replace session logic with JWT",
      "targetFiles": ["src/lib/auth.ts"]
    }
  ]
}
```

### After Phase 85.4 (Analysis-Aware Planning):
```json
{
  "goal": "Refactor authentication",
  "steps": [
    {
      "id": "step-1",
      "title": "Break circular dependency",
      "description": "Extract session types to separate file to resolve auth.ts ↔ session.ts cycle",
      "targetFiles": ["src/lib/auth.ts", "src/lib/session.ts", "src/types/session.ts"],
      "changeKind": "refactor",
      "estimatedImpact": "High - fixes critical cycle, affects 12 dependent files"
    },
    {
      "id": "step-2",
      "title": "Update core auth file carefully",
      "description": "Replace session logic with JWT in auth.ts (12 dependents - test thoroughly)",
      "targetFiles": ["src/lib/auth.ts"],
      "changeKind": "refactor",
      "estimatedImpact": "High - core file with many dependents"
    },
    {
      "id": "step-3",
      "title": "Simplify login endpoint",
      "description": "Refactor login.ts to reduce dependencies from 15 to ~8",
      "targetFiles": ["src/pages/api/auth/login.ts"],
      "changeKind": "refactor",
      "estimatedImpact": "Medium - improves maintainability"
    }
  ]
}
```

Notice how the AI:
- ✅ Addresses the circular dependency **first**
- ✅ Explicitly warns about core file impact (12 dependents)
- ✅ Includes steps to refactor god files
- ✅ Provides better impact estimates

---

## 🧪 Testing

### Manual Testing Flow

1. **Start dev server and emulators**:
   ```bash
   PORT=3030 pnpm dev
   firebase emulators:start --only auth,firestore,functions
   ```

2. **Open Web IDE**:
   ```
   http://localhost:3030/en/f0/ide?projectId=YOUR_PROJECT_ID
   ```

3. **Test Analysis + Planning**:
   - Click "📊 Analyze Project" button
   - Wait for analysis to complete
   - Verify analysis panel shows:
     - Core Files
     - God Files
     - Cycles
     - Issues
   - Switch chat mode to "Multi-File Plan"
   - Send refactoring request: "Refactor the authentication system"
   - Verify plan references analysis data:
     - Mentions cycles
     - Warns about core files
     - Suggests god file refactoring

4. **Test Caching**:
   - Close and reopen IDE session
   - Trigger multi-file plan again
   - Check logs for "Using cached project analysis"
   - Verify plan still uses analysis data

5. **Test Fresh Build**:
   - Delete analysis from Firestore:
     ```
     projects/{projectId}/analysis/dependencyGraph
     ```
   - Trigger multi-file plan
   - Check logs for "Building fresh project analysis"
   - Verify new analysis is saved

---

## 📁 Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| [src/lib/ide/workspacePlanner.ts](src/lib/ide/workspacePlanner.ts) | +67 | Extended input type, added helper, injected analysis |
| [src/app/api/ide/chat/route.ts](src/app/api/ide/chat/route.ts) | +55 | Added imports, helper, integration |

**Total**: 2 files modified, ~122 lines added

---

## 🔍 Key Implementation Details

### 1. **Analysis Summary Format**

The `buildAnalysisContextSummary()` helper produces:
- **Header**: File/dependency/issue counts
- **Core Files**: Top 5 by fan-in with counts
- **God Files**: Top 5 by fan-out with counts
- **Cycles**: First 3 detected cycles with paths
- **Issues**: Top 8 issues with severity, kind, message, affected files
- **Footer**: Instruction to use analysis for planning

### 2. **Caching Strategy**

Analysis is cached in Firestore at:
```
projects/{projectId}/analysis/dependencyGraph
```

Document structure:
```typescript
{
  summary: {
    fileCount: number;
    edgeCount: number;
    topFanIn: Array<{ path: string; fanIn: number }>;
    topFanOut: Array<{ path: string; fanOut: number }>;
    cycles: string[][];
    issues: Array<{ severity, kind, message, affectedFiles }>;
    createdAt: number;
  },
  files: Array<{ path, fanIn, fanOut }>,
  edges: Array<{ from, to }>
}
```

### 3. **Fallback Behavior**

If analysis fails or is unavailable:
- Helper returns `null`
- `buildAnalysisContextSummary()` returns: `"No static project analysis is available. Plan using only the workspace context."`
- Planner continues with workspace context only
- No errors thrown - graceful degradation

### 4. **Performance Optimization**

- Analysis is built once and cached
- Subsequent planning requests use cached data
- Fresh build only triggers if:
  - No cached analysis exists
  - User manually clicks "Analyze Project" in Web IDE
  - Cache is manually cleared

---

## 🎓 Benefits

### For AI Planning:
- ✅ **Smarter refactoring**: AI knows which files are critical
- ✅ **Cycle awareness**: Circular dependencies are prioritized
- ✅ **Impact estimation**: Plans warn about high-impact changes
- ✅ **Issue-driven**: Plans address reported problems

### For Developers:
- ✅ **Safer plans**: Less risk of breaking changes
- ✅ **Better insights**: Understand project structure before changes
- ✅ **Guided refactoring**: AI suggests optimal refactoring order
- ✅ **Automated analysis**: No manual dependency tracing needed

---

## 📝 Next Steps (Future Enhancements)

### Potential Phase 85.5 Ideas:
1. **Real-time Analysis Updates**: Re-analyze when files change
2. **Analysis Diff View**: Show before/after dependency graphs
3. **Custom Analysis Rules**: User-defined metrics and thresholds
4. **Analysis Export**: Download dependency graph as JSON/DOT
5. **VS Code Integration**: Show analysis in extension sidebar
6. **Plan Validation**: Check if plan would fix reported issues
7. **Impact Prediction**: Estimate test coverage needed per step

---

## ✅ Verification Checklist

- [x] Extended `WorkspacePlannerInput` with `projectAnalysis` field
- [x] Created `buildAnalysisContextSummary()` helper function
- [x] Updated system prompt with analysis usage rules
- [x] Injected analysis summary into user prompt
- [x] Added imports to API route
- [x] Created `getOrBuildProjectAnalysis()` helper
- [x] Integrated analysis into multi-file mode handlers
- [x] TypeScript compilation successful (no new errors)
- [x] Graceful fallback when analysis unavailable
- [x] Created comprehensive documentation

---

## 🎉 Phase 85.4 Complete!

The workspace planner is now **analysis-aware**! Multi-file refactoring plans are:
- Smarter
- Safer
- More structured
- Issue-driven

Combined with Phase 85.3's analysis UI and Phase 85.1's multi-file execution, F0 now has a complete **intelligent workspace refactoring system**.

---

**Previous Phase**: [Phase 85.3.1 - Web IDE Analysis UI](PHASE_85_3_1_COMPLETE.md)
**Related Phases**:
- [Phase 85.1 - Workspace Planning](PHASE_85_1_COMPLETE.md)
- [Phase 85.2 - Workspace Patch Engine](PHASE_85_2_COMPLETE.md)
- [Phase 85.3 - Dependency Analysis](PHASE_85_3_COMPLETE.md)

---

**Implementation Date**: 2025-11-20
**Status**: ✅ Production Ready
