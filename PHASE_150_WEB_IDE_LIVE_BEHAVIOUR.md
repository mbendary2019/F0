# Phase 150 - Web IDE Live Panel & Gate Behaviour

## Overview

Phase 150 implements the Web IDE Live Panel with unified runtime state and deploy gate synchronization between Desktop IDE and Web Dashboard.

---

## Architecture

### Unified Runtime State

```
Desktop IDE → Firestore → Web IDE
    ↓              ↓           ↓
qualitySync    projects/{id}/  useProjectRuntime
aceRunSync     qualitySnapshots   ↓
securitySync   aceRuns         useProjectQualityWithRuntime
testsSync      security/latest useWebDeployGateWithRuntime
               tests/latest
```

### Key Files

| File | Purpose |
|------|---------|
| `src/shared/runtime/projectRuntime.ts` | Shared types (LOCKED) |
| `src/shared/quality/deployGateEngine.ts` | Gate logic (LOCKED) |
| `src/hooks/useProjectRuntime.ts` | Unified hook (LOCKED) |
| `src/hooks/useProjectQuality.ts` | Quality hook |
| `src/hooks/useWebDeployGate.ts` | Gate hook |
| `desktop/src/lib/runtime/*.ts` | Desktop sync writers |

---

## Firestore Schema

### Quality Snapshots
```
projects/{projectId}/qualitySnapshots/{snapshotId}
{
  source: 'scan' | 'auto_fix_after_scan',
  filesScanned: number,
  totalIssues: number,
  score: number (0-100),
  status: 'good' | 'caution' | 'needs_work' | 'blocked',
  recordedAt: Timestamp
}
```

### ACE Runs
```
projects/{projectId}/aceRuns/{runId}
{
  startedAt: Timestamp,
  finishedAt: Timestamp,
  filesProcessed: number,
  totalApplied: number,
  totalErrors: number,
  targetedIssues?: number,
  totalSkipped?: number,
  issuesBefore?: number,
  issuesAfter?: number,
  projectRoot?: string,
  source: 'guided' | 'auto' | 'manual' | 'web',
  jobId?: string
}
```

### Security Stats
```
projects/{projectId}/security/latest
{
  totalAlerts: number,
  hasBlocking: boolean,
  bySeverity?: { low?, medium?, high?, critical? },
  updatedAt: Timestamp
}
```

### Tests Stats
```
projects/{projectId}/tests/latest
{
  status: 'ok' | 'not_run' | 'failing',
  coverage?: number,
  lastRunAt?: Timestamp,
  suites?: { passed?, failed?, skipped? },
  updatedAt: Timestamp
}
```

---

## Hook Usage Pattern

### Correct Usage (Single Instance)
```tsx
// In page component - ONE useProjectRuntime call
const runtime = useProjectRuntime(projectId, { onError: handleError });

// Pass to derived hooks
const { quality } = useProjectQualityWithRuntime(runtime, projectId);
const { decision } = useWebDeployGateWithRuntime(runtime, projectId);
```

### Incorrect Usage (Multiple Instances)
```tsx
// DON'T DO THIS - creates multiple Firestore listeners
const { quality } = useProjectQuality(projectId);      // Instance 1
const { decision } = useWebDeployGate(projectId);      // Instance 2, 3, 4
```

---

## Gate Decision Logic

```
deriveGateDecision(inputs) → { status, reasons }

Status Levels:
- 'ready' (green): No issues, deploy allowed
- 'warning' (amber): Minor issues, review recommended
- 'blocked' (red): Critical issues, deploy blocked

Blocking Reasons:
- security_blocking: Has blocking security alerts
- low_health: Score < minHealthForOK
- tests_failing: Tests failing

Warning Reasons:
- tests_not_run: Tests haven't run (if required)
- low_coverage: Coverage < minCoveragePercent
- quality_needs_work: Status is needs_work/blocked
```

---

## Component Hierarchy

```
/live (page)
├── useProjectRuntime(projectId, { onError })  ← Single instance
│   └── Firestore listeners (quality, ace, security, tests)
│
├── useProjectQualityWithRuntime(runtime)
│   └── Converts runtime to QualitySnapshot
│
├── useWebDeployGateWithRuntime(runtime)
│   └── Derives gate decision from runtime
│
├── QualityBarWeb
│   ├── Shows score, status, issues
│   ├── Loading skeleton support
│   └── Code Evolution button
│
├── WebDeployGateBadge
│   ├── Shows gate status (ready/warning/blocked)
│   └── Loading skeleton support
│
└── WebDeployGateModal
    ├── Quality panel
    ├── Security panel
    ├── Tests panel
    ├── Reasons list
    └── Policy info
```

---

## Error Handling

### Firestore Listener Errors
```tsx
const handleRuntimeError = useCallback((error: RuntimeError) => {
  const labels = {
    quality_listener: { en: 'Quality error', ar: 'خطأ الجودة' },
    ace_listener: { en: 'ACE error', ar: 'خطأ ACE' },
    security_listener: { en: 'Security error', ar: 'خطأ الأمان' },
    tests_listener: { en: 'Tests error', ar: 'خطأ الاختبارات' },
  };

  toast({
    title: locale === 'ar' ? 'خطأ تحميل' : 'Loading error',
    description: `${labels[error.type][locale]}: ${error.message}`,
    variant: 'error',
  });
}, [toast, locale]);
```

---

## Performance Optimizations

1. **Single Runtime Instance**: One Firestore subscription per page
2. **Memoized Conversions**: useMemo for derived data
3. **Skeleton Loading**: Immediate UI feedback
4. **Error Recovery**: Errors tracked per-listener, not global

---

## Bilingual Support

All components support `locale` prop ('en' | 'ar'):
- QualityBarWeb
- WebDeployGateBadge
- WebDeployGateModal
- Error messages

---

## Desktop → Web Sync Writers

Located in `desktop/src/lib/runtime/`:

| Writer | Function |
|--------|----------|
| qualitySync.ts | recordQualitySnapshotToFirestore(), updateLatestQualitySnapshot() |
| aceRunSync.ts | recordAceRunToFirestore(), markAceJobFailed() |
| securitySync.ts | updateSecurityStatsToFirestore(), clearSecurityAlerts() |
| testsSync.ts | updateTestsStatsToFirestore(), markTestsRunning(), recordTestRunResult() |

---

## Log Format

All Phase 150 logs use format:
```
[150.X][MODULE] Message
```

Examples:
- `[150.5][useProjectRuntime] Starting listeners...`
- `[150.6][GATE_WEB] Derived gate decision (optimized)`
- `[150.5][DESKTOP][QUALITY_SYNC] Snapshot written`

---

## Testing Checklist

- [ ] `/live` page loads without errors
- [ ] QualityBar shows skeleton while loading
- [ ] GateBadge shows skeleton while loading
- [ ] Gate modal opens and shows data
- [ ] Arabic locale displays correctly
- [ ] Error toast appears on Firestore error
- [ ] Only one set of Firestore listeners created

---

## Files Created/Modified

### New Files
- `src/shared/runtime/projectRuntime.ts`
- `src/hooks/useProjectRuntime.ts`
- `src/hooks/useProjectQuality.ts` (updated)
- `src/hooks/useProjectSecurity.ts` (updated)
- `src/hooks/useProjectTests.ts` (updated)
- `src/hooks/useWebDeployGate.ts` (updated)
- `src/components/quality/QualityBarWeb.tsx` (updated)
- `src/components/deploy/WebDeployGateBadge.tsx` (updated)
- `src/components/deploy/WebDeployGateModal.tsx`
- `desktop/src/lib/runtime/index.ts`
- `desktop/src/lib/runtime/qualitySync.ts`
- `desktop/src/lib/runtime/aceRunSync.ts`
- `desktop/src/lib/runtime/securitySync.ts`
- `desktop/src/lib/runtime/testsSync.ts`

---

*Phase 150 LOCKED - 2024-12-08*
