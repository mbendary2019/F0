# Phase 124.5.1: API Debugger UI Panel

## Summary (Arabic)

تم تنفيذ Phase 124.5.1 بنجاح! الآن الـ Desktop IDE فيه:
- **Hook بسيط**: `useApiDebugger` لإدارة الـ state
- **Component جاهز**: `ApiDebuggerPanel.tsx` مع UI كامل
- **Electron IPC**: `debugApi` و `getRoutesIndex` bridges
- **CSS Styles**: تصميم نظيف مع دعم RTL

---

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| [desktop/src/hooks/useApiDebugger.ts](desktop/src/hooks/useApiDebugger.ts) | Created | Hook for API debugger state management |
| [desktop/src/components/ApiDebuggerPanel.tsx](desktop/src/components/ApiDebuggerPanel.tsx) | Created | UI component for debugging APIs |
| [desktop/src/styles.css](desktop/src/styles.css) | Modified | Added 470+ lines of CSS for debugger panel |
| [desktop/electron/main.ts](desktop/electron/main.ts) | Modified | Added IPC handlers for debugApi and getRoutesIndex |
| [desktop/electron/preload.ts](desktop/electron/preload.ts) | Modified | Added bridge APIs for renderer |

---

## useApiDebugger Hook

```typescript
import { useApiDebugger } from '../hooks/useApiDebugger';

const {
  // State
  urlPath,
  query,
  loading,
  result,
  error,
  lastDebuggedAt,

  // Actions
  setUrlPath,
  setQuery,
  debugApi,
  resolveIntent,
  clearResult,
  reset,

  // Data
  quickEndpoints,
  apiRoutes,

  // Computed
  hasResult,
  labels,
} = useApiDebugger({
  projectRoot: '/path/to/project',
  routesIndex: routesIndexFromIndexer,
  language: 'ar', // or 'en'
});
```

---

## ApiDebuggerPanel Component

```tsx
import { ApiDebuggerPanel } from '../components/ApiDebuggerPanel';

<ApiDebuggerPanel
  urlPath={urlPath}
  query={query}
  loading={loading}
  result={result}
  error={error}
  quickEndpoints={quickEndpoints}
  labels={labels}
  onUrlPathChange={setUrlPath}
  onQueryChange={setQuery}
  onDebug={debugApi}
  onClear={clearResult}
  onOpenFile={openFileInEditor}
  locale="ar"
  onClose={() => setShowDebugger(false)}
/>
```

---

## UI Sections

### 1. Header
- Title: "API Debugger" / "تصحيح API"
- Close button

### 2. Query Input
- Input field for URL path or natural language query
- Debug button
- Clear button (when has results)

### 3. Quick Endpoints
- Chips for common API routes from routes index
- Auto-prioritized: auth, billing, chat, user, project

### 4. Endpoint Overview (when has result)
- File path (clickable to open)
- HTTP Methods (GET, POST, etc.)
- Authentication type
- Validation hints
- Error codes

### 5. Logs Summary
- Error count
- Warning count
- Most common status code
- Common errors list

### 6. Root Cause
- Red highlighted section
- Probable cause based on code + logs analysis

### 7. Fix Suggestions
- Green highlighted section
- Actionable suggestions with code snippets

---

## Electron IPC Handlers

### f0:debug-api
```typescript
// Input
{
  urlPath?: string;      // e.g., "/api/auth/login"
  query?: string;        // e.g., "ليه API تسجيل الدخول بيكسر؟"
  projectRoot?: string;  // Project path
  minutesBack?: number;  // Log window (default: 60)
}

// Output: DebugApiEndpointOutput
{
  success: boolean;
  reason?: string;
  urlPath?: string;
  inspector?: ApiInspectorOutput;
  logs?: ApiLogsSummary;
  rootCause?: string;
  suggestions?: string[];
}
```

### f0:get-routes-index
```typescript
// Input
projectRoot?: string

// Output: RoutesIndex | null
```

---

## CSS Classes

All classes prefixed with `f0-debugger-` or `f0-api-debugger-`:

```css
.f0-api-debugger-panel        /* Main container */
.f0-debugger-header           /* Header bar */
.f0-debugger-input-section    /* Input area */
.f0-debugger-quick-endpoints  /* Quick chips */
.f0-debugger-section          /* Result sections */
.f0-debugger-root-cause       /* Root cause (red) */
.f0-debugger-suggestions      /* Suggestions (green) */
```

RTL support included with `[dir="rtl"]` selectors.

---

## Integration Example

```tsx
// In AgentPanelPane.tsx or similar
import { useApiDebugger } from '../hooks/useApiDebugger';
import { ApiDebuggerPanel } from '../components/ApiDebuggerPanel';
import { useRoutesIndex } from '../hooks/useRoutesIndex';
import { useProjectState } from '../hooks/useProjectState';

function AgentPanel() {
  const { projectRoot } = useProjectState();
  const { routesIndex } = useRoutesIndex({ projectRoot });
  const [showDebugger, setShowDebugger] = useState(false);

  const debugger = useApiDebugger({
    projectRoot,
    routesIndex,
    language: 'ar',
  });

  return (
    <div>
      {/* Trigger button */}
      <button onClick={() => setShowDebugger(true)}>
        Debug API
      </button>

      {/* Panel */}
      {showDebugger && (
        <ApiDebuggerPanel
          {...debugger}
          onUrlPathChange={debugger.setUrlPath}
          onQueryChange={debugger.setQuery}
          onDebug={debugger.debugApi}
          onClear={debugger.clearResult}
          onOpenFile={(path) => window.f0Desktop?.openFileInEditor(path, projectRoot)}
          locale="ar"
          onClose={() => setShowDebugger(false)}
        />
      )}
    </div>
  );
}
```

---

## Usage Scenarios

### From Agent Chat
User: "ليه /api/auth/login بيرجع 500؟"

Agent calls `debugApi({ query: "...", projectRoot })` and shows results.

### From Context Menu
Right-click on API route file → "Debug this API"

### From Toolbar
Click "Debug API" button → Opens panel with input

---

## Phase 124.5.1 Complete!