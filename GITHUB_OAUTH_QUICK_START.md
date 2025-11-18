# 🚀 GitHub OAuth - دليل سريع

## ✅ ما تم:

1. ✅ إضافة GitHub credentials للـ `.env.local`
2. ✅ إنشاء صفحة callback: `/auth/callback/github`
3. ✅ إنشاء API endpoint: `/api/auth/github`
4. ✅ تحديث صفحة Integrations لتدعم GitHub

---

## 🎯 كيفية الاستخدام:

### 1️⃣ تأكد إن السيرفرات شغالة:

#### Terminal 1: Firebase Emulators
```bash
firebase emulators:start --only auth,firestore,functions
```

#### Terminal 2: Next.js
```bash
PORT=3030 pnpm dev
```

---

### 2️⃣ افتح صفحة Integrations:
```
http://localhost:3030/ar/settings/integrations
```

---

### 3️⃣ اضغط على "Connect" في كرت GitHub:

**المفروض يحصل**:
1. تفتح نافذة جديدة (popup) من GitHub
2. تسجل دخول بحساب GitHub بتاعك
3. توافق على الصلاحيات (repo, read:user, user:email)
4. GitHub يحولك لـ: `http://localhost:3030/auth/callback/github?code=xxx`
5. الصفحة تبدل الـ code بـ access_token
6. الـ token يتحفظ في Firestore vault
7. ترجع لصفحة Integrations
8. كرت GitHub يظهر "Connected" ✅

---

## 🔍 Debugging:

### افتح Console في المتصفح وشوف الـ logs:

**نجاح**:
```
[GitHub OAuth] Received code, exchanging for token...
[GitHub OAuth] ✅ Success! { user: { login: "username", ... } }
```

**فشل**:
```
[GitHub OAuth] Error: ...
```

---

### شيك على الـ Firestore Emulator UI:
```
http://localhost:4000/firestore
```

**ابحث عن**:
```
vault
  └─ integrations
      └─ {userId}
          └─ github
              ├─ provider: "github"
              ├─ tokens
              │   └─ accessToken: "gho_..."
              ├─ createdAt: ...
              └─ updatedAt: ...
```

---

## 🐛 مشاكل شائعة:

### Problem 1: "404 /auth/callback/github"
**الحل**:
- Next.js محتاج يكومبايل الصفحة أول مرة
- جرب تدخل على الرابط مباشرة: `http://localhost:3030/auth/callback/github`
- لو شفت صفحة بيضاء ببساطة يبقى تمام

### Problem 2: "Missing authorization code"
**الحل**:
- تأكد إن callback URL في GitHub OAuth App هو: `http://localhost:3030/auth/callback/github`
- اذهب إلى: https://github.com/settings/developers
- افتح الـ OAuth App
- تأكد من Authorization callback URL

### Problem 3: "Failed to exchange token"
**الحل**:
```bash
# 1. تأكد إن المتغيرات موجودة في .env.local:
grep GITHUB .env.local

# 2. أعد تشغيل Next.js:
# اضغط Ctrl+C في Terminal 2 ثم:
PORT=3030 pnpm dev
```

### Problem 4: "Integration still shows 'Not Connected'"
**الحل**:
1. **سجل دخول أول حاجة!** لازم تكون مسجل دخول في التطبيق
2. انعش الصفحة (F5 أو Cmd+R)
3. شيك Console للـ errors
4. شيك Firestore Emulator UI: `http://localhost:4000/firestore`

---

## 🧪 اختبار سريع:

### Test 1: الصفحة موجودة؟
```bash
curl http://localhost:3030/auth/callback/github
# المفروض ترجع HTML
```

### Test 2: API endpoint شغال؟
```bash
curl -X POST http://localhost:3030/api/auth/github \
  -H "Content-Type: application/json" \
  -d '{"code":"test"}'
# المفروض يرجع error (لأن الـ code مش حقيقي)
# لكن دي علامة إن الـ endpoint شغال
```

---

## 📝 الخطوة الجاية:

بعد ما تتأكد إن GitHub OAuth شغال:

1. **عرض GitHub repos** في واجهة المستخدم
2. **إضافة actions** (create repo, push code, etc.)
3. **ربط Projects بـ GitHub repos**
4. **Auto-deploy** لما تعمل push

---

## 📚 الملفات المهمة:

```
src/app/auth/callback/github/page.tsx     - OAuth callback page
src/app/api/auth/github/route.ts          - Token exchange API
src/app/[locale]/settings/integrations/page.tsx - UI
functions/src/integrations/vault.ts       - Token storage
.env.local                                 - GitHub credentials
```

---

**جرب دلوقتي وقولي النتيجة!** 🚀
