# Phase 124.4.1 + 124.5: API Query Router & Log-Aware Debugger ✅

## ملخص عربي

تم تنفيذ Phase 124.4.1 و 124.5 بنجاح!

### 124.4.1 - API Query Router
الآن الـ Agent بيفهم:
- "API تسجيل الدخول" → يلاقي /api/auth/login ويفحصه ✅
- "عايز أعمل API لتسجيل الدخول" ومفيش endpoint → يروح للـ planner ويصمم جديد 🔧

### 124.5 - Log-Aware API Debugger
الآن الـ Agent بيقدر:
- يجمع تحليل الكود + الـ runtime logs
- يحدد السبب المحتمل للمشكلة (root cause)
- يقترح خطة إصلاح + code patch

---

## Phase 124.4.1: API Query Router Polish

### New Types
```typescript
type ApiQueryIntent =
  | { kind: 'inspect_existing'; urlPath: string }
  | { kind: 'debug_api'; urlPath: string }
  | { kind: 'design_new' }
  | { kind: 'not_api' };
```

### New Function: `resolveApiIntentFromQuery`
Determines whether to:
- **Inspect existing** API (endpoint found)
- **Debug** a failing API (error keywords detected)
- **Design new** API (endpoint not found)

### API Synonyms Support
Maps Arabic/English keywords to API categories:
- تسجيل الدخول / login → /api/auth/login
- دفع / billing → /api/billing
- محادثة / chat → /api/chat

---

## Phase 124.5: Log-Aware API Debugger

### File: `apiLogsDebugger.ts`

**Types:**
- `LogLevel` - debug, info, warn, error
- `ApiLogEntry` - Log entry from .f0/logs/api-runtime.jsonl
- `ApiLogsSummary` - Aggregated log stats
- `DebugApiEndpointInput/Output` - Tool I/O

**Functions:**
- `getApiLogsSummary()` - Read and parse API logs
- `analyzeRootCause()` - Determine root cause from logs + code
- `debugApiEndpoint()` - Main combined tool
- `formatDebugOutput()` - Format for display

### Error Pattern Detection
- **Undefined property access** → Suggests validation
- **Auth failures** → Suggests auth middleware
- **Database errors** → Suggests connection check
- **Timeouts** → Suggests query optimization

### Example Usage

**User asks:**
```
"ليه /api/auth/login بيرجع 500 أحيانًا؟"
```

**Agent Response:**
```
🔍 تصحيح /api/auth/login

📋 تحليل الكود:
  📁 src/app/api/auth/login/route.ts
  🔧 Methods: POST
  🔐 Auth: Firebase Authentication
  ✅ Validation: لا يوجد

📊 ملخص الـ Logs:
  ❌ Errors: 15
  ⚠️ Warnings: 3
  📈 Most common status: 500

🔴 الأخطاء الشائعة:
  12x: Cannot read properties of undefined (reading 'password')...

🎯 السبب المحتمل:
  ❌ خطأ في قراءة الخاصية 'password' من قيمة undefined

💡 اقتراحات الإصلاح:
  ⚠️ أضف validation للـ request body قبل قراءة 'password'
  💡 أضف check: if (!req.body?.password) return Response.json(...)
  🔧 أضف zod validation للـ POST body
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| [routeAwarePrompt.ts](desktop/src/lib/agent/prompts/routeAwarePrompt.ts) | 📝 Updated |
| [apiLogsDebugger.ts](desktop/src/lib/agent/tools/apiLogsDebugger.ts) | ✨ Created |
| [tools/index.ts](desktop/src/lib/agent/tools/index.ts) | 📝 Updated |

---

## New Tool Definitions

### DEBUG_API
```json
{
  "name": "debug_api",
  "description": "Debug a failing API endpoint by combining static code inspection and recent runtime logs",
  "parameters": {
    "urlPath": "The API URL path to debug",
    "query": "Natural language query about the issue",
    "minutesBack": "How many minutes of logs to analyze (default: 60)"
  }
}
```

---

## Log File Format

Expected at `.f0/logs/api-runtime.jsonl`:
```jsonl
{"timestamp":"2025-11-30T19:45:10.123Z","level":"error","endpoint":"/api/auth/login","statusCode":500,"message":"Cannot read properties of undefined (reading 'password')","stack":"Error: ..."}
```

---

## Intent Flow

```
User Query                    Intent                Action
─────────────────────────────────────────────────────────────
"API تسجيل الدخول"           → inspect_existing    → INSPECT_API
"ليه /api/login بيكسر؟"     → debug_api           → DEBUG_API
"عايز أعمل API جديد"         → design_new          → Planner
"فين صفحة الـ settings"     → not_api             → RESOLVE_ROUTE
```

---

**Phase 124.4.1 + 124.5 Complete!** ✅
