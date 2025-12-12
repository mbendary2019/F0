# Phase 125-127: Quality Monitor & Live Alerts System

## Overview | نظرة عامة

هذه المراحل تُنشئ نظام مراقبة الجودة والتنبيهات الحية في F0 Desktop IDE.

---

## Phase 125: Quality Monitor Foundation

### 125.0: Quality Monitor Context
**File:** `desktop/src/state/qualityMonitorContext.tsx`

نظام مركزي لمراقبة جودة الكود يجمع البيانات من مصادر متعددة:
- Health Score (0-100)
- Total Issues count
- Test status
- Security alerts
- Last scan timestamp

```typescript
interface QualityMonitorSummary {
  healthScore: number | null;
  totalIssues: number | null;
  testsStatus: 'passing' | 'failing' | 'not_run';
  testPassRate: number | null;
  lastScanAt: string | null;
  lastAceRun?: { createdAt: string };
  lastCleanup?: { createdAt: string };
}
```

### 125.1: Quality Monitor Types
**File:** `desktop/src/lib/analysis/qualityTypes.ts`

تعريف أنواع البيانات للتحليل:
- `QualityScanResult` - نتيجة فحص الجودة
- `QualityIssue` - مشكلة جودة واحدة
- `QualityMetrics` - مقاييس الجودة

### 125.2: Quality Scanner
**File:** `desktop/src/lib/analysis/qualityScanner.ts`

محرك فحص الجودة الذي يحلل الملفات ويكتشف:
- Code smells
- Complexity issues
- Naming conventions
- Unused code
- Security patterns

### 125.3: Quality Monitor Panel
**File:** `desktop/src/components/panels/QualityMonitorPanel.tsx`

واجهة المستخدم لعرض نتائج المراقبة:
- Health score gauge
- Issue breakdown by category
- Trend indicators
- Quick action buttons

---

## Phase 126: Code Health Analysis

### 126.0: Code Health Types
**File:** `desktop/src/lib/analysis/codeHealthTypes.ts`

```typescript
interface CodeHealthSnapshot {
  fileCount: number;
  totalLines: number;
  avgComplexity: number;
  issuesByCategory: Record<string, number>;
  timestamp: string;
}
```

### 126.1: Code Health Context
**File:** `desktop/src/state/codeHealthContext.tsx`

سياق React لإدارة snapshots صحة الكود:
- تخزين الـ snapshots
- حساب الاتجاهات
- مقارنة النتائج عبر الزمن

### 126.2: Health Scoring Algorithm
**File:** `desktop/src/lib/analysis/codeHealthTypes.ts` → `computeHealthScore()`

خوارزمية حساب الـ Health Score:
```typescript
function computeHealthScore(snapshot: CodeHealthSnapshot): { score: number; breakdown: HealthBreakdown } {
  // Complexity penalty (max 30 points)
  // Issue density penalty (max 40 points)
  // File size penalty (max 20 points)
  // Coverage bonus (max 10 points)
  return { score: Math.max(0, 100 - totalPenalty), breakdown };
}
```

### 126.3: Health Alerts Context
**File:** `desktop/src/state/healthAlertsContext.tsx`

نظام التنبيهات الصحية:
- Critical alerts (blocking)
- Warning alerts
- Info alerts
- Auto-dismissal rules

---

## Phase 127: Live Alerts System

### 127.0: Live Alert Types
**File:** `desktop/src/lib/analysis/liveAlertTypes.ts`

```typescript
type LiveAlertType =
  | 'console_log'      // console.log في production
  | 'todo_comment'     // TODO/FIXME comments
  | 'any_type'         // استخدام any
  | 'large_function'   // دالة كبيرة جداً
  | 'deep_nesting'     // تداخل عميق
  | 'magic_number';    // أرقام سحرية

interface LiveAlert {
  type: LiveAlertType;
  line: number;
  message: string;
  severity: 'info' | 'warning' | 'error';
}
```

### 127.1: Live Alert Patterns
**File:** `desktop/src/lib/analysis/liveAlertPatterns.ts`

Regex patterns لاكتشاف المشاكل أثناء الكتابة:
```typescript
const PATTERNS = {
  console_log: /console\.(log|warn|error|debug)\(/g,
  todo_comment: /\/\/\s*(TODO|FIXME|HACK|XXX)/gi,
  any_type: /:\s*any\b/g,
  // ...
};
```

### 127.2: Live File Alerts Hook
**File:** `desktop/src/hooks/useLiveFileAlerts.ts`

Hook يفحص الملف أثناء الكتابة ويُرجع ملخص التنبيهات:
```typescript
function useLiveFileAlerts(content: string, filePath: string | null): LiveAlertsSummary {
  // Debounced analysis
  // Returns { total, byType, topAlerts }
}
```

### 127.3: Live Alerts Pill
**File:** `desktop/src/components/LiveAlertsPill.tsx`

مكون UI صغير يظهر في header المحرر:
- يعرض عدد التنبيهات
- لون مختلف حسب الخطورة
- Tooltip بالتفاصيل

### 127.4: Live Alerts Integration
تم دمج التنبيهات الحية في `CodeEditorPane.tsx`:
- تحديث فوري أثناء الكتابة
- عرض في الـ editor header
- ربط مع Quality Monitor

---

## Key Files Summary

| File | Purpose |
|------|---------|
| `qualityMonitorContext.tsx` | Central quality state management |
| `codeHealthContext.tsx` | Health snapshots storage |
| `healthAlertsContext.tsx` | Alert management |
| `useLiveFileAlerts.ts` | Real-time file analysis |
| `LiveAlertsPill.tsx` | UI indicator component |
| `liveAlertPatterns.ts` | Detection patterns |

---

## Usage Example

```tsx
// In App.tsx
<QualityMonitorProvider>
  <CodeHealthProvider>
    <HealthAlertsProvider>
      <CodeEditorPane
        filePath={currentFile}
        content={content}
        // Live alerts shown automatically
      />
    </HealthAlertsProvider>
  </CodeHealthProvider>
</QualityMonitorProvider>
```

---

## Arabic Summary | ملخص عربي

### Phase 125: أساس مراقب الجودة
- إنشاء سياق مراقبة الجودة المركزي
- تعريف أنواع البيانات للتحليل
- بناء محرك فحص الجودة

### Phase 126: تحليل صحة الكود
- نظام snapshots لتتبع الصحة
- خوارزمية حساب النتيجة
- نظام التنبيهات الصحية

### Phase 127: التنبيهات الحية
- اكتشاف المشاكل أثناء الكتابة
- أنماط regex للمشاكل الشائعة
- مكون UI للعرض الفوري

---

**Status:** ✅ Complete
**Date:** November 2024
