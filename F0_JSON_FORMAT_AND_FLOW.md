# 🎯 F0 JSON Format & Complete Flow

**Date**: 2025-11-26
**Status**: 📘 **SPECIFICATION DOCUMENT**

---

## 🔷 1. THE EXACT [F0_JSON] FORMAT

الـ Agent **لازم** يطلع JSON بالـ format ده بالظبط:

```
[F0_JSON]
{
  "projectId": "Pxxxxxx",
  "lang": "ar",
  "intent": "plan",
  "summary": "...",
  "target_users": [],
  "platforms": [],
  "clarity_score": 1.0,

  "assumptions": {
    "frontend": "",
    "backend": "",
    "db": "",
    "auth": "",
    "payments": "",
    "realtime_data": ""
  },

  "phases": [
    {
      "id": "mvp",
      "title": "Phase 1 — MVP",
      "goals": [],
      "features": []
    },
    {
      "id": "phase2",
      "title": "Phase 2",
      "features": []
    },
    {
      "id": "phase3",
      "title": "Phase 3",
      "features": []
    }
  ],

  "next_actions": [
    { "type": "preflight" },
    { "type": "execute_task", "phase": "mvp", "taskTitle": "" }
  ]
}
[/F0_JSON]
```

### ✅ IMPORTANT RULES:

1. **Markers**: الـ JSON لازم يكون بين `[F0_JSON]` و `[/F0_JSON]` بالظبط
2. **Valid JSON**: لازم يكون valid JSON (no trailing commas, proper escaping)
3. **Hidden from User**: المستخدم **مش هيشوف** الـ JSON ده - الـ UI هيخفيه
4. **Natural Text First**: الـ Agent يكتب كلام طبيعي للمستخدم الأول، بعدين يحط الـ JSON في النهاية

---

## 🔷 2. EXAMPLE AGENT RESPONSE (Arabic)

### User Input:
```
عايز أعمل منصة لعرض أسعار الأسهم للمستثمرين في الخليج
```

### Agent Response:
```
تمام! خلصت تخطيط مشروعك في 3 مراحل 🚀

## 📋 الملخص
منصة عرض أسعار الأسهم للمستثمرين في منطقة الخليج، مع تحديثات فورية وواجهة بسيطة.

## 🎯 الخطة

### MVP (المرحلة الأولى)
- عرض أسعار الأسهم الحية
- قائمة الأسهم الرئيسية
- واجهة بسيطة ونظيفة

### Phase 2 (التحسينات)
- رسوم بيانية تفاعلية
- قوائم المراقبة
- إشعارات الأسعار

### Phase 3 (متقدم)
- تحليلات مفصلة
- أخبار السوق
- بحث متقدم

**التقنيات المقترحة:**
- Frontend: Next.js
- Backend: Firebase Functions
- Database: Firestore
- Real-time Data: Stock API (Alpha Vantage)

جاهز نبدأ التنفيذ؟ 💪

[F0_JSON]
{
  "projectId": "P_stock_platform_001",
  "lang": "ar",
  "intent": "plan",
  "summary": "منصة عرض أسعار الأسهم للمستثمرين في الخليج مع تحديثات فورية",
  "target_users": ["المستثمرين في الخليج", "محللين ماليين", "متابعين للأسواق"],
  "platforms": ["web", "mobile"],
  "clarity_score": 1.0,

  "assumptions": {
    "frontend": "Next.js + React Native",
    "backend": "Firebase Functions",
    "db": "Firestore",
    "auth": "Firebase Auth",
    "payments": "غير مطلوب في MVP",
    "realtime_data": "Stock API (Alpha Vantage or similar)"
  },

  "phases": [
    {
      "id": "mvp",
      "title": "Phase 1 — MVP",
      "goals": ["إطلاق سريع للسوق", "التحقق من الفكرة", "جذب المستثمرين الأوائل"],
      "features": [
        "عرض أسعار الأسهم الحية (real-time)",
        "قائمة الأسهم الرئيسية في الخليج",
        "واجهة بسيطة ونظيفة",
        "تسجيل دخول بسيط",
        "تحديث الأسعار كل 5 ثواني"
      ]
    },
    {
      "id": "phase2",
      "title": "Phase 2 — التحسينات",
      "features": [
        "رسوم بيانية تفاعلية (charts)",
        "قوائم المراقبة (watchlists)",
        "إشعارات تنبيه الأسعار",
        "مقارنة بين الأسهم",
        "تاريخ الأسعار"
      ]
    },
    {
      "id": "phase3",
      "title": "Phase 3 — متقدم",
      "features": [
        "تحليلات مفصلة ومؤشرات فنية",
        "أخبار السوق والتحديثات",
        "بحث متقدم وفلاتر",
        "API للمطورين",
        "تطبيق موبايل كامل"
      ]
    }
  ],

  "next_actions": [
    { "type": "preflight" },
    { "type": "execute_task", "phase": "mvp", "taskTitle": "Setup Next.js project structure" },
    { "type": "execute_task", "phase": "mvp", "taskTitle": "Integrate stock API" },
    { "type": "execute_task", "phase": "mvp", "taskTitle": "Build stock list UI component" }
  ]
}
[/F0_JSON]
```

### What the User Sees:
```
تمام! خلصت تخطيط مشروعك في 3 مراحل 🚀

## 📋 الملخص
منصة عرض أسعار الأسهم للمستثمرين في منطقة الخليج...

[... rest of natural text ...]

جاهز نبدأ التنفيذ؟ 💪
```

### What the System Sees:
```json
{
  "projectId": "P_stock_platform_001",
  "lang": "ar",
  "intent": "plan",
  ...
}
```

---

## 🔷 3. UI PROCESSING FLOW

### Step 1: Receive Agent Response
```typescript
// In your React component (e.g., AgentChat.tsx)
const agentResponse = await fetch('/api/agent/run', {
  method: 'POST',
  body: JSON.stringify({ projectId, intent: 'continue', message: userMessage }),
});

const data = await agentResponse.json();
const fullResponse = data.message; // Complete agent response with JSON
```

### Step 2: Extract JSON
```typescript
// Extract [F0_JSON]...[/F0_JSON] block
const jsonMatch = fullResponse.match(/\[F0_JSON\]([\s\S]*?)\[\/F0_JSON\]/);

let f0JsonPayload = null;
if (jsonMatch) {
  try {
    f0JsonPayload = JSON.parse(jsonMatch[1].trim());
    console.log('[F0] Extracted JSON payload:', f0JsonPayload);
  } catch (err) {
    console.error('[F0] Failed to parse F0_JSON:', err);
  }
}
```

### Step 3: Clean Message for Display
```typescript
// Remove JSON block from user-visible message
const cleanedMessage = fullResponse
  .replace(/\[F0_JSON\]([\s\S]*?)\[\/F0_JSON\]/, '')
  .trim();

// Display only the natural text to user
setMessages([...messages, {
  role: 'assistant',
  content: cleanedMessage, // User sees this
}]);
```

### Step 4: Process JSON in Backend
```typescript
// Send JSON to backend for processing
if (f0JsonPayload) {
  await fetch('/api/f0/process-json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(f0JsonPayload),
  });
}
```

---

## 🔷 4. BACKEND PROCESSING (`/api/f0/process-json`)

```typescript
// src/app/api/f0/process-json/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreAdmin } from '@/lib/server/firebase';

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const db = getFirestoreAdmin();

  const {
    projectId,
    lang,
    summary,
    target_users,
    platforms,
    assumptions,
    phases,
    next_actions,
  } = payload;

  console.log('[F0] Processing JSON for project:', projectId);

  // 1️⃣ Update Project Memory
  await db.collection('projects').doc(projectId).set({
    summary,
    target_users,
    platforms,
    assumptions,
    updatedAt: Date.now(),
  }, { merge: true });

  // 2️⃣ Create Phases
  for (const phase of phases) {
    const phaseRef = db
      .collection('projects')
      .doc(projectId)
      .collection('phases')
      .doc(phase.id);

    await phaseRef.set({
      id: phase.id,
      title: phase.title,
      goals: phase.goals || [],
      features: phase.features || [],
      status: 'pending',
      createdAt: Date.now(),
    });

    // 3️⃣ Create Tasks for each feature
    if (phase.features && phase.features.length > 0) {
      for (let i = 0; i < phase.features.length; i++) {
        const taskRef = phaseRef.collection('tasks').doc();
        await taskRef.set({
          id: taskRef.id,
          phaseId: phase.id,
          title: phase.features[i],
          status: 'open',
          createdAt: Date.now(),
          source: 'agent',
        });
      }
    }
  }

  // 4️⃣ Trigger Next Actions (if any)
  if (next_actions && next_actions.length > 0) {
    for (const action of next_actions) {
      if (action.type === 'execute_task' && action.taskTitle) {
        // Queue task for Code Agent
        await db.collection('task_queue').add({
          projectId,
          phase: action.phase,
          taskTitle: action.taskTitle,
          status: 'queued',
          createdAt: Date.now(),
        });
      }
    }
  }

  console.log('[F0] JSON processing complete');

  return NextResponse.json({ ok: true });
}
```

---

## 🔷 5. COMPLETE FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│ 1) USER                                                         │
│    Types: "عايز أعمل منصة تداول"                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2) F0 AGENT (with new System Prompt)                           │
│    - Idea Discovery (asks 2-3 questions)                        │
│    - Idea Summary (confirms understanding)                      │
│    - Phased Planning (MVP → Phase 2 → Phase 3)                 │
│    - Tech Stack (brief)                                         │
│    - Returns: Natural Text + [F0_JSON] block                    │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3) UI (React Component)                                         │
│    - Receives full response                                     │
│    - Extracts JSON using regex                                  │
│    - Displays ONLY natural text to user                         │
│    - Sends JSON to backend (/api/f0/process-json)              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4) BACKEND (/api/f0/process-json)                              │
│    - Updates project memory (summary, users, platforms)         │
│    - Creates phases in Firestore                                │
│    - Creates tasks for each feature                             │
│    - Queues next_actions for Code Agent                         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5) CODE AGENT                                                   │
│    - Picks up queued tasks                                      │
│    - Generates code for each task                               │
│    - Creates:                                                   │
│      * Pages                                                    │
│      * API routes                                               │
│      * Components                                               │
│      * Functions                                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6) UI (IDE/Sandbox)                                             │
│    - Displays generated code                                    │
│    - Shows RefactorDock for patches                             │
│    - Allows user to commit changes                              │
│    - Syncs with GitHub/Vercel                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔷 6. EXAMPLE IMPLEMENTATION

### Frontend Component:
```typescript
// src/components/AgentChat.tsx

import { useState } from 'react';

export function AgentChat({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');

  async function handleSend() {
    // Add user message
    setMessages([...messages, { role: 'user', content: input }]);

    // Call agent
    const response = await fetch('/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        intent: 'continue',
        message: input,
      }),
    });

    const data = await response.json();
    const fullResponse = data.message;

    // Extract JSON
    const jsonMatch = fullResponse.match(/\[F0_JSON\]([\s\S]*?)\[\/F0_JSON\]/);
    let f0Json = null;

    if (jsonMatch) {
      try {
        f0Json = JSON.parse(jsonMatch[1].trim());
        console.log('[F0] Extracted JSON:', f0Json);

        // Process JSON in backend
        await fetch('/api/f0/process-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(f0Json),
        });
      } catch (err) {
        console.error('[F0] Failed to parse JSON:', err);
      }
    }

    // Clean message for display (remove JSON)
    const cleanMessage = fullResponse
      .replace(/\[F0_JSON\]([\s\S]*?)\[\/F0_JSON\]/, '')
      .trim();

    // Add agent message (WITHOUT JSON)
    setMessages([...messages, { role: 'user', content: input }, { role: 'assistant', content: cleanMessage }]);
    setInput('');
  }

  return (
    <div>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

---

## 🔷 7. KEY BENEFITS

### ✅ For Users:
- يشوف كلام طبيعي وودود
- مافيش JSON معقد في الواجهة
- تجربة استخدام سلسة

### ✅ For System:
- JSON نظيف ومنظم
- سهل parsing ومعالجة
- متوافق مع الـ F0 Pipeline

### ✅ For Agents:
- واضح إيه المطلوب
- Format محدد بدقة
- مافيش غموض في الـ output

---

## 🔷 8. TESTING

### Manual Test:
```bash
curl -X POST http://localhost:3030/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test",
    "intent": "continue",
    "message": "عايز أعمل منصة تداول أسهم"
  }'
```

### Expected Response Structure:
```
تمام! خلصت تخطيط مشروعك...

[natural text here]

[F0_JSON]
{...}
[/F0_JSON]
```

### Validation Checklist:
- [ ] Agent returns `[F0_JSON]` markers
- [ ] JSON is valid (no syntax errors)
- [ ] UI extracts JSON correctly
- [ ] UI displays only natural text
- [ ] Backend processes JSON
- [ ] Phases created in Firestore
- [ ] Tasks created for features
- [ ] Next actions queued

---

## ✨ Summary

**The [F0_JSON] format is the bridge between:**
- Human-readable conversation (User-facing)
- Structured data (System-facing)

**Key Rules:**
1. ✅ Agent outputs natural text + JSON
2. ✅ JSON wrapped in `[F0_JSON]` markers
3. ✅ UI hides JSON from user
4. ✅ Backend processes JSON automatically
5. ✅ Tasks and phases auto-generated

**Result**: Seamless experience where users see friendly chat, but the system builds a complete project structure automatically! 🚀
