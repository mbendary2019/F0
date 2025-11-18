# Sprint 14 — Human-in-the-Loop (HITL) Reviews & Red-Teaming

## 🎯 Objectives

Transform flagged AI outputs into a human review workflow with clear triage, assignment, review, and resolution stages. Add remediation tools for safe regeneration and PII redaction, plus a comprehensive red-teaming toolkit for proactive adversarial testing.

### Key Goals

1. **HITL Review Queue**: Convert flagged outputs to reviewable items with status tracking
2. **Remediation Tools**: Safe regeneration, PII redaction, summarization
3. **Red-Teaming**: Adversarial prompt bank with scheduled testing
4. **Policy Engine**: Configurable rules for escalation and auto-actions
5. **Reviewer Dashboard**: Filtering, search, metrics (MTTD/MTTR)

---

## 🗃️ Firestore Schema

### `ai_reviews/{reviewId}`

```typescript
{
  uid: string;                    // User who triggered the evaluation
  runId: string;                  // Reference to ai_evals/{model}/runs/{runId}
  model: string;                  // AI model used
  createdAt: Timestamp;
  status: 'queued' | 'assigned' | 'in_review' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  labels: ['toxicity', 'pii', 'bias', 'hallucination', 'factuality', 'safety'];

  assignedTo?: string;            // Reviewer UID
  slaDueAt?: Timestamp;           // SLA deadline

  outcome?: {
    action: 'regenerate' | 'redact' | 'approve' | 'reject';
    notes: string;
    artifacts?: {
      safeTextUrl?: string;       // Cloud Storage URL
      redactedText?: string;
    };
  };

  timeline: [{
    ts: number;
    actor: string;
    event: string;
    diff?: Record<string, any>;
  }];

  // Evaluation metadata
  quality: number;
  bias: number;
  toxicity: number;
  piiLeak: boolean;
  promptHash: string;
  outputHash: string;
  promptPreview?: string;         // If AI_EVAL_STORE_PROMPTS=true
  outputPreview?: string;
}
```

### `ai_policies/{policyId}`

```typescript
{
  name: string;
  enabled: boolean;
  conditions: [{
    field: string;                // e.g., 'toxicity', 'piiLeak'
    operator: 'gt' | 'lt' | 'eq' | 'contains' | 'in';
    value: any;
  }];
  actions: [{
    type: 'set_severity' | 'set_sla' | 'auto_assign' | 'escalate';
    params: Record<string, any>;
  }];
  thresholds?: Record<string, number>;
  priority: number;               // Higher = applied first
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `redteam_tests/{testId}`

```typescript
{
  category: string;               // 'jailbreak', 'pii_extraction', 'toxic_generation'
  prompt: string;                 // Adversarial prompt
  expected: 'reject' | 'safe_response' | 'no_pii' | 'factual';
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
}
```

### `redteam_runs/{runId}`

```typescript
{
  startedAt: Timestamp;
  finishedAt?: Timestamp;
  pass: boolean;                  // All tests passed
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: [{
    testId: string;
    pass: boolean;
    actualOutput?: string;
    notes?: string;
    flagged?: boolean;
    quality?: number;
    toxicity?: number;
    bias?: number;
    piiLeak?: boolean;
  }];
  metadata?: {
    model?: string;
    triggeredBy?: string;
  };
}
```

---

## 🧩 Cloud Functions

### **HITL Functions**

1. **`hitlQueueIngest`** (Scheduled - every 1 minute)
   - Queries `ai_evals/{model}/runs` for flagged outputs created in last 2 minutes
   - Creates `ai_reviews` documents with severity and SLA
   - Applies policy rules via `policyEvaluate`
   - Logs to audit trail

2. **`hitlAssign`** (Callable)
   - Assigns review to caller or specified reviewer
   - Updates `status='assigned'`, `assignedTo=uid`
   - Adds timeline event
   - Returns updated review

3. **`hitlResolve`** (Callable)
   - Marks review as resolved with outcome
   - Stores action (regenerate/redact/approve/reject)
   - Uploads artifacts to Cloud Storage if applicable
   - Calculates MTTR (Mean Time To Resolve)

4. **`safeRegenerate`** (Callable)
   - Re-generates AI output with safety constraints:
     - Lower temperature (0.3)
     - Safety system prompt
     - Content filtering enabled
   - Stores safe output in Cloud Storage
   - Returns signed URL (7-day expiry)

5. **`redactPII`** (Callable)
   - Detects and redacts PII from input text:
     - Emails → `[EMAIL]`
     - Phone numbers → `[PHONE]`
     - SSNs → `[SSN]`
     - Credit cards → `[CARD]`
     - Addresses → `[ADDRESS]`
   - Returns redacted text
   - Optionally stores in Cloud Storage

### **Red-Teaming Functions**

6. **`redteamRun`** (Callable/Scheduled - weekly)
   - Fetches all active `redteam_tests`
   - Executes each test against target model
   - Evaluates outputs (flagged, quality, toxicity, bias, PII)
   - Creates `redteam_runs` document with results
   - Sends alert if pass rate < threshold

### **Policy Functions**

7. **`policyEvaluate`** (Internal utility)
   - Evaluates review data against all enabled `ai_policies`
   - Applies matching policies in priority order
   - Returns severity, SLA, auto-assignment, escalation actions

---

## 🌐 API Routes

All routes require `reviewer` or `admin` custom claim.

### **HITL APIs**

- **`GET /api/admin/hitl/reviews`**
  - Query params: `status`, `severity`, `assignedTo`, `labels`, `limit`, `offset`
  - Returns paginated list of reviews
  - Includes aggregated metrics (backlog, MTTD, MTTR)

- **`POST /api/admin/hitl/assign`**
  - Body: `{ reviewId, assignedTo? }`
  - Assigns review to caller (if assignedTo not provided) or specified reviewer
  - Returns updated review

- **`POST /api/admin/hitl/resolve`**
  - Body: `{ reviewId, action, notes, artifacts? }`
  - Resolves review with outcome
  - Returns updated review

### **Red-Teaming APIs**

- **`GET /api/admin/redteam/summary`**
  - Returns recent run summaries
  - Includes pass rates, category breakdown, trends

- **`POST /api/admin/redteam/tests`**
  - CRUD operations for test cases
  - Body: `{ category, prompt, expected, severity, tags }`

- **`POST /api/admin/redteam/run`**
  - Triggers manual red-team run
  - Body: `{ model?, testIds? }`
  - Returns run ID

### **Policy APIs**

- **`GET /api/admin/policies`**
  - Returns all policies

- **`POST /api/admin/policies`**
  - Create/update policy
  - Body: `AIPolicy` object
  - Validates conditions and actions

- **`DELETE /api/admin/policies/{policyId}`**
  - Deletes policy

---

## 🖥️ UI Pages

### **/admin/hitl** - Review Queue

**Features:**
- Table with columns: Severity, Labels, Model, Created, Status, Assignee, SLA
- Filters: Status, Severity, Labels, Assignee, Date range
- Bulk actions: "Assign to Me", "Bulk Resolve"
- Search: Filter by review ID, model, user ID
- KPIs: Backlog count, Avg MTTD, Avg MTTR, Throughput per reviewer

**Review Drawer:**
- Opens when clicking a review row
- Displays: Metadata, Labels, Evaluation scores, Timeline
- Actions:
  - **Regenerate Safe**: Calls `safeRegenerate`, displays safe output
  - **Redact PII**: Calls `redactPII`, displays redacted text
  - **Approve**: Resolves with action='approve'
  - **Reject**: Resolves with action='reject'
- Notes textarea for reviewer comments
- Timeline showing all events (created, assigned, resolved)

### **/admin/redteam** - Red-Teaming Dashboard

**Features:**
- Test bank management: Add/edit/delete tests
- Category tabs: Jailbreak, PII Extraction, Toxic Generation, Hallucination, Factuality
- Run history table: Date, Total, Passed, Failed, Pass Rate, Model
- Run details view: Per-test results, flagged outputs, notes
- Manual run trigger: Select model and test subset
- KPIs: Overall pass rate, Trend chart (last 30 days), Coverage by category

### **/admin/policies** - Policy Editor

**Features:**
- Policy list: Name, Enabled, Priority, Last Updated
- Policy editor:
  - JSON/YAML editor with syntax highlighting
  - Visual builder (optional): Conditions (field, operator, value) + Actions
  - Validate button: Checks syntax and logic
  - Test button: Simulates policy against sample review data
- Default policies: Pre-loaded templates (Critical PII, High Toxicity, etc.)

---

## 🔐 Security & RBAC

### Firestore Rules

```javascript
// ai_reviews - Reviewer/Admin access
match /ai_reviews/{reviewId} {
  allow read: if isReviewer() || isAdmin();
  allow write: if false; // Functions only
}

// ai_policies - Admin only
match /ai_policies/{policyId} {
  allow read, write: if isAdmin();
}

// redteam_tests, redteam_runs - Admin only
match /redteam_tests/{testId} {
  allow read, write: if isAdmin();
}

match /redteam_runs/{runId} {
  allow read: if isReviewer() || isAdmin();
  allow write: if false; // Functions only
}

function isReviewer() {
  return request.auth != null &&
         (request.auth.token.reviewer == true || request.auth.token.admin == true);
}

function isAdmin() {
  return request.auth != null && request.auth.token.admin == true;
}
```

### Custom Claims

Add `reviewer: true` custom claim for reviewers:

```bash
firebase functions:shell
> admin.auth().setCustomUserClaims('USER_UID', { reviewer: true });
```

### Audit Logging

Log all HITL, red-team, and policy events:

```typescript
await db.collection('audit_logs').add({
  ts: admin.firestore.FieldValue.serverTimestamp(),
  actor: uid,
  action: 'hitl.assign' | 'hitl.resolve' | 'redteam.run' | 'policy.update',
  resource: `ai_reviews/${reviewId}`,
  status: 'success' | 'error',
  metadata: { ... }
});
```

---

## 📊 Metrics & KPIs

### Review Queue Metrics

- **Backlog**: Count of reviews with `status != 'resolved'`
- **MTTD** (Mean Time To Detect): Avg time from `createdAt` to first human view
- **MTTR** (Mean Time To Resolve): Avg time from `createdAt` to `resolved`
- **Throughput**: Reviews resolved per reviewer per day
- **SLA Compliance**: % of reviews resolved before `slaDueAt`

### Red-Team Metrics

- **Pass Rate**: `passedTests / totalTests`
- **Coverage**: Tests per category
- **Trend**: Pass rate over time (last 30 days)
- **Failure Hotspots**: Most failed test categories

### Policy Metrics

- **Policy Hit Rate**: % of reviews matched by each policy
- **Auto-Assignment Rate**: % of reviews auto-assigned by policies
- **Escalation Rate**: % of reviews escalated to critical

---

## 🔄 Workflow Diagrams

### HITL Review Workflow

```
Flagged Output (ai_evals)
        ↓
hitlQueueIngest (every 1m)
        ↓
Create ai_reviews (status=queued)
        ↓
Apply Policies (severity, SLA, auto-assign)
        ↓
[Queued] → Reviewer assigns → [Assigned]
        ↓
Reviewer investigates → [In Review]
        ↓
Reviewer takes action:
  - Regenerate Safe → safeRegenerate → Artifact
  - Redact PII → redactPII → Artifact
  - Approve → outcome={action:'approve'}
  - Reject → outcome={action:'reject'}
        ↓
hitlResolve → [Resolved]
        ↓
Calculate MTTR, update metrics
```

### Red-Team Workflow

```
redteam_tests (bank of prompts)
        ↓
redteamRun (callable/scheduled)
        ↓
For each test:
  - Execute against model
  - Evaluate output (quality, toxicity, bias, PII)
  - Determine pass/fail
        ↓
Create redteam_runs document
        ↓
If pass rate < threshold → Send alert
        ↓
Dashboard displays results
```

---

## ✅ Definition of Done

- [ ] Flagged run automatically becomes `ai_reviews` within ≤ 1 minute
- [ ] Reviewer can assign, review, and resolve with outcome + timeline
- [ ] Regenerate Safe and Redact PII work and store safe artifacts
- [ ] Dashboard displays MTTD/MTTR and backlog metrics
- [ ] Red-team runs batch tests and produces pass/fail summary
- [ ] Policies are active and affect severity/actions
- [ ] RBAC enforced (reviewer/admin custom claims)
- [ ] All actions logged to `audit_logs`
- [ ] Documentation complete (PRD, Reviewer Guide, Policy Rules, Red-Team Playbook, Testing)

---

## 🚀 Future Enhancements

1. **Risk Buckets**: Auto-classify reviews as LOW/MEDIUM/HIGH/CRITICAL
2. **Model Leaderboard**: Compare quality/flagged rate per model
3. **Collaborative Review**: Multiple reviewers, consensus voting
4. **Auto-Resolution**: ML model to auto-approve low-risk reviews
5. **Integration with Ticketing**: Jira, Linear, Asana sync
6. **SLA Notifications**: Email/Slack alerts for approaching SLA deadlines

---

## 📝 Related Documentation

- [REVIEWER-GUIDE.md](./REVIEWER-GUIDE.md) - SOP for reviewers
- [POLICY-RULES.md](./POLICY-RULES.md) - Policy syntax and examples
- [REDTEAM-PLAYBOOK.md](./REDTEAM-PLAYBOOK.md) - Test categories and scheduling
- [SPRINT-14-TESTING.md](./SPRINT-14-TESTING.md) - E2E test scenarios
