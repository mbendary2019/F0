# Phase 72: Vercel Integration - Manual Token Mode ✅

## نظرة عامة

تم تنفيذ تكامل Vercel باستخدام **Manual Token Mode** بدلاً من OAuth.

---

## ما تم إنجازه 🎯

### 1️⃣ إعداد Token في functions/.env ✅

**الملف**: `functions/.env`

```bash
# Vercel Integration Token
F0_VERCEL_TOKEN=OnrnxbgzDrGHQaOnyuVCb1Qr
```

---

### 2️⃣ إنشاء Cloud Functions ✅

**الملف**: `functions/src/integrations/vercel-setup.ts`

تم إنشاء 2 functions:

1. **testVercelToken** - لاختبار صحة التوكن وعرض معلومات الحساب
2. **listVercelProjects** - لعرض قائمة بمشاريع Vercel (لاستخدامها في Project Integrations)

**تم تصديرها في**: `functions/src/index.ts`

```typescript
export { testVercelToken, listVercelProjects } from './integrations/vercel-setup';
```

---

### 3️⃣ Build & Emulators ✅

```bash
cd functions
pnpm build  # ✅ نجح بدون أخطاء

# Firebase Emulators
firebase emulators:start --only firestore,auth,functions
# ✅ Emulators جاهزة
```

---

## الخطوة التالية

الآن نحتاج لتحديث صفحة **Settings/Integrations** لعرض كارت Vercel مع زر "Test Connection".

### التعديلات المطلوبة:

**ملف**: `src/app/[locale]/settings/integrations/page.tsx`

بدلاً من عمل OAuth redirect، نحتاج:

1. إضافة states للـ Vercel Test:
   - `vercelStatus`
   - `isTestingVercel`
   - `vercelError`

2. إضافة handler `handleTestVercel()` الذي ينادي `testVercelToken` function

3. تحديث `connectVercel()` function لاستدعاء `handleTestVercel()` بدلاً من OAuth

4. (اختياري) إزالة `checkVercelStatus()` من useEffect لأننا لا نستخدم Firestore للـ status

---

## الكود المطلوب للـ UI

بما إن الملف كبير (429 سطر)، الحل الأمثل:

### Option 1: تحديث handleConnect فقط

استبدل `connectVercel` function بهذا:

```typescript
const connectVercel = async () => {
  // Phase 72: Manual Token Mode - Test via Cloud Function
  try {
    console.log('[Vercel] Testing token...');
    setConnecting('vercel');
    
    const fn = httpsCallable(functions, 'testVercelToken');
    const res = await fn({});
    const data = res.data as any;

    if (data.ok) {
      alert(`✅ Vercel Connected!\n\nUser: ${data.user?.name || data.user?.username || data.user?.email}\nProjects: ${data.projects?.length || 0}`);
      
      setStatus(prev => ({
        ...prev,
        vercel: true
      }));
    } else {
      alert('⚠️ Vercel token exists but API returned error.');
    }
  } catch (err: any) {
    console.error('[Vercel] Error:', err);
    alert(`❌ Vercel Connection Failed\n\n${err.message}`);
  } finally {
    setConnecting(null);
  }
};
```

هذا التعديل البسيط:
- يستدعي `testVercelToken` عند الضغط على "Connect"
- يعرض نتيجة الاختبار في alert
- يحدث status إلى connected إذا نجح

---

### Option 2: كارت منفصل مع "Test Connection"

إذا أردت كارت منفصل مع "Test Connection" button خارج integration cards الموجودة، يمكن إضافة بعد السطر 364:

```tsx
{/* Vercel Manual Token Test */}
<div className="mt-8 p-6 border rounded-lg">
  <div className="flex items-center justify-between mb-4">
    <div>
      <h3 className="text-lg font-semibold">Vercel (Manual Token)</h3>
      <p className="text-sm text-muted-foreground">
        Test your Vercel token configured in functions/.env
      </p>
    </div>
    
    <Button
      onClick={async () => {
        try {
          setConnecting('vercel');
          const fn = httpsCallable(functions, 'testVercelToken');
          const res = await fn({});
          const data = res.data as any;
          
          if (data.ok) {
            alert(`✅ Vercel Connected!\n\nUser: ${data.user?.name}\nProjects: ${data.projects?.length}`);
          }
        } catch (err: any) {
          alert(`❌ Error: ${err.message}`);
        } finally {
          setConnecting(null);
        }
      }}
      disabled={connecting === 'vercel'}
    >
      {connecting === 'vercel' ? 'Testing...' : 'Test Connection'}
    </Button>
  </div>
</div>
```

---

## Testing

### Local Testing:

1. ✅ Token موجود في `functions/.env`
2. ✅ Functions built بنجاح
3. ✅ Emulators شغالة
4. ⏳ UI: افتح http://localhost:3030/settings/integrations
5. ⏳ اضغط "Connect" على كارت Vercel (أو "Test Connection")
6. ⏳ يجب أن ترى alert بمعلومات حسابك في Vercel

---

## الحالة النهائية

| البند | الحالة |
|------|--------|
| **Token في functions/.env** | ✅ مضاف |
| **Cloud Functions** | ✅ تم إنشاؤها |
| **Functions Built** | ✅ بنجاح |
| **Emulators** | ✅ شغالة |
| **UI Update** | ✅ مكتمل |

---

**التاريخ**: 2025-11-15
**المرحلة**: 72
**النوع**: Vercel Integration - Manual Token Mode
**الحالة**: ✅ **مكتمل - جاهز للاختبار**

---

## ما تم تحديثه في الـ UI ✅

**الملف**: `src/app/[locale]/settings/integrations/page.tsx`

تم استبدال دالة `connectVercel()` من OAuth redirect إلى Cloud Function call:

```typescript
const connectVercel = async () => {
  // Phase 72: Manual Token Mode - Test via Cloud Function
  try {
    console.log('[Vercel] Testing token...');
    setConnecting('vercel');

    const fn = httpsCallable(functions, 'testVercelToken');
    const res = await fn({});
    const data = res.data as any;

    if (data.ok) {
      alert(`✅ Vercel Connected!\n\nUser: ${data.user?.name || data.user?.username || data.user?.email}\nProjects: ${data.projects?.length || 0}`);

      setStatus(prev => ({
        ...prev,
        vercel: true
      }));
    } else {
      alert('⚠️ Vercel token exists but API returned error.');
    }
  } catch (err: any) {
    console.error('[Vercel] Error:', err);
    alert(`❌ Vercel Connection Failed\n\n${err.message}`);
  } finally {
    setConnecting(null);
  }
};
```

**ما يحدث الآن عند الضغط على "Connect" في كارت Vercel:**
1. ✅ ينادي Cloud Function `testVercelToken`
2. ✅ يعرض نتيجة الاختبار في alert
3. ✅ يحدث status إلى connected إذا نجح
4. ✅ يعرض معلومات المستخدم وعدد المشاريع

---

## جاهز للاختبار الآن! 🚀

افتح: http://localhost:3030/settings/integrations
واضغط "Connect" بجانب Vercel ▲
