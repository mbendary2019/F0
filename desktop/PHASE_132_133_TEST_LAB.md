# Phase 132-133: Test Lab System

## Overview | نظرة عامة

Test Lab هو نظام إدارة الاختبارات في F0 Desktop IDE. يوفر تتبع حالة الاختبارات، ربط الملفات المصدرية بملفات الاختبار، وتشغيل الاختبارات تلقائياً.

---

## Phase 132: Test Discovery & Mapping

### 132.0: Test Types
**File:** `desktop/src/lib/tests/testTypes.ts`

الأنواع الأساسية للاختبارات:

```typescript
type TestStatus = 'passed' | 'failed' | 'error' | 'partial' | 'skipped' | 'running';

interface TestSuite {
  id: string;
  name: string;
  framework: 'vitest' | 'jest' | 'playwright' | 'cypress' | 'mocha' | 'unknown';
  testPattern: string;
  lastStatus?: TestStatus;
  lastRunAt?: string;
}

interface TestHistory {
  runs: TestRunSummary[];
}
```

### 132.1: Test Discovery
**File:** `desktop/src/lib/tests/testDiscoveryBrowser.ts`

اكتشاف ملفات الاختبار في المشروع:
- البحث عن `*.test.ts`, `*.spec.ts`, etc.
- تحديد الـ framework المستخدم
- بناء خريطة الملفات

### 132.2: File-Test Mapping
**File:** `desktop/src/lib/tests/testLabTypes.ts`

```typescript
// Mapping from source file to test files
type SourceToTestsMap = Record<string, string[]>;

// Mapping from test file to source files
type TestsToSourceMap = Record<string, string[]>;

interface TestLabSuite {
  id: string;
  projectId: string;
  framework: TestFramework;
  testFilePath: string;
  name: string;
  relatedSourceFiles: string[];
  lastRun: TestSuiteRun | null;
}
```

---

## Phase 133: Test Lab Context & UI

### 133.0: Test Lab Types
**File:** `desktop/src/lib/tests/testLabTypes.ts`

```typescript
type TestLabStatus = 'pending' | 'passing' | 'failing' | 'skipped';

interface TestSuiteRun {
  id: string;
  startedAt: string;
  finishedAt: string;
  status: TestLabStatus;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  trigger?: TestRunTrigger;
}

interface TestLabSummary {
  totalSuites: number;
  passingSuites: number;
  failingSuites: number;
  pendingSuites: number;
  skippedSuites: number;
  lastRunAt: string | null;
  passRate: number;
}
```

### 133.1: Test Lab Context
**File:** `desktop/src/state/testLabContext.tsx`

السياق المركزي لإدارة الاختبارات:

```typescript
interface TestLabContextValue {
  state: TestLabState;
  refresh: () => Promise<void>;
  getSuitesForSource: (sourcePath: string) => TestLabSuite[];
  getSourcesForTest: (testFilePath: string) => string[];
  hasFailingTests: (filePath: string) => boolean;
  hasPassingTests: (filePath: string) => boolean;
  getFileTestStatus: (filePath: string) => TestLabStatus | null;
  recordTestRun: (suiteId: string, result: TestSuiteRun) => void;
  runTestsForFiles: (files: string[], trigger?: TestRunTrigger) => Promise<TestRunResult>;
  runAllTests: (trigger?: TestRunTrigger) => Promise<TestRunResult>;
  isRunning: boolean;
}

// Convenience hooks
useTestLab()           // Full context
useTestLabSummary()    // Summary only
useFileTestStatus(path) // Status for specific file
```

### 133.2: Generate Tests Integration

ربط مع Code Editor لتوليد الاختبارات:
- زر "Generate Tests" في الـ editor
- إرسال طلب للـ AI لتوليد اختبارات
- حفظ الاختبارات المولدة

### 133.3: Test Run Triggers
**File:** `desktop/src/lib/tests/testLabTypes.ts`

```typescript
type TestRunTrigger =
  | 'manual'         // User clicked Run
  | 'ace_auto'       // After ACE applied fixes
  | 'generate_tests' // After generating new tests
  | 'pre_deploy'     // Before deployment
  | 'watch';         // File watcher

interface TestRunResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  trigger: TestRunTrigger;
  filesRan: string[];
}
```

### 133.4: Auto-Run After ACE

تشغيل الاختبارات تلقائياً بعد إصلاحات ACE:
- اكتشاف الملفات المتأثرة
- تشغيل الاختبارات المرتبطة
- تحديث حالة الملفات

---

## Test Status Flow

```
┌─────────────────────────────────────────────────┐
│  Source File: src/utils/math.ts                 │
│                    │                            │
│                    ▼                            │
│  Test Files: src/utils/math.test.ts             │
│              __tests__/math.spec.ts             │
│                    │                            │
│                    ▼                            │
│  Status: passing ✅ | failing ❌ | pending ⏳   │
│                    │                            │
│                    ▼                            │
│  Display in: Editor tab, File tree, Status bar  │
└─────────────────────────────────────────────────┘
```

---

## Key Files Summary

| File | Purpose |
|------|---------|
| `testTypes.ts` | Base test types |
| `testLabTypes.ts` | Test Lab specific types |
| `testDiscoveryBrowser.ts` | Test file discovery |
| `testLabContext.tsx` | React context provider |

---

## Usage Example

```tsx
// In App.tsx
<TestLabProvider>
  <CodeEditorPane
    filePath={currentFile}
    testStatus={fileTestStatus}
    onGenerateTests={handleGenerateTests}
  />
</TestLabProvider>

// In component
function FileStatusIndicator({ filePath }: { filePath: string }) {
  const status = useFileTestStatus(filePath);

  if (!status) return <span>No tests</span>;

  return (
    <span className={status === 'passing' ? 'text-green-500' : 'text-red-500'}>
      {status === 'passing' ? '✅' : '❌'}
    </span>
  );
}

// Running tests
function TestRunner() {
  const { runTestsForFiles, isRunning } = useTestLab();

  const handleRunTests = async () => {
    const result = await runTestsForFiles(['src/utils/math.ts'], 'manual');
    console.log(`Passed: ${result.passed}, Failed: ${result.failed}`);
  };

  return (
    <button onClick={handleRunTests} disabled={isRunning}>
      {isRunning ? 'Running...' : 'Run Tests'}
    </button>
  );
}
```

---

## Status Normalization

```typescript
function normalizeRawStatus(raw: string): TestLabStatus {
  // Passing variants
  if (['pass', 'passed', 'passing', 'success'].includes(raw)) {
    return 'passing';
  }
  // Failing variants
  if (['fail', 'failed', 'failing', 'error', 'partial'].includes(raw)) {
    return 'failing';
  }
  // Skipped variants
  if (['skip', 'skipped', 'ignored', 'todo'].includes(raw)) {
    return 'skipped';
  }
  return 'pending';
}
```

---

## Arabic Summary | ملخص عربي

### Phase 132: اكتشاف وربط الاختبارات
- اكتشاف ملفات الاختبار في المشروع
- تحديد الـ framework المستخدم
- بناء خريطة الربط بين الملفات المصدرية والاختبارات

### Phase 133: سياق Test Lab
- سياق React لإدارة حالة الاختبارات
- hooks للوصول السريع للحالة
- تشغيل الاختبارات يدوياً أو تلقائياً
- تتبع المُحفز (trigger) لكل تشغيل

---

**Status:** ✅ Complete
**Date:** November 2024
