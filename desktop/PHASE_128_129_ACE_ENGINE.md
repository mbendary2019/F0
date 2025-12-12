# Phase 128-129: ACE (Autonomous Code Evolution) Engine

## Overview | نظرة عامة

ACE هو نظام تطوير الكود التلقائي الذي يحلل المشروع ويقدم اقتراحات لتحسين جودة الكود وتقليل الديون التقنية.

---

## Phase 128: ACE Core Engine

### 128.0: Core Types
**File:** `desktop/src/lib/ace/aceTypes.ts`

الأنواع الأساسية لنظام ACE:

```typescript
type AceFileScore = {
  filePath: string;
  healthScore: number;        // 0-100 (higher is better)
  healthIssues: number;
  complexity: number;
  riskLevel: 'low' | 'medium' | 'high';
  categoryWeights: {
    logging: number;
    types: number;
    style: number;
    deadCode: number;
    security: number;
    performance: number;
    other: number;
  };
};

type AceSuggestionId =
  | 'split_large_file'
  | 'convert_js_to_ts'
  | 'cleanup_logging_heavy_file'
  | 'reduce_any_types'
  | 'extract_shared_utils'
  | 'tighten_tsconfig'
  | 'remove_legacy_backups'
  | 'improve_security_rules'
  | 'reduce_file_complexity'
  | 'cleanup_dead_code'
  | 'improve_test_coverage';

type AceSuggestion = {
  id: string;
  type: AceSuggestionId;
  title: string;
  titleAr: string;
  targetFiles: string[];
  estimatedImpact: 'low' | 'medium' | 'high';
  estimatedEffort: 'S' | 'M' | 'L';
};
```

### 128.1: Debt Map Builder
**File:** `desktop/src/lib/ace/aceDebtMap.ts`

يبني خريطة الديون التقنية للمشروع:
- يحسب نتيجة الصحة لكل ملف
- يصنف الملفات حسب مستوى الخطورة
- يحدد أسوأ الملفات للتركيز عليها

### 128.2: Suggestions Generator
**File:** `desktop/src/lib/ace/aceSuggestions.ts`

يولد اقتراحات التحسين بناءً على:
- File scores
- Issue categories
- Project patterns

### 128.3: Evolution Plan Generator
**File:** `desktop/src/lib/ace/acePlanner.ts`

ينشئ خطة تطوير متعددة المراحل:

```typescript
const PHASE_TEMPLATES = {
  critical: {
    title: 'Phase 1: Critical Fixes',
    titleAr: 'المرحلة 1: الإصلاحات الحرجة',
    // Security issues, high-risk files
  },
  structure: {
    title: 'Phase 2: Structural Improvements',
    titleAr: 'المرحلة 2: تحسينات هيكلية',
    // Split files, reduce complexity
  },
  quality: {
    title: 'Phase 3: Quality & Types',
    titleAr: 'المرحلة 3: الجودة والأنواع',
    // TypeScript types, remove any
  },
  cleanup: {
    title: 'Phase 4: Cleanup & Polish',
    titleAr: 'المرحلة 4: تنظيف وتلميع',
    // Logging, dead code
  },
  testing: {
    title: 'Phase 5: Testing & Documentation',
    titleAr: 'المرحلة 5: الاختبارات والتوثيق',
    // Test coverage
  },
};
```

### 128.4: Impact Analysis
**File:** `desktop/src/lib/ace/aceImpact.ts`

يحلل تأثير التغييرات المقترحة:
- بناء رسم بياني للاعتماديات
- تحديد الملفات المتأثرة مباشرة وبشكل غير مباشر
- ترتيب الاقتراحات حسب الأمان

### 128.5: ACE Context Provider
**File:** `desktop/src/state/aceContext.tsx`

السياق المركزي لإدارة حالة ACE:

```typescript
interface AceState {
  fileScores: AceFileScore[];
  overallDebt: number;           // Health score 0-100
  suggestions: AceSuggestion[];
  plan: AcePlan | null;
  isScanning: boolean;
  metrics: AceMetricsState;
  activityStatus: AceActivityStatus;
  alerts: AceAlert[];
}

// Hooks المتاحة
useAce()           // Full context
useAcePlan()       // Plan only
useAceSuggestions() // Suggestions only
useAceDebt()       // Debt overview
useAceMetrics()    // Metrics & history
useAceAlerts()     // Alerts system
```

### 128.6: Metrics & History
**File:** `desktop/src/lib/ace/aceMetricsTypes.ts`

تتبع تاريخ عمليات ACE:

```typescript
type AceRecomputeEvent = {
  id: string;
  timestamp: string;
  filesCount: number;
  suggestionsCount: number;
  overallDebtScore: number;
  previousScore?: number;
  trigger: 'manual' | 'auto_scan' | 'phase_complete';
};

type AceActivityStatus = 'idle' | 'running' | 'fresh' | 'stale' | 'attention';
```

### 128.7: Alerts System
**File:** `desktop/src/lib/ace/aceAlerts.ts`

نظام التنبيهات لـ ACE:
- تنبيهات عند انخفاض الصحة
- تنبيهات عند كثرة الاقتراحات
- تنبيهات عند قدم آخر فحص

---

## Phase 129: ACE Execution & Cleanup

### 129.0: Cleanup Types
**File:** `desktop/src/lib/cleanup/cleanupTypes.ts`

أنواع جلسات التنظيف:

```typescript
type CleanupScope = 'whole_project' | 'src_only' | 'functions_only' | 'custom';

type CleanupIntensity = 'safe' | 'moderate' | 'aggressive';

interface CleanupSession {
  id: string;
  scope: CleanupScope;
  intensity: CleanupIntensity;
  steps: CleanupStep[];
  healthBefore?: SessionHealthSnapshot;
  healthAfter?: SessionHealthSnapshot;
  summary?: {
    filesScanned: number;
    issuesFound: number;
    issuesFixed: number;
    durationMs: number;
    acePhasesRun: string[];
  };
}
```

### 129.1: Actions System
**File:** `desktop/src/lib/ace/aceActions.ts`

تعريف الإجراءات المتاحة:

```typescript
type AceActionType =
  | 'AUTO_FIX_SAFE'      // Safe auto-fixes
  | 'AUTO_FIX_TYPES'     // Type fixes
  | 'SPLIT_FILE'         // Split large file
  | 'ARCHIVE_FILE'       // Archive legacy
  | 'RUN_TESTS'          // Execute tests
  | 'OPEN_FILE'          // Open for review
  | 'RUN_PHASE';         // Run ACE phase

interface AcePlannedAction {
  id: string;
  type: AceActionType;
  targetFiles: string[];
  estimatedTimeSeconds: number;
  requiresConfirmation: boolean;
}
```

### 129.2: Phase Executor
**File:** `desktop/src/lib/ace/aceExecutor.ts`

منسق تنفيذ المراحل:

```typescript
type AcePhaseExecutionStatus =
  | 'idle'
  | 'preparing'    // Creating snapshot
  | 'running'      // Executing actions
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

async function executePhase(
  phase: AcePlanPhase,
  suggestions: AceSuggestion[],
  executor: ActionExecutorFn,
  snapshotCreator?: SnapshotCreatorFn,
  options?: AceExecutionOptions
): Promise<AcePhaseExecutionState>;
```

### 129.3: Cleanup Orchestrator
**File:** `desktop/src/lib/cleanup/cleanupOrchestrator.ts`

منسق جلسات التنظيف:
- تشغيل الخطوات بالترتيب
- تتبع التقدم
- حفظ النتائج للتاريخ

---

## Key Files Summary

| File | Purpose |
|------|---------|
| `aceTypes.ts` | Core ACE type definitions |
| `aceDebtMap.ts` | Technical debt mapping |
| `aceSuggestions.ts` | Suggestion generation |
| `acePlanner.ts` | Evolution plan builder |
| `aceImpact.ts` | Impact analysis |
| `aceContext.tsx` | React context provider |
| `aceExecutor.ts` | Phase execution |
| `aceActions.ts` | Action definitions |
| `cleanupTypes.ts` | Cleanup session types |
| `cleanupOrchestrator.ts` | Cleanup orchestration |

---

## UI Components

### ACE Panel
**File:** `desktop/src/components/ace/AcePanel.tsx`

لوحة عرض حالة ACE:
- Overall debt score
- Worst files list
- Suggestions carousel
- Phase progress

### ACE Activity Widget
**File:** `desktop/src/components/ace/AceActivityWidget.tsx`

أداة صغيرة في الـ header:
- مؤشر حالة النشاط
- عدد الاقتراحات
- آخر تحديث

---

## Usage Example

```tsx
// In App.tsx
<AceProvider
  summaries={projectIssueSummaries}
  indexedFiles={files}
  projectRoot="/path/to/project"
>
  <AcePanel />
  <CleanupWizard />
</AceProvider>

// In component
function MyComponent() {
  const { overallDebt, suggestions, recompute } = useAce();
  const { plan, currentPhase, startPhase } = useAcePlan();

  return (
    <div>
      <p>Health Score: {overallDebt}%</p>
      <p>Suggestions: {suggestions.length}</p>
      <button onClick={() => recompute('manual')}>
        Recompute
      </button>
    </div>
  );
}
```

---

## Arabic Summary | ملخص عربي

### Phase 128: محرك ACE الأساسي
- تعريف أنواع البيانات للتحليل التقني
- بناء خريطة الديون التقنية
- توليد اقتراحات التحسين
- إنشاء خطة تطوير متعددة المراحل
- تحليل تأثير التغييرات

### Phase 129: التنفيذ والتنظيف
- نظام الإجراءات والأوامر
- منفذ المراحل مع نقاط الاستعادة
- منسق جلسات التنظيف
- تتبع التقدم والنتائج

---

**Status:** ✅ Complete
**Date:** November 2024
