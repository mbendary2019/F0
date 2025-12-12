# Phase 130-131: Cleanup System (Guided Cleanup Sessions)

## Overview | نظرة عامة

نظام التنظيف الموجه يسمح للمستخدم بتنظيف المشروع بشكل منظم مع خيارات مختلفة للنطاق والكثافة.

---

## Phase 130: Cleanup Wizard UI

### 130.0: Cleanup Wizard Component
**File:** `desktop/src/components/cleanup/CleanupWizard.tsx`

معالج التنظيف التفاعلي:

```typescript
// خطوات المعالج
1. اختيار النطاق (Scope Selection)
   - whole_project: المشروع بالكامل
   - src_only: مجلد src فقط
   - functions_only: مجلد functions فقط
   - custom: مسارات مخصصة

2. اختيار الكثافة (Intensity Selection)
   - safe: إصلاحات آمنة فقط (logging, style)
   - moderate: آمنة + تحسين الأنواع
   - aggressive: جميع الإصلاحات + ACE phases

3. مراجعة وتأكيد (Review & Confirm)
   - عرض الخطوات المتوقعة
   - تقدير الوقت
   - زر البدء
```

### 130.1: Cleanup Running Component
**File:** `desktop/src/components/cleanup/CleanupRunning.tsx`

عرض التقدم أثناء التنفيذ:
- شريط التقدم
- الخطوة الحالية
- الخطوات المكتملة
- زر الإلغاء

### 130.2: Cleanup Summary Component
**File:** `desktop/src/components/cleanup/CleanupSummary.tsx`

ملخص النتائج بعد الانتهاء:
- Health score قبل وبعد
- عدد المشاكل المُصلحة
- مدة الجلسة
- إجراءات إضافية مقترحة

---

## Phase 131: Cleanup Storage & History

### 131.0: Session Storage
**File:** `desktop/src/lib/cleanup/cleanupStorage.ts`

تخزين الجلسات محلياً:

```typescript
interface CleanupSessionsStorage {
  version: 1;
  lastSessionId?: string;
  sessions: CleanupSession[];
  history: CleanupSessionHistoryEntry[];
}

// Functions
saveSession(projectRoot, session)
loadSession(projectRoot)
addToHistory(projectRoot, session)
getHistory(projectRoot): CleanupSessionHistoryEntry[]
```

### 131.1: History Entry
**File:** `desktop/src/lib/cleanup/cleanupTypes.ts`

```typescript
interface CleanupSessionHistoryEntry {
  id: string;
  projectRoot: string;
  completedAt: string;
  scope: CleanupScope;
  intensity: CleanupIntensity;
  healthBefore: number;    // Score only
  healthAfter: number;
  issuesFixed: number;
  durationMs: number;
}
```

---

## Cleanup Steps by Intensity

### Safe Mode (آمن)
```typescript
[
  { type: 'scan', label: 'Scan project for issues' },
  { type: 'fix_safe', label: 'Apply safe fixes (logging, style)' },
  { type: 'recompute', label: 'Recompute health score' },
]
```

### Moderate Mode (معتدل)
```typescript
[
  { type: 'scan', label: 'Scan project for issues' },
  { type: 'fix_safe', label: 'Apply safe fixes' },
  { type: 'fix_types', label: 'Fix type issues' },
  { type: 'recompute', label: 'Recompute health score' },
]
```

### Aggressive Mode (مكثف)
```typescript
[
  { type: 'scan', label: 'Scan project for issues' },
  { type: 'fix_safe', label: 'Apply safe fixes' },
  { type: 'fix_types', label: 'Fix type issues' },
  { type: 'ace_phase', label: 'Run ACE Phase 1 (Critical)' },
  { type: 'ace_phase', label: 'Run ACE Phase 4 (Cleanup)' },
  { type: 'recompute', label: 'Recompute health score' },
]
```

---

## Key Components

| Component | Purpose |
|-----------|---------|
| `CleanupWizard.tsx` | Multi-step wizard UI |
| `CleanupRunning.tsx` | Progress display |
| `CleanupSummary.tsx` | Results summary |
| `CleanupPanel.tsx` | Container panel |

---

## Usage Flow

```
┌─────────────────────────────────────────────────┐
│  1. User opens Cleanup Wizard                   │
│  2. Selects scope (whole project, src, etc.)    │
│  3. Selects intensity (safe, moderate, agg.)    │
│  4. Reviews and confirms                        │
│  5. System creates snapshot for rollback        │
│  6. Executes steps sequentially                 │
│  7. Shows progress with current step            │
│  8. On completion, shows before/after summary   │
│  9. Saves session to history                    │
└─────────────────────────────────────────────────┘
```

---

## Estimated Duration

```typescript
function estimateSessionDuration(
  fileCount: number,
  intensity: CleanupIntensity
): { display: string; displayAr: string } {
  const basePerFile = 50; // ms
  const multiplier =
    intensity === 'safe' ? 1 :
    intensity === 'moderate' ? 1.5 : 2;

  // Returns formatted string like "2-3 minutes"
}
```

---

## Arabic Summary | ملخص عربي

### Phase 130: واجهة معالج التنظيف
- معالج متعدد الخطوات لاختيار الإعدادات
- عرض التقدم أثناء التنفيذ
- ملخص النتائج بعد الانتهاء

### Phase 131: التخزين والتاريخ
- حفظ الجلسات محلياً
- تتبع تاريخ عمليات التنظيف
- إمكانية مراجعة النتائج السابقة

---

**Status:** ✅ Complete
**Date:** November 2024
