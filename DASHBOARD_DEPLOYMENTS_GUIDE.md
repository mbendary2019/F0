# 📊 دليل تفعيل كارت Deployments في Dashboard

**التاريخ:** 25 نوفمبر 2025
**الحالة:** ✅ جاهز للاستخدام

---

## 🎯 الهدف

تفعيل كارت الـ Deployments في الـ Dashboard عشان يقرأ من Firestore ويعرض العدد الحقيقي للديبلويمنتس.

---

## ✅ ما تم إنجازه

### 1. **تحديث Hook: `useDashboardStats`**

**الملف:** [src/hooks/useDashboardStats.ts](src/hooks/useDashboardStats.ts)

**التغييرات:**
- ✅ قراءة من collection اسمه `projects` (بدلاً من `ops_projects`)
- ✅ قراءة من collection اسمه `deployments` (بدلاً من `ops_deployments`)
- ✅ قراءة من collection اسمه `wallets` (بدلاً من `users`)
- ✅ استخدام `balance` بدلاً من `tokens` في wallets

**الكود المهم (سطر 104-112):**
```typescript
// ---------------------------
// 3) الديبلويمنتس: deployments
// ---------------------------
const deploymentsRef = collection(db, "deployments");
const deploymentsQuery = query(
  deploymentsRef,
  where("ownerUid", "==", uid)
);

const unsubDeployments = onSnapshot(deploymentsQuery, (snap) => {
  setDeployments(snap.size);
});
```

---

### 2. **تحديث Seeding Script**

**الملف:** [tools/seedEmulator.ts](tools/seedEmulator.ts)

**التغييرات:**
- ✅ بيضيف deployments في collection اسمه `deployments`
- ✅ بيضيف projects في collection اسمه `projects`
- ✅ بيضيف wallet في collection اسمه `wallets`

**البيانات المُضافة:**
- 5 projects
- 6 deployments (4 ناجحة، 1 جارية، 1 فاشلة)
- 1 wallet document مع `balance: 230` و `plan: 'pro'`

---

## 🚀 كيفية الاستخدام

### الخطوة 1: تشغيل Firebase Emulator

```bash
firebase emulators:start
```

**يجب أن تشاهد:**
```
✔  firestore: Firestore Emulator running on 127.0.0.1:8080
✔  auth: Auth Emulator running on 127.0.0.1:9099
✔  ui: Emulator UI running on 127.0.0.1:4000
```

---

### الخطوة 2: ملء البيانات (Seeding)

```bash
OWNER_UID=demo-test-uid-12345 pnpm seed:emulator
```

**Output المتوقع:**
```
🚀 Seeding Firestore Emulator...
   Project ID: from-zero-84253
   Owner UID: demo-test-uid-12345

✅ Seeded wallets doc
✅ Seeded 5 projects in 'projects' collection
✅ Seeded 6 deployments in 'deployments' collection

🎉 Done seeding Firestore Emulator!

📊 Expected Dashboard values:
   Total Projects: 5
   Projects This Week: 5 (all just created)
   Deployments: 6
   FZ Tokens: 230
   Plan: Pro ($29/mo)
   Progress Bar: 2.3% (230/10,000)

🌐 Open Dashboard: http://localhost:3030/en/f0
```

---

### الخطوة 3: تشغيل Next.js

```bash
PORT=3030 pnpm dev
```

---

### الخطوة 4: فتح Dashboard

افتح المتصفح على:
```
http://localhost:3030/en/f0
```

**يجب أن تشاهد:**
- **Total Projects:** 5
- **Projects This Week:** 5
- **Deployments:** 6 ✅
- **FZ Tokens:** 230
- **Plan:** Pro ($29/mo)

---

## 📊 هيكل البيانات

### Collection: `deployments`

**Structure:**
```json
{
  "projectName": "F0 Platform",
  "ownerUid": "demo-test-uid-12345",
  "provider": "vercel",           // vercel | github | firebase
  "status": "success",             // success | in_progress | failed
  "branch": "main",
  "url": "https://f0-staging.vercel.app",
  "createdAt": Timestamp
}
```

---

## 🧪 اختبار Real-time Updates

### Test 1: إضافة Deployment جديد

1. افتح Firestore Emulator UI:
   ```
   http://localhost:4000/firestore
   ```

2. اذهب إلى collection اسمه `deployments`

3. اضغط "Add Document"

4. أضف:
   ```json
   {
     "projectName": "New Test Project",
     "ownerUid": "demo-test-uid-12345",
     "provider": "vercel",
     "status": "success",
     "branch": "main",
     "url": "https://test.vercel.app",
     "createdAt": { "seconds": 1732492800, "nanoseconds": 0 }
   }
   ```

5. **شاهد Dashboard يتحدث فورًا!** 🔥
   - Deployments: 6 → 7

---

### Test 2: حذف Deployment

1. في Firestore UI، احذف أحد الـ deployments

2. **شاهد العداد ينقص فورًا!** 🔥
   - Deployments: 7 → 6

---

## 🔧 التحقق من البيانات

### سكريبت التحقق السريع:

```bash
node test-collections.js
```

**Output المتوقع:**
```
🔍 Checking Firestore Collections...

✅ wallets/{uid}: { balance: 230, plan: 'pro' }
✅ projects collection: 5 documents
   - Mobile Banking App
   - Delivery App
   - Dashboard Analytics
   - E-commerce Store
   - F0 Platform
✅ deployments collection: 6 documents
   - F0 Platform (success)
   - F0 Platform (failed)
   - Dashboard Analytics (success)
   - Mobile Banking App (success)
   - E-commerce Store (in_progress)
   - Delivery App (success)

🎉 All collections verified!
```

---

## 📝 الملفات المُحدّثة

### Modified:
1. ✅ [src/hooks/useDashboardStats.ts](src/hooks/useDashboardStats.ts)
   - سطر 58: تغيير collection من `ops_projects` → `projects`
   - سطر 104: تغيير collection من `ops_deployments` → `deployments`
   - سطر 117: تغيير collection من `users` → `wallets`
   - سطر 136: تغيير field من `tokens` → `balance`

2. ✅ [tools/seedEmulator.ts](tools/seedEmulator.ts)
   - سطر 43: تغيير collection من `users` → `wallets`
   - سطر 46: تغيير field من `tokens` → `balance`
   - سطر 56: تغيير collection من `ops_projects` → `projects`
   - سطر 97: تغيير collection من `ops_deployments` → `deployments`

### Created:
3. ✅ [test-collections.js](test-collections.js) - سكريبت التحقق
4. ✅ [DASHBOARD_DEPLOYMENTS_GUIDE.md](DASHBOARD_DEPLOYMENTS_GUIDE.md) - هذا الدليل

---

## 🎨 Visual Dashboard (المتوقع)

```
╔════════════════════════════════════════════════════════════╗
║  👋 Welcome back, Developer                                ║
║  📊 Real-time Dashboard - Live Updates Enabled 🔄          ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐║
║  │ Total Projects  │  │ Live Sessions   │  │ Deployments│║
║  │      5          │  │       0         │  │     6 ✅   │║
║  │ +5 this week ✅ │  │  Active now     │  │ All proj ✅│║
║  └─────────────────┘  └─────────────────┘  └────────────┘║
║                                                            ║
║  FZ Tokens: 230                                           ║
║  Progress: ▓░░░░░░░░░ 2.3%                                ║
║  Plan: Pro - $29 / mo (230/10,000 FZ)                     ║
║                                                            ║
║  ⚡ All metrics update in real-time - no refresh needed!  ║
╚════════════════════════════════════════════════════════════╝
```

---

## ✅ Checklist

- [x] Hook يقرأ من `deployments` collection
- [x] Hook يستخدم `onSnapshot` للـ real-time updates
- [x] Seeding script يضيف 6 deployments
- [x] البيانات موجودة في Firestore Emulator
- [x] Dashboard يعرض الرقم الصحيح (6)
- [x] Real-time updates تشتغل (جرّب إضافة/حذف deployment)
- [x] Documentation جاهزة

---

## 🔍 Troubleshooting

### Issue 1: Dashboard يعرض 0 deployments

**السبب:** الـ `ownerUid` مختلف

**الحل:**
1. افتح Auth Emulator: `http://localhost:4000/auth`
2. تحقق من الـ UID للمستخدم المُسجل
3. استخدم نفس الـ UID في seeding script:
   ```bash
   OWNER_UID=your-actual-uid pnpm seed:emulator
   ```

---

### Issue 2: Real-time updates مش شغالة

**السبب:** Firestore Emulator مش شغال

**الحل:**
```bash
# تحقق من port 8080
lsof -i:8080

# لو مش شغال، شغّله
firebase emulators:start
```

---

### Issue 3: البيانات اختفت بعد restart

**السبب:** Emulator data مش persistent

**الحل:** أعد تشغيل seeding script بعد كل restart:
```bash
OWNER_UID=demo-test-uid-12345 pnpm seed:emulator
```

---

## 🎉 النتيجة النهائية

**كارت الـ Deployments الآن شغال 100%!**

✅ يقرأ من Firestore collection اسمه `deployments`
✅ يعرض العدد الحقيقي للديبلويمنتس
✅ Real-time updates تشتغل فورًا
✅ مفيش أخطاء في الـ console
✅ الكود نظيف و type-safe

---

## 🚀 الخطوة القادمة (اختياري)

### إضافة صفحة Deployments كاملة

لو عايز صفحة كاملة تعرض تفاصيل كل deployment:

1. أنشئ صفحة في: `src/app/[locale]/deployments/page.tsx`
2. استخدم نفس الـ logic من الـ hook:
   ```typescript
   const deploymentsRef = collection(db, "deployments");
   const deploymentsQuery = query(
     deploymentsRef,
     where("ownerUid", "==", uid)
   );
   ```
3. اعرض جدول بتفاصيل كل deployment (projectName, provider, status, url, etc.)

---

**🎊 Dashboard Deployments Card Complete! 🎊**

**Status:** ✅ جاهز للاستخدام
**Testing:** ✅ تم الاختبار
**Documentation:** ✅ جاهزة

**🌐 Open:** http://localhost:3030/en/f0
