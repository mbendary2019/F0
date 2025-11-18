# المرحلة 64 - تنفيذ الخطة بدون تكرار ✅

## نظرة عامة

تم تطبيق نظام تنفيذ خطط كامل بمعرفات حتمية لمنع التكرار.

---

## 🎯 الميزات المُنفذة

### 1. الكشف عن اللغة من الـ pathname ✅

**الملف:** [src/features/chat/useChatAgent.ts](src/features/chat/useChatAgent.ts)

```typescript
import { usePathname } from 'next/navigation';

export function useChatAgent(projectId: string) {
  const pathname = usePathname();
  const locale = pathname?.startsWith('/en') ? 'en' : 'ar';

  // يتم إرسال locale مع كل رسالة
  const body = { projectId, text, locale };
}
```

**الفوائد:**
- ✅ يستخرج اللغة من الرابط (`/ar/studio` → `ar`, `/en/studio` → `en`)
- ✅ أكثر موثوقية من params
- ✅ يعمل عبر جميع هياكل المسارات

---

### 2. دالة تنفيذ الخطة (onRunPlan) ✅

**الملف:** [functions/src/agents/runPlan.ts](functions/src/agents/runPlan.ts)

**الميزات الأساسية:**
- ✅ **معرفات حتمية** باستخدام SHA1 hash من العناوين
- ✅ **تنفيذ idempotent** مع `{ merge: true }`
- ✅ **بدون تكرار** - نفس الخطة = نفس المعرفات = تحديث بدلاً من إنشاء
- ✅ **دعم ثنائي اللغة** - ردود عربية وإنجليزية
- ✅ **تسجيل النشاط** - يتتبع سجل التنفيذ
- ✅ **تتبع البيانات الوصفية** - يخزن نسخة الخطة ووقت التنفيذ

**منطق توليد المعرفات:**
```typescript
const mkId = (str: string): string => {
  return crypto.createHash('sha1').update(str).digest('hex').slice(0, 24);
};

// مثال على معرف المرحلة: "phase-a3f8b9c1e2d4f5g6h7i8"
const phaseId = `phase-${mkId(ph.title)}`;

// مثال على معرف المهمة: "task-x1y2z3a4b5c6d7e8f9g0"
const taskId = `task-${mkId(phaseId + ':' + tk.title)}`;
```

**لماذا يعمل هذا:**
1. نفس العنوان → نفس الـ hash → نفس المعرف
2. `setDoc({merge: true})` يحدث المستند الموجود بدلاً من إنشاء جديد
3. إعادة تشغيل نفس الخطة = عملية upsert آمنة

**مثال على الرد:**
```json
{
  "ok": true,
  "message": "✅ تم التنفيذ بنجاح: 7 مراحل و 42 مهام",
  "stats": {
    "phases": 7,
    "tasks": 42
  }
}
```

---

### 3. مكون RunPlanButton ✅

**الملف:** [src/components/RunPlanButton.tsx](src/components/RunPlanButton.tsx)

**مثال على الاستخدام:**
```tsx
import RunPlanButton from '@/components/RunPlanButton';

<RunPlanButton
  projectId="my-project-123"
  plan={planFromAgent}
  onSuccess={() => console.log('تم تنفيذ الخطة!')}
/>
```

**الميزات:**
- ✅ واجهة ثنائية اللغة (عربي/إنجليزي حسب الرابط)
- ✅ حالات التحميل
- ✅ معالجة الأخطاء
- ✅ callbacks عند النجاح
- ✅ تصميم جميل بتدرج لوني

---

### 4. مساعد المصادقة للتطوير ✅

**الملف:** [src/lib/firebaseAuthDev.ts](src/lib/firebaseAuthDev.ts)

**الغرض:** تسجيل دخول تلقائي بهوية مجهولة في التطوير لمنع أخطاء AUTH_USER_MISSING.

**الميزات:**
- ✅ يتصل تلقائياً بـ Auth emulator
- ✅ يسجل دخول بهوية مجهولة إذا لم يكن هناك مستخدم
- ✅ يعمل فقط في التطوير/localhost
- ✅ يبدأ عند تحميل الصفحة

**التكامل:** استورده في الـ root layout أو في أي مكان تحتاج فيه للمصادقة:
```typescript
import '@/lib/firebaseAuthDev'; // Side-effect import
```

---

## 📊 كيف يعمل التنفيذ

### التدفق خطوة بخطوة:

1. **المستخدم ينشئ خطة**
   - المستخدم يتحدث مع الوكيل: "عايز تطبيق محادثة"
   - الوكيل يولد خطة من 7 مراحل
   - الخطة تُخزن في رسائل المحادثة

2. **المستخدم يضغط على زر "نفّذ الخطة"**
   - `RunPlanButton` ينادي دالة `onRunPlan`
   - يمرر: `projectId`, `plan`, `locale`

3. **الدالة تعالج الخطة**
   - تولد معرفات حتمية لكل مرحلة/مهمة
   - تنشئ/تحدث مستندات في Firestore:
     - `projects/{id}/phases/{phaseId}`
     - `projects/{id}/tasks/{taskId}`
   - تسجل النشاط
   - تحدث البيانات الوصفية للمشروع

4. **النتيجة**
   - المراحل والمهام موجودة الآن في Firestore
   - جاهزة للتنفيذ بواسطة task runner
   - لا يوجد تكرار حتى لو تم الضغط على الزر عدة مرات

---

## 🔒 منع التكرار

### المشكلة:
إذا ضغط المستخدم على "نفّذ الخطة" عدة مرات، لا نريد 10 نسخ من نفس المراحل.

### الحل:

**1. معرفات حتمية:**
```typescript
"Setup Firebase Authentication"
  → SHA1 hash
  → "a3f8b9c1e2d4f5g6h7i8"
  → phaseId: "phase-a3f8b9c1e2d4f5g6h7i8"
```

نفس العنوان دائماً ينتج نفس المعرف.

**2. استراتيجية الدمج:**
```typescript
batch.set(phaseRef, data, { merge: true });
```

إذا كان المستند موجوداً، حدثه. إذا لم يكن موجوداً، أنشئه.

**3. النتيجة:**
- الضغطة الأولى: تنشئ المراحل/المهام
- الضغطة الثانية: تحدث نفس المراحل/المهام
- الضغطة الثالثة: تحدث مرة أخرى (لا مستندات جديدة)

---

## 🧪 الاختبار

### اختبار تنفيذ الخطة:

**1. تحضير خطة اختبار:**
```typescript
const testPlan = {
  phases: [
    {
      title: "مرحلة اختبار 1",
      tasks: [
        { title: "مهمة 1", desc: "وصف المهمة", tags: ["test"] },
        { title: "مهمة 2", desc: "وصف المهمة", tags: ["test"] }
      ]
    }
  ]
};
```

**2. التنفيذ عبر الزر:**
```tsx
<RunPlanButton projectId="test-123" plan={testPlan} />
```

**3. التحقق في Firestore:**
```bash
# فحص مجموعة phases
firebase firestore:get projects/test-123/phases --emulator

# فحص مجموعة tasks
firebase firestore:get projects/test-123/tasks --emulator
```

**4. اختبار الـ Idempotency:**
- اضغط على الزر 3 مرات
- افحص Firestore: يجب أن يكون لديك نفس عدد المستندات
- تحقق من أن `updatedAt` يتغير لكن لا يوجد تكرار

---

## 📁 بنية Firestore

بعد التنفيذ، سيكون لمشروعك:

```
projects/
  {projectId}/
    meta: {
      planExecuted: true,
      planVersion: 1,
      lastExecutedAt: Timestamp
    }
    phases/
      phase-{hash}/
        title: "عنوان المرحلة"
        locale: "ar"
        status: "pending"
        order: 0
        createdAt: Timestamp
        updatedAt: Timestamp
    tasks/
      task-{hash}/
        phaseId: "phase-{hash}"
        title: "عنوان المهمة"
        desc: "وصف المهمة"
        tags: ["firebase", "setup"]
        status: "todo"
        locale: "ar"
        createdAt: Timestamp
        updatedAt: Timestamp
    activity/
      {autoId}/
        type: "system"
        action: "run_plan"
        title: "تم تنفيذ الخطة: 7 مراحل، 42 مهام"
        user: "user-uid-or-anonymous"
        createdAt: Timestamp
```

---

## 🎨 أمثلة على تكامل الواجهة

### مثال 1: صفحة الاستوديو مع الخطة

```tsx
'use client';
import { useState } from 'react';
import { useChatAgent } from '@/features/chat/useChatAgent';
import RunPlanButton from '@/components/RunPlanButton';

export default function StudioPage({ projectId }) {
  const { send, loading } = useChatAgent(projectId);
  const [plan, setPlan] = useState(null);

  const handlePlanReceived = (agentReply) => {
    if (agentReply.plan && agentReply.ready) {
      setPlan(agentReply.plan);
    }
  };

  return (
    <div>
      {/* واجهة المحادثة */}
      <ChatBox onMessage={handlePlanReceived} />

      {/* إظهار زر تنفيذ الخطة عندما تكون جاهزة */}
      {plan && (
        <RunPlanButton
          projectId={projectId}
          plan={plan}
          onSuccess={() => alert('تم التنفيذ!')}
        />
      )}
    </div>
  );
}
```

### مثال 2: منع إعادة التوليد

```tsx
// تحقق مما إذا كانت الخطة قد تم تنفيذها قبل توليد واحدة جديدة
const checkPlanExists = async (projectId: string): Promise<boolean> => {
  const projectRef = doc(db, `projects/${projectId}`);
  const projectSnap = await getDoc(projectRef);
  return projectSnap.data()?.meta?.planExecuted === true;
};

// في معالج المحادثة:
const handleUserMessage = async (text: string) => {
  // إذا طلب المستخدم خطة جديدة، تحقق مما إذا كانت موجودة
  if (text.includes('خطة') || text.includes('plan')) {
    const exists = await checkPlanExists(projectId);
    if (exists) {
      return "لديك خطة موجودة بالفعل. هل تريد إنشاء خطة جديدة؟";
    }
  }

  // استمر في التدفق العادي
  const reply = await send(text);
};
```

---

## 🔧 الدوال المُصدَّرة

**functions/src/index.ts:**
```typescript
// فحوصات Preflight
export { onPreflightCheck } from './agents/preflight';

// تنفيذ الخطة بدون تكرار
export { onRunPlan } from './agents/runPlan';
```

كلا الدالتين متاحتان الآن كـ Cloud Functions:
- `http://localhost:5001/{projectId}/us-central1/onPreflightCheck`
- `http://localhost:5001/{projectId}/us-central1/onRunPlan`

---

## ✅ قائمة التحقق

- [x] الكشف عن اللغة من pathname
- [x] إنشاء Cloud Function `onRunPlan`
- [x] تطبيق توليد معرفات حتمية
- [x] تصدير الدالة في index.ts
- [x] إنشاء مكون `RunPlanButton`
- [x] دعم ثنائي اللغة (عربي/إنجليزي)
- [x] معالجة الأخطاء وحالات التحميل
- [x] تسجيل النشاط
- [x] تتبع البيانات الوصفية
- [x] إنشاء مساعد مصادقة التطوير
- [x] إعادة بناء Functions
- [x] اكتمال التوثيق

---

## 🚀 الخطوات التالية

1. **دمج RunPlanButton** في صفحة الاستوديو
2. **اختبار سير العمل الكامل:**
   - المستخدم ينشئ خطة عبر المحادثة
   - المستخدم يضغط "نفّذ الخطة"
   - التحقق من المراحل/المهام في Firestore
   - اختبار idempotency (الضغط عدة مرات)
3. **تطبيق تنفيذ المهام** (المرحلة 65)
   - قراءة المهام من Firestore
   - التنفيذ باستخدام runner.ts
   - تحديث حالة المهمة
   - تتبع التقدم

---

## 📚 الملفات ذات الصلة

- [functions/src/agents/runPlan.ts](functions/src/agents/runPlan.ts) - دالة تنفيذ الخطة
- [functions/src/index.ts](functions/src/index.ts) - صادرات الدوال
- [src/components/RunPlanButton.tsx](src/components/RunPlanButton.tsx) - زر الواجهة
- [src/features/chat/useChatAgent.ts](src/features/chat/useChatAgent.ts) - Chat hook مع locale
- [src/lib/firebaseAuthDev.ts](src/lib/firebaseAuthDev.ts) - مساعد مصادقة التطوير
- [src/lib/agents/index.ts](src/lib/agents/index.ts) - Agent مع دعم lang

---

**الحالة:** ✅ مكتمل - جاهز للتكامل والاختبار

**التاريخ:** 2025-11-14
