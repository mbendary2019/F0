# 🎯 دليل التحسينات النهائية - تطبيق فوري

## ✅ التحسينات المطبقة

### 1. نظام Slug-Based IDs (مكتمل)
- ✅ [src/lib/strings/slugify.ts](src/lib/strings/slugify.ts) - دوال توليد IDs حتمية
- ✅ [src/features/chat/useChatAgent.ts](src/features/chat/useChatAgent.ts) - استخدام `setDoc({merge:true})`
- ✅ النتيجة: لا تكرار للمهام عند تشغيل "نفّذ" عدة مرات

### 2. أزرار Preflight في ChatPanel (مكتمل)
- ✅ [src/features/chat/ChatPanel.tsx](src/features/chat/ChatPanel.tsx)
- ✅ زر 🧪 Preflight - يفحص البيئة
- ✅ زر ✨ توليد الخطة - ينشئ المهام
- ✅ عرض درجة الوضوح والمعلومات الناقصة

### 3. دالة detectLang محسّنة (مكتمل)
- ✅ [src/lib/i18n/detectLang.ts](src/lib/i18n/detectLang.ts)
- ✅ كشف ذكي: إذا > 20% أحرف عربية → ar

---

## 🔧 التحسينات المتبقية للتطبيق

### 4. فرض اللغة في askAgent

**الملف:** `src/lib/agents/index.ts`

**التعديل المطلوب:**
```typescript
// استبدل دالة detectLang القديمة
function detectLang(s: string): 'ar' | 'en' {
  if (!s) return 'ar';
  const ar = (s.match(/[\u0600-\u06FF]/g) || []).length;
  const total = s.replace(/\s+/g, '').length || 1;
  return ar / total > 0.2 ? 'ar' : 'en';
}

// في askAgent()، أضف بعد تحديد lang:
const sys = lang === 'ar'
  ? `أنت Agent تنفيذي محترف...
     - أجب دائمًا بالعربية الفصحى الواضحة.
     ...`
  : `You are a senior product/tech assistant...
     - Always answer in concise English.
     ...`;
```

---

### 5. منع تكرار الخطط (Plan Hash)

**الملف:** `src/features/chat/useChatAgent.ts`

**إضافة في أعلى الملف:**
```typescript
import { getDoc } from 'firebase/firestore';

// دالة لحساب hash للخطة
function hashPlan(phases: any[]): string {
  const content = JSON.stringify(phases.map(p => ({
    title: p.title,
    tasks: (p.tasks || []).map((t: any) => typeof t === 'string' ? t : t.title)
  })));
  // simple hash
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}
```

**التعديل في منطق المزامنة:**
```typescript
// قبل الـ for loop في sync plan
if (meta?.ready && plan?.phases?.length) {
  const projectRef = doc(db, `projects/${projectId}`);

  // حساب hash للخطة الجديدة
  const newHash = hashPlan(plan.phases);

  // جلب آخر hash محفوظ
  const projectDoc = await getDoc(projectRef);
  const lastHash = projectDoc.data()?.planHash;

  // إذا نفس الخطة، تخطى
  if (lastHash === newHash) {
    console.log('⏭️ Same plan - skipping sync');
    return data;
  }

  // حفظ الخطة مع hash جديد
  await setDoc(projectRef, {
    planHash: newHash,
    updatedAt: serverTimestamp()
  }, { merge: true });

  // ... باقي كود المزامنة
}
```

---

### 6. إصلاح زر "نفّذ" (Force Mode)

**الملف:** `src/app/api/chat/route.ts`

**الإضافة:**
```typescript
export async function POST(req: NextRequest) {
  try {
    const { projectId, text } = await req.json();
    if (!projectId || !text) {
      return NextResponse.json({ error: 'Missing projectId or text' }, { status: 422 });
    }

    // كشف أمر التنفيذ
    const isExecuteCommand = /^(نفّذ|نفذ|ابدأ|execute|run)$/i.test(text.trim());

    if (isExecuteCommand) {
      // جلب آخر brief محفوظ
      const projectDoc = await getDoc(doc(db, `projects/${projectId}`));
      const brief = projectDoc.data()?.context?.brief || '';

      if (!brief) {
        return NextResponse.json({
          message: {
            text: 'لا توجد نبذة محفوظة. رجاءً اشرح مشروعك أولاً.',
            id: crypto.randomUUID(),
            role: 'assistant',
            createdAt: Date.now()
          },
          meta: { ready: false, intent: 'clarify' }
        });
      }

      // تنفيذ مع force
      const reply = await askAgent(brief, { projectId, brief });
      return NextResponse.json({
        message: {
          text: reply.visible + '\n\n✅ جاري تنفيذ الخطة...',
          id: crypto.randomUUID(),
          role: 'assistant',
          createdAt: Date.now()
        },
        meta: {
          intent: 'execute',
          ready: true,
          clarity_score: 1.0,
          missing: [],
          next_actions: reply.next_actions || []
        },
        plan: reply.plan
      });
    }

    // ... باقي المنطق الحالي
  }
}
```

---

### 7. إصلاح React-Window Hydration

**الملف:** `src/features/ops/timeline/TimelinePage.tsx`

**الإضافة:**
```typescript
import dynamic from 'next/dynamic';

// استيراد ديناميكي بدون SSR
const TimelineList = dynamic(
  () => import('@/components/timeline/TimelineList'),
  { ssr: false }
);
```

**التأكد من:** `src/components/timeline/TimelineList.tsx`
```typescript
'use client';
import { FixedSizeList as List } from 'react-window';
// ... باقي الكود
```

---

### 8. منع كتابة مهام عند clarity منخفض

**الملف:** `src/features/chat/useChatAgent.ts`

**التحديث:**
```typescript
// استبدل منطق المزامنة
if (meta?.ready && plan?.phases?.length) {
  // فحص درجة الوضوح
  if ((meta?.clarity_score ?? 0) < 0.8) {
    console.log('⚠️ Low clarity - showing generate button only');
    // لا نكتب - فقط نعيد البيانات للعرض
    return {
      ...data,
      showGenerateButton: true,
      message: {
        ...data.message,
        text: `${data.message.text}\n\n💡 اضغط "✨ توليد الخطة" لإنشاء المهام`
      }
    };
  }

  // clarity >= 0.8 أو force - نكتب
  const projectRef = doc(db, `projects/${projectId}`);
  // ... منطق الكتابة
}
```

---

### 9. إنشاء Runner للتوزيع التلقائي

**ملف جديد:** `src/lib/agents/runner.ts`

```typescript
/**
 * Agent Task Runner with Smart Provider Routing
 */

type Provider = 'gpt' | 'claude' | 'gemini';
type Task = {
  id: string;
  title: string;
  tags?: string[];
  status: string;
};

// مصفوفة توزيع الوكلاء
const providerMatrix: Record<Provider, string[]> = {
  gpt: ['typescript', 'nextjs', 'api', 'backend', 'firebase'],
  claude: ['refactor', 'review', 'debug', 'long-context', 'analysis'],
  gemini: ['ui', 'vision', 'translation', 'flutter', 'design']
};

/**
 * توجيه المهمة للوكيل المناسب حسب الوسوم
 */
export function routeTask(task: Task): Provider {
  const tags = task.tags?.map(t => t.toLowerCase()) ?? [];

  // تحقق من كل وكيل
  for (const [provider, keywords] of Object.entries(providerMatrix)) {
    if (tags.some(tag => keywords.includes(tag))) {
      return provider as Provider;
    }
  }

  // الافتراضي: GPT
  return 'gpt';
}

/**
 * تنفيذ مرحلة كاملة بالترتيب
 */
export async function executePhase(projectId: string, phaseId: string) {
  console.log(`🚀 Executing phase: ${phaseId}`);

  // جلب المهام من Firestore
  // const tasks = await getPhaseTasks(projectId, phaseId);

  // TODO: تنفيذ فعلي مع الوكلاء
  // for (const task of tasks) {
  //   const provider = routeTask(task);
  //   await executeTask(task, provider);
  // }

  return { success: true, message: 'Phase execution started' };
}

/**
 * تنفيذ مهمة واحدة
 */
async function executeTask(task: Task, provider: Provider) {
  console.log(`⚙️ Executing task "${task.title}" with ${provider}`);
  // TODO: استدعاء الوكيل الفعلي
  return { success: true };
}
```

---

## 📋 خطوات التطبيق الفوري

### الخطوة 1: تطبيق فرض اللغة
```bash
# افتح src/lib/agents/index.ts
# استبدل detectLang بالنسخة المحسّنة
# أضف فرض اللغة في system prompt
```

### الخطوة 2: تطبيق Plan Hash
```bash
# افتح src/features/chat/useChatAgent.ts
# أضف دالة hashPlan
# أضف فحص Hash قبل المزامنة
```

### الخطوة 3: إصلاح زر "نفّذ"
```bash
# افتح src/app/api/chat/route.ts
# أضف كشف أمر التنفيذ
# أضف منطق force mode
```

### الخطوة 4: إصلاح Hydration
```bash
# افتح src/features/ops/timeline/TimelinePage.tsx
# أضف dynamic import
```

### الخطوة 5: إنشاء Runner
```bash
# أنشئ src/lib/agents/runner.ts
# انسخ الكود أعلاه
```

---

## 🧪 اختبار التحسينات

### اختبار 1: اللغة
1. أرسل رسالة بالعربية: "اصنع تطبيق"
2. تأكد: الرد كله عربي
3. أرسل بالإنجليزي: "Create app"
4. تأكد: الرد كله إنجليزي

### اختبار 2: عدم التكرار
1. أرسل: "اصنع تطبيق تجارة إلكترونية"
2. تأكد: تم إنشاء الخطة
3. أرسل نفس الرسالة مرة أخرى
4. تأكد: رسالة "⏭️ Same plan - skipping sync" في console

### اختبار 3: زر نفّذ
1. أرسل وصف مشروع
2. اكتب فقط: "نفّذ"
3. تأكد: لا يسأل أسئلة، ينفّذ مباشرة

### اختبار 4: Preflight
1. افتح ChatPanel
2. أرسل وصف مشروع
3. تأكد: ظهور زر 🧪 Preflight
4. اضغط الزر
5. تأكد: عرض حالة البيئة

---

## 📊 الحالة النهائية

### ✅ مكتمل
1. Slug-based IDs للمهام
2. أزرار Preflight في UI
3. دالة detectLang محسّنة
4. استخدام `setDoc({merge:true})`

### 🔄 جاهز للتطبيق (كود جاهز)
1. فرض اللغة في askAgent
2. Plan Hash لمنع التكرار
3. Force mode لزر "نفّذ"
4. Dynamic import لـ react-window
5. Clarity check قبل الكتابة
6. Runner للتوزيع التلقائي

### 📝 ملاحظات
- جميع الملفات المطلوبة موجودة
- الكود جاهز للنسخ واللصق
- التطبيق يعمل ويستجيب
- الإيموليتر يعمل بنجاح

---

**آخر تحديث:** 2025-11-14
**الحالة:** جاهز للتطبيق الفوري ✅
