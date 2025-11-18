# Phase 33 — Autonomous Ops AI & Predictive LLM Agent

**Version:** v33.0.0  
**Date:** 2025-10-10  
**Owner:** medo bendary  
**Scope:** Autonomous operations with AI-powered decision making, runbooks, and guardian security

---

## 🎯 Overview

Phase 33 introduces a fully autonomous operations system with AI-powered agents that can:
- **Predict** issues before they occur
- **Analyze** system behavior and generate insights
- **Remediate** problems automatically (with guardian approval)
- **Execute** predefined runbooks based on triggers
- **Provide** conversational interface for operations

This system integrates with all previous phases (28-32) to provide a complete autonomous operations platform.

---

## 🧩 Components

### 1. Agent Coordinator (`agentCoordinator`)

**Type:** Cloud Function (Pub/Sub Scheduled)  
**Schedule:** Every 2 minutes  
**Purpose:** Process agent job queue and delegate to appropriate handlers

**Features:**
- Job queue processor (supports 4 job kinds)
- Automatic retry logic
- Result caching
- Guardian integration for security checks

**Job Kinds:**
- `predict` - Forecasting and predictions
- `remediate` - Automated fixes and adjustments
- `report` - Generate operational reports
- `guard` - Security validation checks

**Firestore:**
- Reads: `agent_jobs`, `observability_cache`, `anomaly_events`, `predictions_daily`
- Writes: `agent_jobs`, `ops_commands`, `admin_audit`

---

### 2. Guardian Security Layer

**Type:** Module (imported by coordinator)  
**Purpose:** Multi-layer security validation for all automated actions

**Security Layers:**

1. **Actor Validation**
   - Verify actor exists in `admins` collection
   - Check if actor is suspended

2. **Action Blacklist**
   - Check `ops_policies/denylist` for blocked actions
   - Prevent execution of dangerous operations

3. **Target Protection**
   - Check `ops_policies/protected_targets`
   - Prevent modifications to critical resources

4. **Rate Limiting**
   - Max 10 actions per actor per 5 minutes
   - Prevents automation abuse

5. **Risk Assessment**
   - Classifies actions as low/medium/high risk
   - High-risk requires explicit approval

**Guardian Decision:**
```typescript
{
  allow: boolean;
  reason?: string;
  risk: 'low' | 'medium' | 'high';
  timestamp: number;
}
```

All decisions are logged to `admin_audit` for compliance.

---

### 3. LLM Brain (Analysis Engine)

**Type:** Module (imported by coordinator)  
**Purpose:** Intelligent analysis and recommendations

**Current Implementation:**
- Deterministic rule-based analysis (stub)
- Ready to upgrade to GPT-4/Claude/Gemini

**Analysis Capabilities:**
- Anomaly pattern recognition
- Performance trend analysis
- Risk assessment
- Actionable recommendations

**Output:**
```typescript
{
  summary: string;
  confidence: number; // 0-1
  suggestions: string[];
  analysis: {
    anomalies: number;
    trends: string[];
    risks: string[];
  };
}
```

---

### 4. Runbook Executor (`runbookExecutor`)

**Type:** Cloud Function (Pub/Sub Scheduled)  
**Schedule:** Every 3 minutes  
**Purpose:** Monitor triggers and execute automated playbooks

**Supported Triggers:**
- `error_rate>N` - Error rate percentage
- `errors_per_min>N` - Errors per minute
- `p95>N` - p95 latency in milliseconds
- `calls24h>N` - Total calls in 24 hours

**Runbook Structure:**
```typescript
{
  name: string;
  trigger: string; // e.g., "error_rate>80"
  steps: string[]; // e.g., ["restart_function:api", "notify:slack"]
  cooldown?: number; // minutes
  enabled: boolean;
}
```

**Execution Flow:**
1. Check trigger condition
2. Verify cooldown period
3. Create agent jobs for each step
4. Log to audit trail
5. Update last triggered timestamp

---

### 5. Ops Assistant UI

**Path:** `/admin/ops-assistant`  
**Purpose:** Conversational interface for operations

**Features:**
- Natural language queries
- One-click remediation actions
- Real-time job status
- Activity log
- Quick actions (restart, disable, reduce rate)

**Supported Actions:**
- `restart_function:target` - Restart a Cloud Function
- `disable_endpoint:path` - Disable an API endpoint
- `reduce_rate:target` - Reduce rate limits

---

## 🔐 Security

### Authentication & Authorization
- All API routes protected by `assertAdminReq()`
- Rate limiting: 30 req/min per IP via middleware
- CSRF protection via SameSite cookies

### Guardian Validation
- All remediation actions go through guardian
- High-risk actions require explicit approval
- Protected targets cannot be modified automatically

### Audit Trail
- All actions logged to `admin_audit`
- Guardian decisions logged
- Runbook executions logged
- Job lifecycle events logged

### Data Access
- Read-only access to metrics and anomalies
- Write access only to `agent_jobs` and `ops_commands`
- No direct access to production data

---

## 📊 Firestore Collections

### `agent_jobs` (Queue)
```typescript
{
  kind: 'predict' | 'remediate' | 'report' | 'guard';
  payload: Record<string, unknown>;
  status: 'queued' | 'running' | 'done' | 'rejected';
  createdAt: number;
  updatedAt?: number;
  requestedBy: string; // uid
  result?: any;
  decision?: GuardDecision;
  error?: string;
}
```

**Indexes:**
- `status` ASC, `createdAt` ASC
- `requestedBy` ASC, `createdAt` DESC

---

### `runbooks` (Playbooks)
```typescript
{
  name: string;
  trigger: string;
  steps: string[];
  cooldown?: number; // minutes
  enabled: boolean;
  lastTriggered?: number;
  triggerCount?: number;
  createdBy: string;
  createdAt: number;
}
```

**Indexes:**
- `enabled` ASC, `name` ASC
- `createdBy` ASC, `createdAt` DESC

---

### `ops_commands` (Execution Log)
```typescript
{
  ts: number;
  cmd: string;
  target?: string;
  by: string;
  status?: 'pending' | 'executed' | 'failed';
  result?: any;
}
```

**Indexes:**
- `ts` DESC
- `by` ASC, `ts` DESC

---

### `ops_policies` (Security)
```typescript
// ops_policies/denylist
{
  actions: string[]; // e.g., ["delete_database", "modify_auth"]
}

// ops_policies/protected_targets
{
  targets: string[]; // e.g., ["production", "main_db"]
}
```

---

### `admins` (Actor Management)
```typescript
{
  uid: string;
  email: string;
  roles: string[];
  highRiskApproved?: boolean;
  suspended?: boolean;
}
```

---

## 📡 API Endpoints

### Agent Jobs

#### `GET /api/admin/agents/jobs`
**Description:** List recent agent jobs  
**Auth:** Admin required  
**Response:**
```json
{
  "jobs": [{
    "id": "...",
    "kind": "predict",
    "status": "done",
    "result": { ... },
    "createdAt": 1234567890
  }]
}
```

#### `POST /api/admin/agents/jobs`
**Description:** Create new agent job  
**Auth:** Admin required  
**Body:**
```json
{
  "kind": "predict",
  "payload": {
    "question": "Why is latency high?"
  }
}
```
**Response:**
```json
{
  "ok": true,
  "id": "job123"
}
```

#### `DELETE /api/admin/agents/jobs?id=xxx`
**Description:** Cancel queued job  
**Auth:** Admin required  
**Response:**
```json
{
  "ok": true
}
```

---

### Runbooks

#### `GET /api/admin/runbooks`
**Description:** List all runbooks  
**Auth:** Admin required  
**Response:**
```json
{
  "runbooks": [{
    "id": "...",
    "name": "High Error Rate Response",
    "trigger": "error_rate>80",
    "steps": ["restart_function:api"],
    "enabled": true
  }]
}
```

#### `POST /api/admin/runbooks`
**Description:** Create new runbook  
**Auth:** Admin required  
**Body:**
```json
{
  "name": "High Error Rate Response",
  "trigger": "error_rate>80",
  "steps": [
    "restart_function:api",
    "notify:slack"
  ],
  "cooldown": 30,
  "enabled": true
}
```

#### `PATCH /api/admin/runbooks?id=xxx`
**Description:** Update runbook  
**Auth:** Admin required  
**Body:** Partial runbook object

#### `DELETE /api/admin/runbooks?id=xxx`
**Description:** Delete runbook  
**Auth:** Admin required

---

## 🚀 Deployment

### Prerequisites
1. Phase 28-32 deployed and working
2. Firebase Admin SDK configured
3. Firestore indexes created
4. Environment variables set

### Step 1: Deploy Cloud Functions
```bash
cd functions
npm install
firebase deploy --only functions:agentCoordinator,functions:runbookExecutor
```

**Expected Output:**
```
✓ functions[agentCoordinator] Successful create operation
✓ functions[runbookExecutor] Successful create operation
```

### Step 2: Create Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

Wait 5-10 minutes for indexes to build.

### Step 3: Initialize Policies
Create security policies in Firestore:

```javascript
// ops_policies/denylist
{
  actions: ["delete_database", "modify_auth", "drop_collection"]
}

// ops_policies/protected_targets
{
  targets: ["production", "main_db", "auth_service"]
}
```

### Step 4: Deploy Frontend
```bash
npm run build
firebase deploy --only hosting
```

### Step 5: Create First Runbook
Via Firestore console or API:

```json
{
  "name": "High Error Rate Response",
  "trigger": "error_rate>80",
  "steps": [
    "restart_function:api",
    "reduce_rate:main_api",
    "notify:slack"
  ],
  "cooldown": 30,
  "enabled": true,
  "createdBy": "admin",
  "createdAt": 1234567890,
  "triggerCount": 0
}
```

---

## 🧪 Testing

### Unit Tests
```bash
cd functions
npm test -- agents/
```

### Integration Tests

1. **Test Agent Job Creation:**
```bash
curl -X POST https://your-domain.com/api/admin/agents/jobs \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{"kind":"predict","payload":{"question":"System status?"}}'
```

Expected: `{"ok":true,"id":"..."}`

2. **Test Runbook Creation:**
```bash
curl -X POST https://your-domain.com/api/admin/runbooks \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Test Runbook",
    "trigger":"error_rate>90",
    "steps":["notify:slack"],
    "enabled":false
  }'
```

3. **Test Guardian:**
Create a job with blocked action:
```bash
curl -X POST https://your-domain.com/api/admin/agents/jobs \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json" \
  -d '{"kind":"remediate","payload":{"action":"delete_database","actorUid":"test"}}'
```

Expected: Job should be rejected by guardian.

---

## 📈 Monitoring

### Key Metrics
- Agent jobs processed per minute
- Guardian approval/rejection rate
- Runbook trigger frequency
- Job success/failure rate
- Average job processing time

### Logs
```bash
# View coordinator logs
firebase functions:log --only agentCoordinator

# View runbook executor logs
firebase functions:log --only runbookExecutor
```

### Alerts
Set up alerts for:
- High job rejection rate (>10%)
- Agent coordinator failures
- Runbook cooldown violations
- Guardian security blocks

---

## 🔄 Upgrade Path (LLM Integration)

To upgrade from deterministic logic to real LLM:

1. **Choose Provider:**
   - OpenAI GPT-4
   - Anthropic Claude
   - Google Gemini

2. **Update `llmBrain.ts`:**
```typescript
import OpenAI from 'openai';

export async function llmAnalyze(context: LLMContext): Promise<LLMInsight> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const prompt = `
    Analyze the following system metrics and provide insights:
    
    Metrics: ${JSON.stringify(context.metrics)}
    Recent Anomalies: ${JSON.stringify(context.recentAnomalies)}
    
    Provide:
    1. Summary of system health
    2. Top 5 recommendations
    3. Risk assessment
  `;
  
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });
  
  // Parse response and return LLMInsight
}
```

3. **Add Environment Variable:**
```bash
firebase functions:config:set openai.key="sk-..."
```

4. **Test & Deploy:**
```bash
npm test
firebase deploy --only functions:agentCoordinator
```

---

## 🛡️ Troubleshooting

### Jobs Not Processing
1. Check coordinator logs: `firebase functions:log --only agentCoordinator`
2. Verify jobs are `queued` in Firestore
3. Check Pub/Sub subscription is active

### Runbooks Not Triggering
1. Verify `observability_cache/totals` is being updated
2. Check trigger syntax matches supported formats
3. Verify cooldown period has passed
4. Check `enabled: true`

### Guardian Rejecting All Actions
1. Verify actor exists in `admins` collection
2. Check `ops_policies/denylist` isn't too broad
3. Verify actor has `highRiskApproved: true` for high-risk actions

---

## 📚 Related Documentation

- [Phase 28: Admin RBAC](./ADMIN_RBAC.md)
- [Phase 29: Admin Observability](./ADMIN_OBSERVABILITY.md)
- [Phase 30: Real-Time Dashboard](./ADMIN_REALTIME_OBSERVABILITY.md)
- [Phase 31: AI Insights](./ADMIN_AI_INSIGHTS.md)
- [Phase 32: Predictive AI](./ADMIN_PREDICTIVE_AI.md)

---

## ✅ Success Criteria

- [ ] Agent coordinator processes jobs within 2 minutes
- [ ] Guardian blocks unauthorized actions
- [ ] Runbooks trigger correctly based on metrics
- [ ] Ops Assistant UI loads and responds
- [ ] All API endpoints return correct data
- [ ] Zero TypeScript errors
- [ ] All tests pass
- [ ] Security policies enforced
- [ ] Audit trail complete

---

## 🎊 What's Next?

Phase 33 completes the autonomous operations platform. Future enhancements:

1. **Voice Interface** - Add voice commands to Ops Assistant
2. **ML Models** - Train custom models for your specific patterns
3. **Multi-Region** - Extend to multi-region deployments
4. **Cost Optimization** - Add cost analysis and optimization agents
5. **Incident Management** - Full incident lifecycle automation

---

**Status:** ✅ Production Ready  
**Last Updated:** 2025-10-10  
**Maintainer:** medo bendary


