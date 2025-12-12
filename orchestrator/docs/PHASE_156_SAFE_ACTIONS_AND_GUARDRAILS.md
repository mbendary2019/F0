# Phase 156 – Safe Actions & Guardrails (Final Safety Layer)

## 1. الهدف من Phase 156

تأمين كل أوامر الـ Agents الخطرة (Shell / Browser / Git / Fixes) بحيث:

- **ولا أمر خطير يتنفّذ بدون وعي المطور.**
- يكون فيه **UI واضح** يوضّح:
  - إيه اللي هيحصل؟
  - ليه محتاج موافقة؟
  - إيه المخاطر؟
- يكون فيه **سجل دائم (Audit Log)** لأي Action مهم:
  - من طلبه؟
  - اتنفّذ أم اترفَض؟
  - على أي مشروع؟ وفي أي وقت؟

Phase 156 تبني فوق:

- SafeAgentBus + BasicSafetyChecker (Phase 155.6)
- PendingActionsPanel + pending-actions API
- GitAgent + ShellAgent + BrowserAgent wiring (Phase 155.5)
- Multi-Agent Federation v2 (Phase 155)

---

## 2. نطاق الأمان (Scope)

الأفعال اللي تعتبر "High-Risk":

1. **Shell Commands**
   - `npm test`, `npm run build`, `npm run migrate`, ...
   - وأي أمر فيه:
     - `rm -rf`
     - `drop database`
     - `mkfs`
     - `shutdown`
     - إلخ.

2. **Browser Flows**
   - أي Test / Flow على:
     - Production URLs
     - Critical dashboards (billing, admin, etc.)

3. **Git Operations**
   - Auto-commit
   - Auto-rollback
   - Force push (لو مفعّل مستقبلاً)

4. **Auto-Fix / Code Modifications واسعة**
   - Batch fixes كبيرة (الكثير من الملفات).
   - Refactors خطيرة (تغيير في core modules).

---

## 3. طبقات الأمان

### 3.1 SafetyChecker (Policies Engine v1)

- يتنادى لكل Message في الـ AgentBus.
- يقرر:
  - `allowed: boolean`
  - `requiresUserConfirm: boolean`
  - `reason: string`

الحالات:

- **Blocked:**
  - أوامر shell مدمّرة (`rm -rf /`، `drop database`، إلخ).
  - أي Action يتجاوز سياسة الـ Profile (مثلاً Beginner مش مسموح له Shell).

- **Requires Confirm:**
  - `npm test` / `npm run build` / `npm run db:migrate`
  - Browser flows على production
  - Git rollback / resets

- **Allowed مباشرة:**
  - قرارات Planner / Review / Test (غير تنفيذية).
  - Logging-only messages (PLAN_UPDATE, INFO_RESPONSE).

### 3.2 SafeAgentBus

- يلف حوالين الـ AgentBus الحالي.
- أي رسالة "خطر/تحتاج موافقة":
  - ما يبعتهوش للـ Agent مباشرة.
  - يسجّلها في **PendingActionsStore**.
  - يرميها على UI (PendingActionsPanel).

### 3.3 PendingActionsStore + Panel

- Store لكل Action منتظر:
  - `id`, `createdAt`, `projectId`, `message`, `riskLevel`, `reason`, `requestedBy`.
- UI:
  - قائمة بالأوامر المنتظرة:
    - Command / URL / Git action
    - Agent (Shell/Browser/Git)
    - سبب المخاطرة (reason)
  - أزرار:
    - **Approve** → يعيد نشر الرسالة للأصل Bus
    - **Reject** → يرفضها ويسجّل في Audit Log

---

## 4. Profiles & Modes (Beginner / Pro / Expert)

ارتباط مباشر مع Phase 149 (Mode Switching):

1. **Beginner Mode**
   - Shell:
     - ممنوع إلا `npm test` و `npm run lint`، وكلهم Requires Confirm.
   - Browser:
     - مسموح على localhost فقط بدون Confirm.
     - Production URLs ⇒ Requires Confirm.
   - Git:
     - Auto-commit Allowed (Requires Confirm).
     - Rollback ⇒ Requires Confirm + Warning.

2. **Pro Mode**
   - Shell:
     - `npm test` / `npm run build` / `npm run db:*` ⇒ Requires Confirm.
     - أوامر عشوائية خطرة ⇒ Blocked.
   - Browser:
     - localhost: Allowed
     - staging: Allowed / Confirm اختياري
     - production: Requires Confirm
   - Git:
     - Auto-commit Allowed
     - Rollback ⇒ Requires Confirm

3. **Expert Mode**
   - Shell:
     - أغلب الأوامر Allowed مع Logs.
     - أوامر "انتحارية" تبقى Blocked دائماً.
   - Browser:
     - production flows Allowed مع Logs + Warning.
   - Git:
     - Auto-commit + Auto-rollback Allowed مع Logs.

---

## 5. Audit Log (يرتبط مع Phase 202 لاحقاً)

Audit Log هدفه:

- يكون عندنا "سجل تاريخي" لكل:
  - Shell Run خطير
  - Browser Flow على production
  - Git Commit / Rollback ناتج عن Agents

Fields:

- `id`
- `projectId`
- `userId`
- `actionType` (shell / browser / git / fix)
- `payloadSummary` (command, url, branch, ...)
- `riskLevel` (low/medium/high)
- `decision` (approved/rejected/blocked/auto)
- `decidedBy` (user / policy / system)
- `createdAt`, `decidedAt`
- `planId` (لو تابع لAgent Plan)

يعيش في:

- Collection Firestore: `agentActionAudit`
- ويظهر لاحقاً في:
  - Phase 177 – Stability Metrics Dashboard
  - Phase 202 – Audit Logs & Compliance Layer

---

## 6. Integration with Multi-Agent Federation (Phase 155)

- SafeAgentBus يشتغل كـ **Gateway** إجباري لكل Agents:
  - ShellAgent
  - BrowserAgent
  - GitAgent
  - AutoFixEngine (فيما بعد)
- Planner / Review / ConversationAgents:
  - يشتغلوا على نفس الـ Bus
  - لكن Messages التنفيذية تمر على SafetyChecker.

---

## 7. تقسيم Phase 156 إلى Sub-Phases

- **156.0 – Safety Architecture Draft (هذا الملف + Policy Model)** ✅ DONE
- **156.1 – SafetyChecker Profiles Integration**
  - ربط BasicSafetyChecker مع User Mode (Beginner/Pro/Expert).
  - تخزين سياسة الأمان per user/workspace.

- **156.2 – PendingActionsStore v2**
  - تأكيد بنية Firestore:
    - `agentPendingActions`
    - `agentActionAudit`
  - تأكيد Flow: Save → Approve/Reject → Move to Audit Log.

- **156.3 – PendingActionsPanel UX (Web + Desktop)**
  - Panel موحد:
    - List + Filters (project / agent / risk).
    - Actions واضحة (Approve / Reject).
    - Tooltips تشرح المخاطر.

- **156.4 – Git & Shell Guardrails**
  - سياسات خاصة للـ GitAgent + ShellAgent:
    - حظر كامل للأوامر المدمّرة.
    - تأكيد إضافي (Double Confirm) لـ Rollback على main / master.

- **156.5 – Safety Report & Telemetry**
  - صفحة صغيرة / Panel:
    - عدد الأوامر:
      - Approved
      - Rejected
      - Blocked by Policy
    - Top risky commands
    - Per-project safety summary
  - يساعد جداً في Phase 177/202.

---

## 8. Definition of Done – Phase 156

Phase 156 تعتبر مكتملة عندما:

1. كل Shell/Browser/Git actions تمر عبر SafetyChecker.
2. PendingActionsPanel يظهر كل الأوامر المنتظرة بوضوح.
3. المطوّر يقدر:
   - يوافق/يرفض من UI
   - يشوف بعدها الأمر في Audit Log.
4. أنماط Beginner / Pro / Expert تؤثر بشكل واضح في:
   - Shell / Browser / Git behavior.
5. Autonomy Loop (Phase 155.7) يلتزم بالـ Guardrails:
   - لا Shell ولا Git خطير بدون Confirm.
   - أي محاولة لأمر مدمّر → Blocked + Audit.

---

## 9. Implementation Status - ✅ PHASE 156 COMPLETE

### All Sub-Phases Completed:

| Sub-Phase | Description | Status | File |
|-----------|-------------|--------|------|
| 156.0 | Safety Architecture Draft | ✅ | This file |
| 156.1 | Mode-Aware SafetyChecker | ✅ | `orchestrator/core/multiAgent/basicSafetyChecker.ts` |
| 156.2 | Firestore PendingActionsStore + AuditLog | ✅ | `orchestrator/core/multiAgent/firestorePendingActionsStore.ts` |
| 156.3 | Enhanced PendingActionsPanel UX v2 | ✅ | `src/components/agents/PendingActionsPanel.tsx` |
| 156.4 | Git & Shell Guardrails | ✅ | Integrated in basicSafetyChecker.ts |
| 156.5 | Safety Dashboard | ✅ | `src/components/agents/SafetyDashboard.tsx` |

### Files Created/Updated:

| Component | File | Description |
|-----------|------|-------------|
| Types | `orchestrator/core/multiAgent/types.ts` | Added `UserMode` type |
| Safety Checker | `orchestrator/core/multiAgent/basicSafetyChecker.ts` | Mode-aware + guardrails |
| Firestore Store | `orchestrator/core/multiAgent/firestorePendingActionsStore.ts` | Persistent storage with audit |
| Panel v2 | `src/components/agents/PendingActionsPanel.tsx` | Filters + tooltips + risk levels |
| Dashboard | `src/components/agents/SafetyDashboard.tsx` | Stats + activity + charts |
| Audit API | `src/app/api/agents/audit-logs/route.ts` | GET audit logs |
| Pending API | `src/app/api/agents/pending-actions/route.ts` | With audit logging |

### Key Features Implemented:

1. **Mode-Aware Safety** (Beginner/Pro/Expert)
   - Beginner: Most shell commands blocked, requires confirm
   - Pro: Important commands require confirm
   - Expert: Most allowed, destructive still blocked

2. **Hard Guardrails** (Can't bypass - any mode)
   - `rm -rf /`, `rm -rf *`, `rm -rf ..`
   - `drop database`, `truncate table`
   - `git push --force`, `git reset --hard`
   - `mkfs`, `shutdown`, `reboot`

3. **Audit Logging**
   - Every approve/reject is logged
   - Stats: approved, rejected, blocked, auto
   - Per-project safety score

4. **Enhanced UX**
   - Risk level badges (high/medium/low)
   - Command preview
   - Expandable tooltips explaining risks
   - Filters by agent type and risk level
