# ✅ Phase 72 - Step 5: Project Domain Picker UI - COMPLETE

## 🎯 ما تم إنجازه:

تم إنشاء واجهة مستخدم كاملة لإدارة الدومينات داخل صفحة المشروع، تتيح:
- اختيار دومين من GoDaddy
- ربطه بـ Vercel أو Firebase Hosting
- إنشاء DNS records تلقائيًا (CNAME)
- عرض وحذف DNS records الموجودة

---

## 📁 الملفات الجديدة:

### 1️⃣ Custom Hooks

#### `src/features/domains/useGodaddyDomains.ts`
**الوظيفة**: جلب قائمة الدومينات من GoDaddy

**الميزات:**
- ✅ Auto-fetch on component mount
- ✅ Loading & error states
- ✅ Reload function للـ refresh يدوياً
- ✅ Type-safe مع TypeScript

**الاستخدام:**
```typescript
const { domains, loading, error, reload } = useGodaddyDomains();
```

**Response Type:**
```typescript
type GodaddyDomain = {
  domain: string;      // "example.com"
  status?: string;     // "ACTIVE"
  expires?: string;    // ISO date
};
```

---

#### `src/features/domains/useGodaddyDnsRecords.ts`
**الوظيفة**: جلب DNS records لدومين معين

**الميزات:**
- ✅ Auto-fetch عند تغيير الدومين
- ✅ Loading & error states
- ✅ `setRecords` للتحديث المحلي بعد Create/Delete
- ✅ Type-safe مع TypeScript

**الاستخدام:**
```typescript
const { records, loading, error, setRecords } = useGodaddyDnsRecords(domain);
```

**Response Type:**
```typescript
type GodaddyRecord = {
  type: string;   // "A" | "CNAME" | "TXT" | ...
  name: string;   // "@" | "www" | "app" | ...
  data: string;   // Target/value
  ttl?: number;   // Time to live
};
```

---

### 2️⃣ UI Component

#### `src/features/domains/ProjectDomainPanel.tsx`
**الوظيفة**: الواجهة الكاملة لإدارة الدومينات داخل صفحة المشروع

**الأقسام:**

**1. Domain Selector:**
- اختيار دومين من قائمة GoDaddy domains
- عرض جميع الدومينات المتاحة
- Loading state أثناء التحميل
- Error handling

**2. DNS Configuration:**
- اختيار المزوّد: Vercel / Firebase / Custom
- إدخال Subdomain (app, www, dev, etc.)
- إدخال Target Host (CNAME target)
- Preview للـ DNS record قبل الإنشاء
- زر "Attach Domain to Project"

**3. DNS Records List:**
- عرض جميع DNS records الموجودة للدومين
- عرض Type, Name, Data لكل record
- زر Delete لكل record
- تحديث القائمة محليًا بعد Create/Delete

**الميزات:**
- ✅ Form validation قبل الإرسال
- ✅ Loading states أثناء العمليات
- ✅ Error messages واضحة بالعربية
- ✅ Auto-refresh للقائمة بعد التعديلات
- ✅ Confirmation dialog قبل الحذف

---

### 3️⃣ Page Route

#### `src/app/[locale]/projects/[id]/domains/page.tsx`
**الوظيفة**: صفحة Domains & Hosting داخل المشروع

**المسار:**
```
/ar/projects/{projectId}/domains
/en/projects/{projectId}/domains
```

**المحتوى:**
- عنوان الصفحة: "Domains & Hosting"
- `ProjectDomainPanel` component
- Max width container للـ readability

---

## 🎨 User Flow:

### 1. الدخول لصفحة الدومينات:
```
http://localhost:3030/ar/projects/test-123/domains
```

### 2. اختيار دومين من GoDaddy:
- القائمة تُحمّل تلقائياً عند فتح الصفحة
- المستخدم يختار دومين من dropdown
- يتم جلب DNS records للدومين المختار تلقائياً

### 3. إعداد الربط:
**الخطوات:**
1. اختيار المزوّد (Vercel / Firebase / Custom)
2. إدخال Subdomain (مثلاً: `app`)
3. إدخال Target Host من Vercel/Firebase

**مثال لـ Vercel:**
```
Subdomain: app
Target: my-project-xyz.vercel.app
```

**النتيجة:**
سيُنشأ DNS record:
```
Type: CNAME
Name: app
Data: my-project-xyz.vercel.app
TTL: 600
```

### 4. إنشاء الـ DNS Record:
- الضغط على "Attach Domain to Project"
- Loading state يظهر
- يتم استدعاء `createDNSRecord` function
- القائمة تتحدث محليًا بدون reload
- Form يُعاد ضبطه (reset)

### 5. عرض وحذف Records:
- جميع DNS records تظهر في القائمة
- كل record له زر "Delete"
- عند الحذف: confirmation dialog
- بعد الحذف: القائمة تتحدث محليًا

---

## 🔧 التكامل مع GoDaddy Functions:

### Functions المستخدمة:

**1. getGoDaddyDomains**
```typescript
// في useGodaddyDomains.ts
const fn = httpsCallable<{}, DomainsResponse>(
  functions,
  "getGoDaddyDomains"
);
const res = await fn({});
```

**2. getDNSRecords**
```typescript
// في useGodaddyDnsRecords.ts
const fn = httpsCallable<{ domain: string }, RecordsResponse>(
  functions,
  "getDNSRecords"
);
const res = await fn({ domain });
```

**3. createDNSRecord**
```typescript
// في ProjectDomainPanel.tsx
const createFn = httpsCallable<CreateDnsPayload, { ok: boolean }>(
  functions,
  "createDNSRecord"
);
await createFn({
  domain: selectedDomain,
  type: "CNAME",
  name: subdomain,
  data: target.trim(),
  ttl: 600,
});
```

**4. deleteDNSRecord**
```typescript
// في ProjectDomainPanel.tsx
const deleteFn = httpsCallable<
  { domain: string; type: string; name: string; data?: string },
  { ok: boolean }
>(functions, "deleteDNSRecord");
await deleteFn({
  domain: selectedDomain,
  type: record.type,
  name: record.name,
  data: record.data,
});
```

---

## 📊 UI Components المستخدمة:

من `@/components/ui`:
- ✅ `Card` - Container للـ panel
- ✅ `Button` - Attach, Delete buttons
- ✅ `Select` - Domain & provider dropdown
- ✅ `Input` - Subdomain & target fields
- ✅ `Separator` - Visual dividers

---

## 🧪 كيفية الاختبار:

### Test 1: فتح صفحة الدومينات
```
http://localhost:3030/ar/projects/test-123/domains
```

**المتوقع:**
- الصفحة تفتح بدون أخطاء
- GoDaddy domains تُحمّل تلقائياً
- Loading state يظهر أثناء التحميل

---

### Test 2: اختيار دومين
**الخطوات:**
1. افتح dropdown "اختر الدومين من GoDaddy"
2. اختر دومين من القائمة

**المتوقع:**
- DNS records للدومين تُحمّل تلقائياً
- القائمة تظهر في القسم السفلي
- Loading state يظهر أثناء التحميل

---

### Test 3: ربط دومين بـ Vercel
**الخطوات:**
1. اختر دومين من القائمة
2. اختر "Vercel" كمزوّد
3. أدخل subdomain: `app`
4. أدخل target: `your-project.vercel.app`
5. اضغط "Attach Domain to Project"

**المتوقع:**
- Loading state يظهر
- DNS record يُنشأ بنجاح
- القائمة تتحدث محليًا
- Form يُعاد ضبطه

---

### Test 4: حذف DNS record
**الخطوات:**
1. اختر دومين له records موجودة
2. اضغط "Delete" على أي record
3. أكّد الحذف في الـ dialog

**المتوقع:**
- Confirmation dialog يظهر
- بعد التأكيد: record يُحذف
- القائمة تتحدث محليًا بدون reload

---

### Test 5: Error Handling
**Test Cases:**

**5.1 لا يوجد دومين مختار:**
- اضغط "Attach" بدون اختيار دومين
- **المتوقع:** رسالة خطأ بالعربية

**5.2 subdomain فارغ:**
- اختر دومين، اترك subdomain فارغ
- **المتوقع:** رسالة خطأ

**5.3 target فارغ:**
- اختر دومين، اترك target فارغ
- **المتوقع:** رسالة خطأ

**5.4 GoDaddy API error:**
- استخدم API key غير صحيح
- **المتوقع:** رسالة خطأ واضحة من GoDaddy

---

## 🌐 مثال Use Case كامل:

### السيناريو:
مشروع Next.js مستضاف على Vercel، تريد ربطه بدومين GoDaddy.

### الخطوات:

**1. في Vercel Dashboard:**
- افتح Project Settings > Domains
- اضغط "Add Domain"
- أدخل: `app.example.com`
- Vercel سيعطيك CNAME target: `cname.vercel-dns.com`

**2. في F0 Platform:**
```
1. افتح: /ar/projects/my-project/domains
2. اختر دومين: example.com
3. اختر مزوّد: Vercel
4. Subdomain: app
5. Target: cname.vercel-dns.com
6. اضغط "Attach Domain to Project"
```

**3. النتيجة:**
- DNS record يُنشأ تلقائياً في GoDaddy
- بعد propagation (عادة 5-30 دقيقة)
- المشروع يصبح متاح على: https://app.example.com

---

## 🔍 Troubleshooting:

### Problem: "Failed to load GoDaddy domains"
**السبب المحتمل:**
- GoDaddy غير متصل في صفحة Integrations
- API credentials غير صحيحة

**الحل:**
1. افتح `/ar/settings/integrations`
2. تأكد من حالة GoDaddy: "Connected"
3. إذا لا: اضغط "Connect" وأدخل credentials صحيحة

---

### Problem: "Failed to load DNS records"
**السبب المحتمل:**
- الدومين غير موجود في GoDaddy
- API permissions غير كافية

**الحل:**
- تأكد من أن GoDaddy API key له صلاحيات DNS management
- تأكد من أن الدومين مملوك لنفس الحساب

---

### Problem: "Failed to create DNS record"
**أسباب محتملة:**
1. DNS record موجود مسبقاً
2. Target غير صحيح
3. GoDaddy API rate limit

**الحل:**
1. تأكد من عدم وجود record مشابه
2. تأكد من صحة Target format
3. انتظر قليلاً وحاول مرة أخرى

---

### Problem: DNS propagation بطيء
**هذا طبيعي!** DNS propagation يأخذ وقت:
- محلياً: 5-10 دقائق
- عالمياً: حتى 48 ساعة (عادة 1-2 ساعة)

**كيفية التحقق:**
```bash
# Check DNS record
dig app.example.com

# Check propagation globally
https://www.whatsmydns.net
```

---

## 📝 الملفات النهائية:

### Created:
- ✅ `src/features/domains/useGodaddyDomains.ts` (Hook للدومينات)
- ✅ `src/features/domains/useGodaddyDnsRecords.ts` (Hook للـ DNS records)
- ✅ `src/features/domains/ProjectDomainPanel.tsx` (UI Component)
- ✅ `src/app/[locale]/projects/[id]/domains/page.tsx` (Page route)

### Dependencies:
- ✅ GoDaddy Cloud Functions (من Phase 72)
- ✅ UI Components من shadcn/ui
- ✅ Firebase Functions من `@/lib/firebase`

---

## ✅ Checklist:

- [x] Custom hooks للـ domains & DNS records
- [x] UI component للـ domain management
- [x] Page route في المشروع
- [x] Integration مع GoDaddy functions
- [x] Form validation
- [x] Error handling
- [x] Loading states
- [x] Local state updates (بدون reload)
- [x] Delete confirmation
- [x] Arabic error messages
- [x] Provider selection (Vercel/Firebase/Custom)
- [x] Subdomain preview
- [x] Target host input with hints

---

## 🎉 Summary:

**Status**: ✅ **COMPLETE & READY FOR TESTING**

**ما تم إنجازه:**
- ✅ 2 Custom hooks للبيانات
- ✅ UI component كامل للإدارة
- ✅ Page route جديد
- ✅ Integration كامل مع GoDaddy
- ✅ UX ممتاز مع loading & error states

**Test URL:**
```
http://localhost:3030/ar/projects/test-123/domains
```

**Next Steps:**
1. Test الـ UI Flow كامل
2. استخدام GoDaddy API credentials صحيحة
3. Test مع Vercel أو Firebase project حقيقي
4. Deploy to production

---

**Great work! 🚀 Domain management is now fully integrated!**
