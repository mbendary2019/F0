# Phase 149 – Deploy Gate Behaviour Matrix

> **LOCKED** – Phase 149 Desktop Quality & Deploy Gate v1
> Any major behavioral changes should be done in Phase >= 150

---

## Gate Behaviour Matrix

### Inputs

| Input | Source | Description |
|-------|--------|-------------|
| Health Score (Q) | `qualityHistoryContext` → `latestSnapshot.health` | 0-100 percentage |
| Security Blocking (S) | `externalSecurityStats.hasBlocking` | Boolean - critical/high alerts |
| Tests Status (T) | `externalTestStats.status` | `passing` / `failing` / `not_run` |
| Policy Profile | Active quality policy | `Strict` / `Balanced` / `Relaxed` |

### Decision Rules

```
Rule 1: If S.hasBlocking = true
        → Gate = BLOCKED 🔴
        (Even if Q is high and T is OK)

Rule 2: Else if Q < policy.minHealthForOK
        → Gate = BLOCKED 🔴

Rule 3: Else if T.status = 'failing'
        → Gate = BLOCKED 🔴

Rule 4: Else if T.status = 'not_run' AND policy.requireRecentTests = true
        → Gate = WARNING 🟡

Rule 5: Else
        → Gate = READY 🟢
```

### Gate States

| State | Icon | UI Treatment | Deploy Action |
|-------|------|--------------|---------------|
| `BLOCKED` | 🔴 | Red gradient header, critical warnings | "Deploy anyway" with confirmation |
| `WARNING` | 🟡 | Amber gradient header, caution warnings | "Deploy with caution" |
| `READY` | 🟢 | Green gradient header, all clear | "Deploy now" |

---

## Log Tags (Phase 149.7/149.8)

### Console Filter: `[149.7]`

| Tag | Location | When Logged |
|-----|----------|-------------|
| `[149.7][ISSUES]` | `projectIssuesContext.tsx` | After every project scan |
| `[149.7][ACE]` | `projectIssuesContext.tsx` | When `runAutoFix` starts |
| `[149.7][ACE-Guided]` | `projectIssuesContext.tsx` | When `runAceGuidedAutoFix` starts |
| `[149.7][PROJECT-FIX]` | `projectIssuesContext.tsx` | At start/end of `fixProject` |
| `[149.7][QUALITY]` | `qualityHistoryContext.tsx` | When quality snapshot is applied |
| `[149.7][GATE]` | `PreDeployGateModal.tsx` | When Deploy Gate derives state |

### Log Payloads

**[149.7][ISSUES] Scan completed**
```typescript
{
  source: 'scan' | 'auto_fix_after_scan',
  filesScanned: number,
  issuesBefore: number,
  issuesAfter: number,
  delta: number  // negative = improvement
}
```

**[149.7][QUALITY] Applying quality snapshot**
```typescript
{
  source: string,
  filesScanned: number,
  totalIssues: number,
  score: number,      // 0-100 health
  status: string,     // policy status
  recordedAt: string  // ISO timestamp
}
```

**[149.7][GATE] Derived gate state**
```typescript
{
  healthScore: number | null,
  healthStatus: 'clean' | 'risky' | 'blocked',
  qualityIssues: number,      // from snapshot.totalIssues
  policyReasons: number,      // count of policy violations
  securityAlerts: number,     // from externalSecurityStats.totalAlerts
  securityBlocking: boolean,
  testsStatus: 'passing' | 'failing' | 'not_run',
  gateDecision: 'clean' | 'risky' | 'blocked'
}
```

---

## Wiring Validation

### Expected Flow

```
1. User triggers Scan
   ↓
2. [149.7][ISSUES] Scan completed { source: 'scan', ... }
   ↓
3. [149.7][QUALITY] Applying quality snapshot { ... }
   ↓
4. User opens Deploy Gate
   ↓
5. [149.7][GATE] Derived gate state { ... }
```

### Validation Checklist

- [ ] `totalIssues` in [ISSUES] = `totalIssues` in [QUALITY] = `totalIssues` in [GATE]
- [ ] `healthScore` in [QUALITY].score = `healthScore` in [GATE]
- [ ] No console errors during the flow
- [ ] Gate state matches expected rules from matrix above

---

## Zero-Patch ACE Runs

When ACE runs but finds 0 patches to apply:

### Expected Logs
```
[149.7][ACE-Guided] runAceGuidedAutoFix started { ... }
[149.7][ACE-Guided] Triggering re-scan after guided run... { totalApplied: 0 }
[149.7][ISSUES] Scan completed { source: 'auto_fix_after_scan', delta: 0 }
[149.7][QUALITY] Applying quality snapshot { ... }
```

### Expected UI
- AceLastRunSummaryCard shows: **"لم يجد ACE تغييرات آمنة للتطبيق في هذا التشغيل (0 تصحيحات)."**
- Code Evolution shows run status: `NO_CHANGE`

---

## Locked Files

These files are part of the Phase 149 locked pipeline:

| File | Purpose |
|------|---------|
| `desktop/src/state/projectIssuesContext.tsx` | Issue scanning & ACE orchestration |
| `desktop/src/state/qualityHistoryContext.tsx` | Quality snapshot persistence |
| `desktop/src/components/deploy/PreDeployGateModal.tsx` | Deploy gate UI |
| `desktop/src/components/ace/AceLastRunSummaryCard.tsx` | ACE run summary |
| `desktop/src/components/ace/CodeEvolutionEngineModal.tsx` | Evolution tracking UI |
| `desktop/src/contexts/aceTelemetryContext.tsx` | ACE telemetry storage |
| `desktop/src/lib/quality/codeEvolutionEngine.ts` | Evolution computation |
| `desktop/src/lib/quality/codeEvolutionCopy.ts` | UI copy (EN/AR) |

---

*Phase 149 – Desktop Quality & Deploy Gate v1 (LOCKED)*
