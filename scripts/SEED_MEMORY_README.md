# 🌱 Memory Timeline Seed Scripts

Scripts لإضافة بيانات تجريبية إلى Memory Timeline للاختبار.

## 📋 السكريبتات المتاحة

### 1. `seedMemorySnippets.admin.ts` ✅ **موصى به للجميع**
يستخدم Firebase Admin SDK - **يعمل مع Emulator والـ Production**.

```bash
# للـ Emulator
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=from-zero-84253 pnpm tsx scripts/seedMemorySnippets.admin.ts

# للـ Production (مع Service Account)
pnpm tsx scripts/seedMemorySnippets.admin.ts
```

### 2. `seedMemorySnippets.ts` (Legacy - Production)
يضيف بيانات إلى Firebase Production باستخدام Client SDK.

```bash
# تأكد من إضافة متغيرات البيئة في .env.local
pnpm tsx scripts/seedMemorySnippets.ts
```

### 3. `seedMemorySnippets-admin.ts` (Legacy - للـ ops_collab_memory)
يضيف بيانات إلى `ops_collab_memory` بدلاً من `ops_memory_snippets`.

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm tsx scripts/seedMemorySnippets-admin.ts
```

## 🚀 الاستخدام السريع

### للاختبار المحلي (مع Emulator):

1. تأكد من تشغيل Emulator:
   ```bash
   firebase emulators:start
   ```

2. شغّل السكريبت الجديد:
   ```bash
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=from-zero-84253 pnpm tsx scripts/seedMemorySnippets.admin.ts
   ```

3. افتح المتصفح:
   ```
   http://localhost:3030/en/ops/memory?room=ide-file-demo-page-tsx&session=room__20251106
   ```

### للـ Production:

1. تأكد من إعدادات Firebase في `.env.local`:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   ```

2. شغّل السكريبت:
   ```bash
   pnpm tsx scripts/seedMemorySnippets.ts
   ```

## 📊 البيانات المُضافة

### `seedMemorySnippets.admin.ts` (الجديد) ✅
يضيف **5 memory snippets** إلى `ops_memory_snippets`:

- "Deploy guide: run firebase deploy --only hosting"
- "Added semantic search to memory timeline"
- "Phase 59 completed: Cognitive Mesh Graph live"
- "Fix: null protection for useMemoryTimeline hook"
- "Benchmark results: 420ms P95 latency ✅"

### التفاصيل:
- **Collection**: `ops_memory_snippets`
- **workspaceId**: `demo`
- **roomId**: `ide-file-demo-page-tsx`
- **sessionId**: `room__20251106`
- **TTL**: 90 يوم (expire_at)

---

### `seedMemorySnippets-admin.ts` (Legacy)
يضيف **8 memory items** إلى `ops_collab_memory`:

- ✅ **5 Auto-summaries** - ملخصات تلقائية من النظام
- 📌 **2 Manual pins** - عناصر مُثبتة من المستخدم
- 🔔 **1 System note** - ملاحظة من النظام

## 🔧 تخصيص البيانات

لتعديل البيانات التجريبية، افتح الملف وعدّل:

```typescript
const examples = [
  {
    type: "auto-summary",
    content: "Your custom content here",
    pinned: false,
    stats: { messages: 10, participants: 2 },
    participants: [
      { uid: "user1", name: "User Name" }
    ],
    writer: "cf" as const,
  },
  // أضف المزيد...
];
```

## 🐛 استكشاف الأخطاء

### خطأ: `PERMISSION_DENIED`
**الحل**: استخدم `seedMemorySnippets-admin.ts` بدلاً من `seedMemorySnippets-emulator.ts`

### خطأ: `Connection refused`
**الحل**: تأكد من تشغيل Emulator أولاً:
```bash
firebase emulators:start
```

### خطأ: `Cannot find module 'firebase-admin'`
**الحل**: تأكد من تثبيت الحزمة:
```bash
pnpm install firebase-admin
```

## 📝 ملاحظات

- السكريبتات تستخدم `serverTimestamp()` لإنشاء timestamp صحيح
- البيانات تُحذف تلقائياً بعد 90 يوم (TTL)
- يمكنك تشغيل السكريبت عدة مرات - سيضيف بيانات جديدة في كل مرة
- للحذف الكامل، استخدم Firebase Console أو Emulator UI

## 🔗 الروابط ذات الصلة

- [Memory Timeline Page](src/app/[locale]/ops/memory/page.tsx)
- [useMemoryTimeline Hook](src/lib/collab/memory/useMemoryTimeline.ts)
- [Firestore Indexes](firestore.indexes.json)
- [Firestore Rules](firestore.rules)
