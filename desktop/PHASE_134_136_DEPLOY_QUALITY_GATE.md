# Phase 134-136: Deploy Quality Gate System

## Overview | نظرة عامة

نظام بوابة جودة النشر يمنع نشر الكود منخفض الجودة عبر تقييم شامل للمشروع قبل كل عملية نشر.

---

## Phase 134: Deploy Quality Gate Foundation

### 134.0: Deploy Quality Types
**File:** `desktop/src/lib/deploy/deployQualityTypes.ts`

```typescript
type DeployQualityLevel = 'clean' | 'risky' | 'blocked';

type DeployQualityReasonCode =
  | 'no_recent_scan'
  | 'low_health_score'
  | 'tests_failing'
  | 'tests_not_run'
  | 'security_alerts_present'
  | 'no_quality_baseline'
  | 'high_issue_count';

interface DeployQualitySnapshot {
  healthScore: number | null;
  lastScanAt: string | null;
  testsStatus: 'passing' | 'failing' | 'not_run';
  totalSuites: number;
  failingSuites: number;
  hasSecurityAlerts: boolean;
  criticalAlertCount: number;
  totalIssues: number | null;
  level: DeployQualityLevel;
  reasons: DeployQualityReason[];
  generatedAt: string;
}
```

### 134.1: Deploy Quality Context
**File:** `desktop/src/state/deployQualityContext.tsx`

السياق المركزي الذي يجمع البيانات من:
- Quality Monitor
- Test Lab
- Health Alerts
- Code Health

```typescript
interface DeployQualityContextValue {
  snapshot: DeployQualitySnapshot | null;
  isLoading: boolean;
  refresh: () => void;
  canDeploy: () => boolean;
  getDeployButtonStyle: () => { bgColor, hoverColor, icon };
  // Phase 135.2+
  policyStatus: PolicyStatus;
  policyResult: PolicyEvaluationResult | null;
  policyReasons: PolicyReason[];
  // Phase 136.1+
  externalSecurityStats: ExternalSecurityStats | null;
  securityAlerts: SecurityAlert[];
}
```

---

## Phase 135: Quality Policy Engine

### 135.0: Quality Policy Types
**File:** `desktop/src/state/qualityPolicyTypes.ts`

```typescript
interface QualityPolicyThresholds {
  /** Minimum health score for OK status (default: 70) */
  minHealthForOk: number;
  /** Minimum health score before blocking (default: 50) */
  minHealthForCaution: number;
  /** Hours after which scan is stale (default: 24) */
  staleScanHours: number;
  /** Whether to require recent tests (default: true) */
  requireRecentTests: boolean;
  /** Max issues for OK status (default: 100) */
  maxIssuesForOk: number;
  /** Treat security alerts as blocking (default: true) */
  treatSecurityAlertsAsBlock: boolean;

  // Phase 136.4: Granular security thresholds
  maxSecurityAlertsForOK: number;
  maxSecurityAlertsForDeploy: number;
  alwaysBlockOnCriticalSecurity: boolean;
}
```

### 135.1: Quality Policy Context
**File:** `desktop/src/state/qualityPolicyContext.tsx`

سياق لإدارة إعدادات السياسة:
- تحميل من localStorage
- حفظ التغييرات
- قيم افتراضية

### 135.2: Policy Engine
**File:** `desktop/src/lib/quality/policyEngine.ts`

محرك تقييم السياسة:

```typescript
type PolicyStatus = 'OK' | 'CAUTION' | 'BLOCK';

interface PolicyEvaluationResult {
  status: PolicyStatus;
  reasons: PolicyReason[];
  affectedFiles: string[];
  summary: string;
  summaryAr: string;
  evaluatedAt: string;
}

function evaluatePolicy(
  scan: PolicyScanInput,
  thresholds: QualityPolicyThresholds
): PolicyEvaluationResult {
  // 1. Check for no baseline
  // 2. Check stale scan
  // 3. Check health score thresholds
  // 4. Check tests status
  // 5. Check security alerts (Phase 136.4: granular)
  // 6. Check issue count
  // → Return status + reasons
}
```

### 135.3: Quality Actions
**File:** `desktop/src/lib/quality/policyActions.ts`

الإجراءات المتاحة للإصلاح:

```typescript
type QualityActionType =
  | 'RUN_SCAN'
  | 'RUN_TESTS'
  | 'AUTO_FIX_ISSUES'
  | 'GENERATE_TESTS'
  | 'SECURITY_FIX'
  | 'RUN_FULL_REVIEW';

interface QualityAction {
  type: QualityActionType;
  label: string;
  labelAr: string;
  icon: string;
  estimatedTime: string;
  execute: () => Promise<void>;
}
```

### 135.4: Quality History
**File:** `desktop/src/lib/quality/qualityHistoryTypes.ts`

تتبع تاريخ الجودة:

```typescript
interface QualitySnapshot {
  id: string;
  createdAt: string;
  health: number;
  totalIssues: number;
  securityAlerts: number;
  policyStatus: PolicyStatus;
  testPassRate?: number;
  failingSuites?: number;
  // Phase 136.4
  securityCriticalAlerts?: number;
  securityHighAlerts?: number;
  blockedBySecurityPolicy?: boolean;
}

function calculateTrend(snapshots: QualitySnapshot[]):
  'improving' | 'stable' | 'declining' | 'unknown';
```

### 135.5: Quality Coach
**File:** `desktop/src/lib/quality/qualityCoach.ts`

نظام النصائح الذكية:

```typescript
type QualityCoachTrigger =
  | 'DECLINING_TREND'
  | 'BLOCKED_DEPLOYS'
  | 'NO_TESTS'
  | 'SECURITY_ALERTS'
  | 'SECURITY_CRITICAL'
  | 'SECURITY_TOO_MANY'
  | 'HIGH_ISSUES'
  | 'LOW_HEALTH';

interface QualityCoachSuggestion {
  id: string;
  trigger: QualityCoachTrigger;
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  recommendedActionType?: QualityActionType;
  severity: 'info' | 'warning' | 'critical';
}

function buildQualityCoachSuggestions(params: {
  snapshots: QualitySnapshot[];
  latestPolicyResult: PolicyEvaluationResult | null;
}): QualityCoachSuggestion[];
```

---

## Phase 136: Security Integration

### 136.0: Security Engine
**File:** `desktop/src/lib/security/securityEngine.ts`

محرك الفحص الأمني:

```typescript
type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface SecurityAlert {
  id: string;
  type: string;
  severity: SecuritySeverity;
  message: string;
  filePath?: string;
  line?: number;
  column?: number;
}
```

### 136.1: Security Watchdog Integration

ربط مع Security Watchdog:

```typescript
type ExternalSecurityStats = {
  totalAlerts: number;
  hasBlocking: boolean;
  bySeverity: Record<SecuritySeverity, number>;
  lastScanAt: string;
};
```

### 136.2: Security Center Panel
**File:** `desktop/src/components/SecurityCenter.tsx`

لوحة عرض التنبيهات الأمنية:
- قائمة التنبيهات
- تصنيف حسب الخطورة
- روابط للملفات المتأثرة

### 136.4: Granular Security Policy

سياسة أمنية مفصلة:

```typescript
// Policy Engine checks:
// 1. Critical security → Always BLOCK
// 2. Too many alerts → BLOCK
// 3. Some alerts → CAUTION
// 4. No alerts → OK

if (thresholds.alwaysBlockOnCriticalSecurity && criticalAlerts > 0) {
  reasons.push({
    code: 'security_critical_present',
    severity: 'critical',
  });
}
else if (totalAlerts > thresholds.maxSecurityAlertsForDeploy) {
  reasons.push({
    code: 'security_too_many_alerts',
    severity: 'critical',
  });
}
else if (totalAlerts > thresholds.maxSecurityAlertsForOK) {
  reasons.push({
    code: 'security_alerts_present',
    severity: 'warning',
  });
}
```

### 136.5: Generate Tests Banner

بانر توليد الاختبارات في المحرر:
- يظهر للملفات بدون اختبارات
- زر "Generate Tests" للتوليد التلقائي

---

## Policy Status Flow

```
┌─────────────────────────────────────────────────┐
│  Collect Data from All Sources                  │
│  ↓                                              │
│  Run Policy Evaluation                          │
│  ↓                                              │
│  ┌─────────────────────────────────────────┐    │
│  │ OK (Clean)      → ✅ Ready to Deploy    │    │
│  │ CAUTION (Risky) → ⚠️ Deploy with Review │    │
│  │ BLOCK (Blocked) → 🚫 Fix Issues First   │    │
│  └─────────────────────────────────────────┘    │
│  ↓                                              │
│  Show Toast + Update UI                         │
│  ↓                                              │
│  Record to History + Coach Suggestions          │
└─────────────────────────────────────────────────┘
```

---

## Key Files Summary

| File | Purpose |
|------|---------|
| `deployQualityTypes.ts` | Deploy gate types |
| `deployQualityContext.tsx` | Central context |
| `qualityPolicyTypes.ts` | Policy threshold types |
| `qualityPolicyContext.tsx` | Policy settings context |
| `policyEngine.ts` | Evaluation logic |
| `policyActions.ts` | Available actions |
| `qualityHistoryTypes.ts` | History tracking |
| `qualityCoach.ts` | Smart suggestions |
| `securityEngine.ts` | Security scanning |

---

## UI Components

### Pre-Deploy Modal
يظهر قبل النشر:
- عرض حالة الجودة
- قائمة المشاكل
- إجراءات الإصلاح
- زر "Deploy Anyway" للـ CAUTION

### Quality Settings Panel
إعدادات سياسة الجودة:
- تعديل الحدود
- تفعيل/تعطيل الفحوصات
- حفظ الإعدادات

### Deploy Badge
شارة في الـ header:
- لون حسب الحالة
- tooltip بالتفاصيل
- نقر لفتح التفاصيل

---

## Usage Example

```tsx
// In App.tsx
<DeployQualityProvider>
  <QualityPolicyProvider>
    <QualityHistoryProvider>
      <Header>
        <DeployBadge />
      </Header>
      <PreDeployModal />
    </QualityHistoryProvider>
  </QualityPolicyProvider>
</DeployQualityProvider>

// In component
function DeployButton() {
  const { canDeploy, policyStatus, policyReasons } = useDeployQuality();

  if (!canDeploy()) {
    return (
      <div>
        <p>Cannot deploy: {policyStatus}</p>
        <ul>
          {policyReasons.map(r => (
            <li key={r.code}>{r.label}</li>
          ))}
        </ul>
      </div>
    );
  }

  return <button onClick={deploy}>Deploy</button>;
}
```

---

## Arabic Summary | ملخص عربي

### Phase 134: أساس بوابة الجودة
- تعريف أنواع البيانات للتقييم
- سياق مركزي لجمع البيانات
- تحديد مستوى الجودة (نظيف/محفوف بالمخاطر/محظور)

### Phase 135: محرك السياسة
- إعدادات قابلة للتخصيص
- محرك تقييم مع أسباب مفصلة
- تتبع تاريخ الجودة
- نظام النصائح الذكية

### Phase 136: تكامل الأمان
- محرك فحص أمني
- ربط مع Security Watchdog
- سياسة أمنية مفصلة
- لوحة عرض التنبيهات

---

**Status:** ✅ Complete
**Date:** November 2024
