# 📊 Dashboard Seeding Guide - دليل ملء البيانات

**التاريخ:** 25 نوفمبر 2025
**الحالة:** ✅ جاهز للاستخدام

---

## 🎯 الهدف

هذا الدليل يشرح كيفية ملء البيانات في Firebase Emulator عشان تختبر الـ Dashboard بسرعة.

---

## 📦 ما تم إضافته

### 1. ✅ Hook محدّث: `src/hooks/useDashboardStats.ts`

**التحسينات:**
- استخدام `useState` منفصل لكل قيمة (أفضل للـ performance)
- قراءة من `users/{uid}` مع الحقول:
  - `plan` → نوع الباقة (starter/pro/ultimate)
  - `fzTokens` → رصيد التوكنز
- حساب `projectsDelta` (المشاريع آخر 7 أيام) تلقائيًا
- تعليقات عربية واضحة

**البنية الجديدة:**
```typescript
type PlanId = "starter" | "pro" | "ultimate";

interface DashboardStats {
  loading: boolean;
  user: User | null;
  totalProjects: number;
  projectsDelta: number;    // 🆕 المشاريع آخر أسبوع
  deployments: number;
  tokens: number;
  plan: PlanId;            // 🆕 نوع الباقة
}
```

---

### 2. ✅ Seeding Script: `tools/seedEmulator.ts`

**ما يعمله:**
- إنشاء `users/{uid}` document مع:
  - `plan: "pro"`
  - `fzTokens: 1250`
  - `email: "dev@test.com"`

- إضافة **5 مشاريع** في `ops_projects`:
  - Delivery App
  - E-commerce Store
  - F0 Platform
  - Mobile Banking App
  - Dashboard Analytics

- إضافة **6 ديبلويمِنتس** في `ops_deployments`:
  - 4 ناجحة (success)
  - 1 جارية (in_progress)
  - 1 فاشلة (failed)

---

## 🚀 كيفية الاستخدام

### الخطوة 1: شغّل Firebase Emulator

```bash
firebase emulators:start
```

**يجب أن تشاهد:**
```
✔  firestore: Firestore Emulator running on 127.0.0.1:8080
✔  auth: Auth Emulator running on 127.0.0.1:9099
✔  functions: Functions Emulator running on 127.0.0.1:5001
```

---

### الخطوة 2: احصل على الـ UID

1. افتح Auth Emulator UI:
   ```
   http://localhost:4000/auth
   ```

2. سجّل دخول أو أنشئ يوزر جديد

3. انسخ الـ **UID** (مثال: `wXjoMFHxcMjl9CbXpQNxM8VPLRQO`)

---

### الخطوة 3: شغّل Seeding Script

```bash
OWNER_UID=your-uid-here pnpm seed:emulator
```

**مثال:**
```bash
OWNER_UID=wXjoMFHxcMjl9CbXpQNxM8VPLRQO pnpm seed:emulator
```

**Output المتوقع:**
```
🚀 Seeding Firestore Emulator...
   Project ID: from-zero-84253
   Owner UID: wXjoMFHxcMjl9CbXpQNxM8VPLRQO

✅ Seeded users doc
✅ Seeded 5 projects in ops_projects
✅ Seeded 6 deployments in ops_deployments

🎉 Done seeding Firestore Emulator!

📊 Expected Dashboard values:
   Total Projects: 5
   Projects This Week: 5 (all just created)
   Deployments: 6
   FZ Tokens: 1,250
   Plan: Pro ($29/mo)
   Progress Bar: 12.5% (1,250/10,000)

🌐 Open Dashboard: http://localhost:3030/en/f0
```

---

### الخطوة 4: شغّل Next.js Dev Server

```bash
PORT=3030 pnpm dev
```

---

### الخطوة 5: افتح Dashboard

```
http://localhost:3030/en/f0
```

---

## 📊 القيم المتوقعة

بعد تشغيل الـ seeding script، يجب أن تشاهد:

| Metric | Expected Value | Source |
|--------|---------------|--------|
| **Total Projects** | 5 | `ops_projects` collection |
| **Projects This Week** | 5 | `ops_projects` (filtered by createdAt) |
| **Deployments** | 6 | `ops_deployments` collection |
| **FZ Tokens** | 1,250 | `users/{uid}.fzTokens` |
| **Plan** | Pro ($29/mo) | `users/{uid}.plan` |
| **Progress Bar** | ▓░░░░░░░░░ 12.5% | (1,250 / 10,000) × 100 |

---

## 🔧 هيكل البيانات

### users/{uid}
```json
{
  "email": "dev@test.com",
  "plan": "pro",
  "fzTokens": 1250,
  "createdAt": Timestamp,
  "updatedAt": Timestamp
}
```

### ops_projects/{projectId}
```json
{
  "name": "Delivery App",
  "type": "web",
  "status": "draft",
  "ownerUid": "wXjoMFHxcMjl9CbXpQNxM8VPLRQO",
  "createdAt": Timestamp,
  "updatedAt": Timestamp
}
```

### ops_deployments/{deploymentId}
```json
{
  "projectName": "Delivery App",
  "provider": "vercel",
  "status": "success",
  "branch": "main",
  "url": "https://delivery-app.vercel.app",
  "ownerUid": "wXjoMFHxcMjl9CbXpQNxM8VPLRQO",
  "createdAt": Timestamp
}
```

---

## 🎨 Visual Dashboard

```
╔════════════════════════════════════════════════════════════╗
║  👋 Welcome back, Developer                                ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐║
║  │ Total Projects  │  │ Live Sessions   │  │ Deployments│║
║  │      5          │  │       0         │  │     6      │║
║  │ +5 this week ✅ │  │  Active now     │  │ All proj ✅│║
║  └─────────────────┘  └─────────────────┘  └────────────┘║
║                                                            ║
║  FZ Tokens: 1,250                                         ║
║  Progress: ▓░░░░░░░░░ 12.5%                               ║
║  Plan: Pro - $29 / mo (1,250/10,000 FZ)                   ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

---

## 🔄 إعادة Seeding (بعد إعادة تشغيل Emulator)

إذا أعدت تشغيل Firebase Emulator، البيانات ستُمسح. لإعادة ملئها:

```bash
# 1. احصل على UID جديد من Auth Emulator
# 2. شغّل seeding script مرة أخرى
OWNER_UID=new-uid-here pnpm seed:emulator
```

---

## 🛠️ تخصيص البيانات

لتغيير البيانات المُضافة، عدّل الملف:
```
tools/seedEmulator.ts
```

**أمثلة على التخصيصات:**

### تغيير عدد التوكنز:
```typescript
await userRef.set({
  // ...
  fzTokens: 5000,  // ← غيّر القيمة هنا
  // ...
});
```

### إضافة مشاريع أكثر:
```typescript
const projectsPayload = [
  // ... المشاريع الموجودة
  {
    name: 'Your New Project',
    type: 'mobile',
    status: 'active',
  },
];
```

### تغيير الباقة:
```typescript
await userRef.set({
  // ...
  plan: 'ultimate',  // starter | pro | ultimate
  fzTokens: 50000,
  // ...
});
```

---

## 🐛 Troubleshooting

### المشكلة 1: `❌ عدّل OWNER_UID...`

**السبب:** لم تحدد الـ UID

**الحل:**
```bash
# أضف OWNER_UID قبل الأمر
OWNER_UID=your-actual-uid pnpm seed:emulator
```

---

### المشكلة 2: `Error: 14 UNAVAILABLE`

**السبب:** Firebase Emulator غير شغّال

**الحل:**
```bash
# في terminal منفصل
firebase emulators:start

# ثم شغّل seeding script
OWNER_UID=your-uid pnpm seed:emulator
```

---

### المشكلة 3: Dashboard يعرض 0 projects

**السبب:** الـ UID مختلف بين Auth و Firestore

**الحل:**
1. افتح Auth Emulator: `http://localhost:4000/auth`
2. تأكد من الـ UID المستخدم في التسجيل
3. استخدم نفس الـ UID في seeding script
4. أعد تشغيل الـ script

---

## 📝 الملفات المُنشأة

1. ✅ `src/hooks/useDashboardStats.ts` - Hook محدّث
2. ✅ `tools/seedEmulator.ts` - Seeding script
3. ✅ `package.json` - أضيف سكريبت `seed:emulator`
4. ✅ `DASHBOARD_SEEDING_GUIDE.md` - هذا الدليل

---

## ✅ Checklist

- [ ] Firebase Emulator شغّال على port 8080
- [ ] Next.js Dev Server شغّال على port 3030
- [ ] حصلت على UID من Auth Emulator
- [ ] شغّلت `OWNER_UID=xxx pnpm seed:emulator`
- [ ] فتحت Dashboard على `http://localhost:3030/en/f0`
- [ ] شاهدت 5 projects و 6 deployments
- [ ] Progress bar يعرض 12.5%
- [ ] Plan يعرض "Pro - $29 / mo"

---

## 🎉 الخلاصة

الـ Dashboard الآن **جاهز تمامًا** مع:
- ✅ Hook يقرأ من Firestore مباشرة
- ✅ قراءة من `users/{uid}` بالحقول الجديدة (`plan`, `fzTokens`)
- ✅ حساب تلقائي للمشاريع آخر أسبوع
- ✅ Seeding script سريع لملء البيانات
- ✅ دعم كامل للـ Emulator

---

**Status:** ✅ COMPLETE
**Last Updated:** November 25, 2025
**Next Step:** Test the Dashboard with real data!

🌐 **Open:** http://localhost:3030/en/f0
