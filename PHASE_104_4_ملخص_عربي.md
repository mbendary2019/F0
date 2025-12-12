# ✅ المرحلة 104.4: اطلب من الوكيل تنفيذ المهمة - مكتمل

**التاريخ**: 2025-11-27
**الحالة**: ✅ **النسخة التجريبية مكتملة**

---

## 🎯 الهدف

إضافة القدرة للمستخدمين لتفويض تنفيذ المهام للوكيل بالضغط على زر. هذه **نسخة تجريبية** تقوم بـ:
- إنشاء `queued_action` في Firestore
- تعليم المهمة كـ `in_progress`
- إكمال المهمة تلقائيًا بعد ثانيتين
- إضافة رسالة نظام للشات

**TODO للمستقبل**: الربط مع Code Agent الحقيقي لتنفيذ المهام فعليًا.

---

## ✅ اللي اتعمل

### 1️⃣ تحديث TypeScript Types

**الملف**: [src/types/project.ts](src/types/project.ts) (الأسطر 172-190)

**التغييرات**:
```typescript
export type F0ActionStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface F0QueuedAction {
  id?: string;
  projectId: string;
  type: 'preflight' | 'execute_task';
  phaseId?: string;
  taskId?: string;
  taskTitle?: string;
  status: F0ActionStatus;
  createdAt: number;
  startedAt?: number | null;
  completedAt?: number | null;
  lastError?: string | null;
}
```

**اللي اتغير**:
- إضافة `F0ActionStatus` كـ type منفصل
- جعل `id` اختياري (Firestore بيولده تلقائيًا)
- إضافة `projectId` (مطلوب للـ queries)
- إضافة `phaseId` و `taskId` لتتبع أفضل
- تغيير `processedAt` → `startedAt` و `completedAt`
- تغيير `error` → `lastError` مع نوع `null`

---

### 2️⃣ إنشاء API Endpoint

**الملف**: [src/app/api/f0/run-next-task/route.ts](src/app/api/f0/run-next-task/route.ts)

**المسار**: `POST /api/f0/run-next-task`

**Request Body**:
```json
{
  "projectId": "QNnGNj3QRLlaVwg9y8Lz",
  "taskId": "task-123"
}
```

**Response** (نجاح):
```json
{
  "ok": true,
  "actionId": "action-abc",
  "taskId": "task-123",
  "message": "Task execution started (skeleton implementation)"
}
```

**اللي بيعمله**:

1. **مصادقة المستخدم** عبر Firebase ID token
2. **التحقق من ملكية المشروع** (يتحقق من `ownerUid`)
3. **جلب تفاصيل المهمة** من Firestore
4. **البحث أو إنشاء queued_action**:
   - يتحقق إذا كان الـ action موجود للمهمة دي
   - ينشئ action جديد لو مش موجود
5. **تعليم الـ action كـ `in_progress`**:
   - يضبط `startedAt` timestamp
6. **تعليم المهمة كـ `in_progress`**:
   - يحدث حالة المهمة
7. **تنفيذ المهمة** (تجريبي):
   - يستخدم `setTimeout` لمحاكاة عمل لمدة ثانيتين
   - يعلم المهمة كـ `completed`
   - يعلم الـ action كـ `completed`
   - يضيف رسالة نظام للشات
8. **إرجاع استجابة نجاح**

**الأمان**:
- ✅ يتطلب مصادقة
- ✅ يتحقق من ملكية المشروع
- ✅ يرجع 401 للمستخدمين الغير مصادقين
- ✅ يرجع 403 للمستخدمين الغير مخولين
- ✅ يرجع 404 للمشروع/المهمة المفقودة

**معالجة الأخطاء**:
- يمسك الأخطاء أثناء التنفيذ
- يعلم الـ action كـ `failed` مع `lastError`
- يرجع 500 لأخطاء السيرفر

---

### 3️⃣ تحديث واجهة Continue Page

**الملف**: [src/app/[locale]/f0/projects/[id]/continue/page.tsx](src/app/[locale]/f0/projects/[id]/continue/page.tsx)

**متغيرات State جديدة** (الأسطر 26-27):
```typescript
const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
const [runError, setRunError] = useState<string | null>(null);
```

**دالة Handler جديدة** (الأسطر 126-164):
```typescript
const handleRunTaskWithAgent = async (task: F0Task) => {
  setRunError(null);
  setRunningTaskId(task.id);

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const token = await user.getIdToken();

    const res = await fetch('/api/f0/run-next-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        taskId: task.id,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to start task');
    }

    console.log('[Phase 104.4] Task execution started:', data);
  } catch (error) {
    console.error('[Phase 104.4] Error running task:', error);
    setRunError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    setRunningTaskId(null);
  }
};
```

**زر UI جديد** (الأسطر 413-452):
```tsx
{/* Phase 104.4: Ask Agent Button */}
<div className="mt-3 pt-3 border-t border-[#2c1466]">
  <button
    onClick={(e) => {
      e.stopPropagation();
      handleRunTaskWithAgent(activeTask);
    }}
    disabled={runningTaskId === activeTask.id}
    className={/* gradient purple button */}
  >
    {runningTaskId === activeTask.id ? (
      <>⏳ جاري التنفيذ...</>
    ) : (
      <>🤖 اطلب من الوكيل تنفيذ المهمة</>
    )}
  </button>

  {runError && (
    <div className="text-red-400 bg-red-500/10">
      خطأ: {runError}
    </div>
  )}

  <div className="text-gray-500">
    (نسخة تجريبية - المهمة ستُعلم كمكتملة تلقائيًا)
  </div>
</div>
```

**التصميم البصري**:
- ✅ زر بتدرج بنفسجي (`from-purple-500 to-indigo-500`)
- ✅ تأثير ظل عند الـ hover
- ✅ حالة معطلة أثناء التشغيل (رمادي)
- ✅ مؤشر تحميل (⏳) أثناء التشغيل
- ✅ عرض الأخطاء (خلفية حمراء)
- ✅ نص مساعد يشرح السلوك التجريبي
- ✅ دعم اللغتين (عربي/إنجليزي)

---

## 🔄 سير العمل

### سيناريو: المستخدم يطلب من الوكيل تنفيذ مهمة

1. **المستخدم يضغط على مهمة** → بانل تفاصيل المهمة يظهر
2. **المستخدم يضغط "اطلب من الوكيل تنفيذ المهمة"**:
   - الزر يعرض حالة تحميل: "⏳ جاري التنفيذ..."
   - الزر يصبح معطل (رمادي)
3. **يتم استدعاء الـ API**:
   - Firebase ID token للمستخدم يُرسل
   - السيرفر يتحقق من المصادقة والملكية
4. **السيرفر ينشئ/يحدث queued_action**:
   - يبحث عن action موجود أو ينشئ واحد جديد
   - يعلم الـ action كـ `in_progress`
5. **السيرفر يعلم المهمة كـ `in_progress`**:
   - حالة المهمة تتغير في Firestore
   - Real-time listener يحدث الواجهة فورًا
6. **السيرفر يحاكي التنفيذ** (ثانيتين):
   - النسخة التجريبية تنتظر ثانيتين
   - تعلم المهمة كـ `completed`
   - تعلم الـ action كـ `completed`
   - تضيف رسالة نظام للشات
7. **المستخدم يشوف التحديثات فورًا**:
   - بادج حالة المهمة يتحول لأخضر ("مكتمل")
   - شريط التقدم للمرحلة يزيد
   - بانل الشات يعرض رسالة النظام
8. **الزر يرجع لحالته الطبيعية**

---

## 🧪 الاختبار

### خطوات الاختبار اليدوي

1. **افتح Continue Workspace**:
   ```
   http://localhost:3030/ar/f0/projects/YOUR_PROJECT_ID/continue
   ```

2. **اضغط على مهمة** → بانل تفاصيل المهمة يظهر

3. **اضغط "اطلب من الوكيل تنفيذ المهمة"**:
   - لازم تشوف حالة التحميل (⏳)
   - الزر لازم يكون معطل
   - شيك الكونسول: `[Phase 104.4] Task execution started`

4. **استنى ثانيتين**:
   - حالة المهمة لازم تتغير لـ "مكتمل"
   - شريط التقدم لازم يتحدث
   - بانل الشات لازم يعرض رسالة النظام

5. **شيك Firestore Console**:
   - `projects/{projectId}/queued_actions` لازم يكون فيه مستند جديد
   - الـ Action لازم يكون `status: 'completed'`
   - المهمة لازم تكون `status: 'completed'`

6. **اختبار معالجة الأخطاء**:
   - اعمل logout واضغط الزر → لازم يعرض "User not authenticated"
   - غير `projectId` لقيمة غير صحيحة → لازم يعرض خطأ

---

## 📁 الملفات المُنشأة/المُعدلة

### ملفات تم إنشاؤها:
1. ✅ [src/app/api/f0/run-next-task/route.ts](src/app/api/f0/run-next-task/route.ts) - نقطة نهاية الـ API

### ملفات تم تعديلها:
1. ✅ [src/types/project.ts](src/types/project.ts) - تحديث واجهة `F0QueuedAction`
2. ✅ [src/app/[locale]/f0/projects/[id]/continue/page.tsx](src/app/[locale]/f0/projects/[id]/continue/page.tsx) - إضافة الزر والـ handler

---

## 🔐 مجموعات Firestore

### مجموعة جديدة: `queued_actions`

**المسار**: `projects/{projectId}/queued_actions/{actionId}`

**بنية المستند**:
```typescript
{
  id: "action-abc",
  projectId: "proj-123",
  type: "execute_task",
  phaseId: "mvp",
  taskId: "task-456",
  taskTitle: "تنفيذ مصادقة المستخدم",
  status: "completed",
  createdAt: 1732694400000,
  startedAt: 1732694401000,
  completedAt: 1732694403000,
  lastError: null
}
```

**Indexes مطلوبة** (للإنتاج):
```
Collection: queued_actions
Fields: taskId (ASC), status (ASC)
```

---

## 🚀 الخطوة التالية: ربط Code Agent الحقيقي

### النسخة التجريبية الحالية:
```typescript
// محاكاة التنفيذ
setTimeout(async () => {
  // تعليم المهمة كمكتملة
  await adminDb.collection('projects').doc(projectId)
    .collection('tasks').doc(taskId)
    .update({ status: 'completed', completedAt: Date.now() });
}, 2000);
```

### TODO للنسخة الحقيقية:

استبدل كتلة `setTimeout` بـ:

```typescript
// استيراد Code Agent client
import { CodeAgent } from '@/lib/codeAgent';

// بدلاً من setTimeout، استدعي Code Agent
const agent = new CodeAgent();
const result = await agent.executeTask({
  projectId,
  taskId,
  taskTitle: task.title,
  taskDescription: task.description,
  phaseId: task.phaseId,
});

// تحديث المهمة بناءً على النتيجة
if (result.success) {
  await adminDb.collection('projects').doc(projectId)
    .collection('tasks').doc(taskId)
    .update({
      status: 'completed',
      completedAt: Date.now(),
      result: result.output,
    });
} else {
  await adminDb.collection('projects').doc(projectId)
    .collection('tasks').doc(taskId)
    .update({
      status: 'blocked',
      lastError: result.error,
    });
}
```

---

## 🎨 التصميم البصري

### حالات الزر

**الحالة العادية**:
- الخلفية: تدرج بنفسجي-نيلي
- النص: أبيض
- الظل: توهج بنفسجي
- Hover: تدرج أغمق

**حالة التحميل**:
- الخلفية: رمادي
- النص: رمادي
- الأيقونة: ⏳
- المؤشر: `not-allowed`

**حالة الخطأ**:
- نص أحمر على خلفية red/10
- يعرض رسالة الخطأ أسفل الزر

### نص الزر (ثنائي اللغة)

| الحالة | الإنجليزية | العربية |
|-------|---------|--------|
| عادي | 🤖 Ask Agent to implement this task | 🤖 اطلب من الوكيل تنفيذ المهمة |
| تحميل | ⏳ Running... | ⏳ جاري التنفيذ... |
| خطأ | Error: {message} | خطأ: {message} |

---

## 📊 تدفق التحديثات الفورية

```
المستخدم يضغط زر "اطلب من الوكيل"
    ↓
handleRunTaskWithAgent() يُستدعى
    ↓
POST /api/f0/run-next-task
    ↓
السيرفر ينشئ/يحدث queued_action
    ↓
السيرفر يعلم المهمة كـ in_progress
    ↓
Real-time listener (onSnapshot) يكتشف التغيير
    ↓
الواجهة تتحدث: بادج المهمة يصبح أصفر
    ↓
السيرفر يحاكي التنفيذ لمدة ثانيتين (setTimeout)
    ↓
السيرفر يعلم المهمة كمكتملة
    ↓
Real-time listener يكتشف التغيير مرة أخرى
    ↓
الواجهة تتحدث: بادج المهمة يصبح أخضر، شريط التقدم يزيد
    ↓
السيرفر يضيف رسالة نظام للشات
    ↓
بانل الشات يعرض الرسالة الجديدة
    ↓
كل المستخدمين يشوفوا التحديث فورًا! 🚀
```

---

## 🎉 الحالة: النسخة التجريبية مكتملة

**المرحلة 104.4** دلوقتي شغالة مع:

✅ **TypeScript Types محدثة**: واجهة `F0QueuedAction` تطابق المتطلبات
✅ **API Endpoint منشأ**: `POST /api/f0/run-next-task` يتعامل مع تنفيذ المهام
✅ **زر UI مضاف**: زر "اطلب من الوكيل" مع حالات التحميل/الخطأ
✅ **تحديثات فورية**: المهام تتحدث تلقائيًا عند الإكمال
✅ **دعم ثنائي اللغة**: تسميات عربية/إنجليزية في كل مكان
✅ **معالجة الأخطاء**: المصادقة، التخويل، وأخطاء السيرفر تُعالج

**النسخة التجريبية**: المهام تُعلم كمكتملة تلقائيًا بعد ثانيتين.

**TODO للإنتاج**: استبدل `setTimeout` بـ Code Agent حقيقي.

---

## 📝 مرجع سريع

### اختبر الميزة:
```bash
# 1. افتح Continue workspace
open http://localhost:3030/ar/f0/projects/YOUR_PROJECT_ID/continue

# 2. اضغط على مهمة → بانل تفاصيل المهمة يظهر

# 3. اضغط "اطلب من الوكيل تنفيذ المهمة"

# 4. استنى ثانيتين → المهمة تُعلم كمكتملة
```

### مثال API Call:
```typescript
const token = await auth.currentUser.getIdToken();

const res = await fetch('/api/f0/run-next-task', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    projectId: 'proj-123',
    taskId: 'task-456',
  }),
});

const data = await res.json();
console.log(data);
// { ok: true, actionId: "action-abc", taskId: "task-456", message: "..." }
```

---

**تاريخ الإكمال**: 2025-11-27
**المرحلة**: 104.4 - اطلب من الوكيل تنفيذ المهمة (تجريبي)
**الحالة**: ✅ النسخة التجريبية مكتملة
**الخطوة التالية**: الربط مع Code Agent حقيقي لتنفيذ المهام فعليًا

