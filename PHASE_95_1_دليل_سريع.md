# ✅ Phase 95.1: Action Schema — دليل سريع

**الحالة**: ✅ **مكتمل**
**التاريخ**: 2025-11-25

---

## 🎯 الهدف

إنشاء Schema شامل بـ TypeScript لكل الـ Actions اللي الـ Agent يقدر يخطط لها وينفذها.

---

## 📦 اللي اتعمل

### ملف واحد فقط: [src/lib/agent/actions/actionTypes.ts](src/lib/agent/actions/actionTypes.ts)

**465 سطر** تعريفات TypeScript تغطي:

### 1. أنواع الـ Actions الأساسية (12 نوع)

#### 📁 File System Actions (4)
- `WRITE_FILE` - كتابة ملف جديد
- `UPDATE_FILE` - تحديث ملف موجود
- `DELETE_FILE` - حذف ملف
- `MKDIR` - إنشاء مجلد

#### 🔥 Firestore Actions (3)
- `CREATE_FIRESTORE_DOC` - إنشاء مستند
- `UPDATE_FIRESTORE_DOC` - تحديث مستند
- `DELETE_FIRESTORE_DOC` - حذف مستند

#### ⚙️ Environment Actions (1)
- `UPDATE_ENV` - تحديث متغير بيئة

#### 🚀 Deployment Actions (1)
- `RUN_DEPLOY` - تنفيذ Deploy

#### 🧠 Memory Actions (2)
- `APPEND_MEMORY_NOTE` - إضافة ملاحظة للذاكرة
- `SET_MEMORY_SECTION` - تحديث قسم في الذاكرة

#### 🔧 Tool Actions (1)
- `CALL_TOOL` - استدعاء أداة خارجية

### 2. هيكل الـ Action Plan

```typescript
interface ActionPlan {
  id: string;                    // معرّف الخطة
  projectId: string;             // المشروع
  summary: string;               // ملخص قصير
  createdBy: 'user' | 'agent';   // من أنشأ الخطة
  createdAt: number;             // الوقت
  userIntent?: string;           // نية المستخدم الأصلية
  steps: PlannedAction[];        // الخطوات المرتبة
  autoExecuted?: boolean;        // تم التنفيذ تلقائيًا؟
}

interface PlannedAction {
  index: number;                 // الترتيب
  action: AnyAction;             // الإجراء نفسه
  status: ActionStatus;          // الحالة
  result?: ActionExecutionResult; // النتيجة (بعد التنفيذ)
}
```

### 3. حالات التنفيذ (ActionStatus)

```typescript
type ActionStatus =
  | 'PENDING'   // منتظر
  | 'SKIPPED'   // متخطّى
  | 'RUNNING'   // شغّال دلوقتي
  | 'SUCCESS'   // نجح
  | 'ERROR';    // فشل
```

---

## 🧩 إزاي هيستخدم في Phase 95.2+

### Phase 95.2: Action Planner Agent
الـ Agent هيرجع `ActionPlan` بخطوات منظمة:

```typescript
const plan: ActionPlan = await actionPlannerAgent({
  projectId: 'my-project',
  userIntent: 'عايز أضيف Stripe للدفع',
});

// Output:
// {
//   id: 'plan-123',
//   summary: 'Add Stripe payment integration',
//   steps: [
//     { action: { action: 'WRITE_FILE', path: 'src/lib/stripe.ts', ... } },
//     { action: { action: 'UPDATE_ENV', key: 'STRIPE_SECRET_KEY', ... } },
//   ]
// }
```

### Phase 95.3: Action Runner
الـ Runner هيشغّل كل خطوة بالترتيب:

```typescript
for (const step of plan.steps) {
  step.status = 'RUNNING';

  const executor = getExecutorForAction(step.action.action);
  const result = await executor.execute(step.action);

  step.status = result.status;
  step.result = result;

  if (result.status === 'ERROR') {
    break; // يوقف الخطة
  }
}
```

### Phase 95.5: Action Storage
الخطط تتخزن في Firestore:

```
projects/{projectId}/actionPlans/{planId}
```

---

## 🎯 مثال عملي

```typescript
// مثال: إضافة Stripe

const plan: ActionPlan = {
  id: 'plan-abc123',
  projectId: 'my-saas-project',
  summary: 'Add Stripe payment integration',
  createdBy: 'agent',
  createdAt: Date.now(),
  userIntent: 'عايز أضيف نظام دفع بـ Stripe',
  steps: [
    {
      index: 0,
      status: 'PENDING',
      action: {
        id: 'action-1',
        action: 'WRITE_FILE',
        category: 'FILE_SYSTEM',
        projectId: 'my-saas-project',
        path: 'src/lib/stripe.ts',
        content: `
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});
        `,
        createdBy: 'agent',
        createdAt: Date.now(),
      }
    },
    {
      index: 1,
      status: 'PENDING',
      action: {
        id: 'action-2',
        action: 'UPDATE_ENV',
        category: 'ENV',
        projectId: 'my-saas-project',
        key: 'STRIPE_SECRET_KEY',
        value: 'sk_test_...',
        scope: 'LOCAL',
        createdBy: 'agent',
        createdAt: Date.now(),
      }
    },
    {
      index: 2,
      status: 'PENDING',
      action: {
        id: 'action-3',
        action: 'APPEND_MEMORY_NOTE',
        category: 'MEMORY',
        projectId: 'my-saas-project',
        sectionId: 'TECH_STACK',
        note: 'Added Stripe for payment processing',
        createdBy: 'agent',
        createdAt: Date.now(),
      }
    }
  ],
  autoExecuted: false,
};
```

---

## 📊 الإحصائيات

| الفئة | عدد الـ Actions |
|-------|----------------|
| File System | 4 |
| Firestore | 3 |
| Environment | 1 |
| Deployment | 1 |
| Memory | 2 |
| Tool | 1 |
| **المجموع** | **12** |

---

## 🎯 المميزات الرئيسية

1. **Type Safety**: TypeScript كامل - ما فيش runtime errors
2. **Extensibility**: سهل تضيف أنواع جديدة
3. **Traceability**: كل action فيه ID و timestamp
4. **Flexibility**: Generic types للحالات المتقدمة
5. **Integration**: يربط مع Phase 94 (Memory System)

---

## 🚀 الخطوات الجاية

### Phase 95.2: Action Planner Agent
- AI agent يحوّل نية المستخدم → ActionPlan
- يطلّع JSON منظم حسب الـ Schema ده

### Phase 95.3: Action Runner
- Executor لكل نوع action
- Error handling و logging
- دعم pause/resume للخطط

### Phase 95.5: Action Storage
- حفظ الخطط في Firestore
- History و Replay و Rollback

---

## 🎉 خلاصة

**Phase 95.1 مكتمل! ✅**

Schema شامل ب 12 نوع action جاهز للاستخدام. كل حاجة متكتبة بـ TypeScript مع full type safety. جاهز للانتقال لـ Phase 95.2 (Action Planner Agent).

**الملف**: [src/lib/agent/actions/actionTypes.ts](src/lib/agent/actions/actionTypes.ts)
