# ✅ Phase 95.2: Action Planner Agent — دليل سريع

**الحالة**: ✅ **مكتمل**
**التاريخ**: 2025-11-25

---

## 🎯 الهدف

إنشاء Agent ذكي يحوّل طلبات المستخدم (بالعربي أو الإنجليزي) إلى خطة تنفيذية منظمة (ActionPlan) جاهزة للتشغيل.

---

## 📦 اللي اتعمل

### 1. **الملف الأساسي**: [src/lib/agent/actions/actionPlanner.ts](src/lib/agent/actions/actionPlanner.ts)

**470 سطر** كود TypeScript متكامل.

#### الدالة الرئيسية:

```typescript
const result = await planActions({
  projectId: 'my-project',
  userId: 'user-123',
  userInput: 'عايز أضيف Stripe للدفع',
  locale: 'ar',
});

console.log(result.plan.steps.length); // عدد الخطوات
```

### 2. **Multi-Step Hybrid Approach**

الـ Agent بيشتغل بالطريقة دي:

1. **يحمّل الذاكرة** (Phase 94)
   - يجيب كل قرارات المشروع السابقة
   - يتأكد إن الخطة متناقضش معاها

2. **يبني System Prompt شامل**
   - فيه كل الـ memory
   - فيه كل الـ 12 action types
   - فيه JSON schema كامل

3. **يكلّم الموديل**
   - الموديل يفكّر داخليًا
   - يطلّع برّه JSON بس

4. **ينظّف و يصحح JSON**
   - يستخرج JSON من أي نص
   - يضيف IDs و timestamps
   - يستنتج الـ categories الناقصة

### 3. **API Route**: [src/app/api/agent/plan/route.ts](src/app/api/agent/plan/route.ts)

```bash
POST /api/agent/plan

Body:
{
  "projectId": "my-project",
  "userId": "user-123",
  "userInput": "عايز أضيف Stripe للدفع",
  "locale": "ar"
}

Response:
{
  "ok": true,
  "plan": { /* ActionPlan */ }
}
```

---

## 🧩 مثال عملي

### المدخل:
```typescript
{
  projectId: 'my-saas',
  userId: 'user-123',
  userInput: 'عايز أضيف Stripe كامل - ملفات، ENV، و الذاكرة',
  locale: 'ar'
}
```

### المخرج:
```json
{
  "id": "plan-abc123",
  "summary": "Add complete Stripe integration",
  "steps": [
    {
      "index": 0,
      "status": "PENDING",
      "action": {
        "action": "WRITE_FILE",
        "path": "src/lib/stripe.ts",
        "content": "/* Stripe client code */"
      }
    },
    {
      "index": 1,
      "action": {
        "action": "WRITE_FILE",
        "path": "src/app/api/create-payment-intent/route.ts",
        "content": "/* Payment API */"
      }
    },
    {
      "index": 2,
      "action": {
        "action": "UPDATE_ENV",
        "key": "STRIPE_SECRET_KEY",
        "value": "sk_test_...",
        "scope": "LOCAL"
      }
    },
    {
      "index": 3,
      "action": {
        "action": "APPEND_MEMORY_NOTE",
        "sectionId": "TECH_STACK",
        "note": "Added Stripe"
      }
    }
  ]
}
```

---

## 🔗 التكامل مع Phases السابقة

### مع Phase 94 (Memory):
```typescript
// 1) يحمّل الذاكرة
const memory = await getProjectMemory(projectId);

// 2) يبني prompt منها
const memoryPrompt = buildProjectMemorySystemPrompt(memory);

// 3) الـ Planner يحترم كل القرارات في الذاكرة
```

### مع Phase 95.1 (Action Schema):
```typescript
// كل الـ actions من النوع الصحيح
import { ActionPlan, AnyAction } from './actionTypes';

const plan: ActionPlan<AnyAction> = { /* ... */ };
```

---

## 🎯 المميزات الأساسية

### 1. **Multi-Step Hybrid**
- الموديل يفكّر داخليًا (أفضل reasoning)
- يطلّع JSON بس (أسهل parsing)

### 2. **JSON Extraction قوي**
- يقدر يطلّع JSON حتى لو ملفوف في markdown
- يقدر يتعامل مع نص قبل أو بعد JSON
- رسائل خطأ واضحة

### 3. **Normalization تلقائي**
- لو الموديل نسي حاجة، نضيفها احنا
- كل action ليه ID و timestamp
- مضمون التنفيذ

### 4. **تكامل مع الذاكرة**
- كل خطة تحترم قرارات المشروع
- ما فيش تناقضات
- Context-aware planning

---

## 🧪 الاختبار

### تشغيل الاختبارات:
```bash
node test-phase95-2-action-planner.js
```

### النتيجة المتوقعة:
```
🎯 Phase 95.2: Testing Action Planner Agent

📝 Test 1: Simple File Creation
✅ Planner responded successfully
✅ Plan structure is valid!

📝 Test 2: Complex Multi-Action Request
✅ Planner responded successfully
📊 Action Type Analysis:
   - Has File Action: ✅
   - Has ENV Action: ✅
   - Has Memory Action: ✅
🎉 SUCCESS!
```

---

## 📊 الإحصائيات

| المقياس | القيمة |
|---------|--------|
| عدد الأسطر | 470 |
| الدوال العامة | 1 |
| الدوال المساعدة | 8 |
| الـ Actions المدعومة | 12 |
| نقاط التكامل | 2 (Phase 94, 95.1) |

---

## 🚀 الخطوات الجاية

### Phase 95.3: Action Runner
- تنفيذ الخطط المولدة
- Executor لكل action type
- Error handling و Logging

### Phase 95.5: Action Storage
- حفظ الخطط في Firestore
- History و Replay

---

## 🎉 خلاصة

**Phase 95.2 مكتمل! ✅**

Action Planner Agent شغال و متكامل مع:
- ✅ Phase 94 (Memory System)
- ✅ Phase 95.1 (Action Schema)

يقدر يحوّل أي طلب عربي أو إنجليزي لخطة تنفيذية منظمة جاهزة للتشغيل!

**الملفات**:
- [src/lib/agent/actions/actionPlanner.ts](src/lib/agent/actions/actionPlanner.ts)
- [src/app/api/agent/plan/route.ts](src/app/api/agent/plan/route.ts)
- [test-phase95-2-action-planner.js](test-phase95-2-action-planner.js)
