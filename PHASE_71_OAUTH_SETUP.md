# Phase 71: Firebase OAuth Setup Guide

## Overview
لإعداد Firebase OAuth integration في المشروع، اتبع الخطوات التالية بالترتيب.

---

## الخطوة 1: متغيرات البيئة المطلوبة

الكود يستخدم المتغيرات التالية:

### Frontend (Next.js):
```bash
NEXT_PUBLIC_FIREBASE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### Backend (Cloud Functions):
```bash
FIREBASE_CLIENT_ID=your-client-id.apps.googleusercontent.com
FIREBASE_CLIENT_SECRET=your-client-secret
```

---

## الخطوة 2: إنشاء OAuth Client في Google Cloud Console

### 1. افتح Google Cloud Console
- اذهب إلى: https://console.cloud.google.com
- تأكد من اختيار نفس المشروع المرتبط بـ Firebase

### 2. انتقل إلى Credentials
```
من القائمة الجانبية:
APIs & Services → Credentials
```

### 3. إنشاء OAuth Client
- اضغط: **Create Credentials** → **OAuth client ID**
- النوع: **Web application**
- الاسم: `F0 Firebase Integration` (أو أي اسم تفضله)

### 4. إعداد Authorized redirect URIs
أضف الـ URIs التالية:

#### للتطوير المحلي:
```
http://localhost:3030/auth/callback/google
```

#### للإنتاج (Production):
```
https://your-domain.web.app/auth/callback/google
https://your-domain.firebaseapp.com/auth/callback/google
```

### 5. احصل على Credentials
بعد الإنشاء، ستحصل على:
- ✅ **Client ID** (مثال: `123456789-abc.apps.googleusercontent.com`)
- ✅ **Client Secret** (مثال: `GOCSPX-xxxxxxxxxxxxxxxxx`)

---

## الخطوة 3: إضافة المتغيرات في .env.local

### 1. افتح `.env.local` في جذر المشروع

### 2. أضف المتغيرات التالية:

```bash
# ===================================
# PHASE 71: Firebase OAuth Integration
# ===================================

# Frontend OAuth Client ID (public - يُستخدم في المتصفح)
NEXT_PUBLIC_FIREBASE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Backend OAuth Credentials (سري - يُستخدم في Cloud Functions)
FIREBASE_CLIENT_ID=your-client-id.apps.googleusercontent.com
FIREBASE_CLIENT_SECRET=GOCSPX-your-client-secret
```

### 3. استبدل القيم:
- `your-client-id.apps.googleusercontent.com` → الـ Client ID الذي حصلت عليه
- `GOCSPX-your-client-secret` → الـ Client Secret الذي حصلت عليه

---

## الخطوة 4: إعداد Firebase Functions

### 1. إذا كنت تستخدم Firebase Functions config (طريقة قديمة):
```bash
firebase functions:config:set \
  firebase.client_id="your-client-id.apps.googleusercontent.com" \
  firebase.client_secret="GOCSPX-your-client-secret"
```

### 2. **الطريقة المُوصى بها - استخدام Secret Manager:**
```bash
# تفعيل Secret Manager API
gcloud services enable secretmanager.googleapis.com

# إضافة Client Secret
echo -n "GOCSPX-your-client-secret" | \
  firebase functions:secrets:set FIREBASE_CLIENT_SECRET

# إضافة Client ID
echo -n "your-client-id.apps.googleusercontent.com" | \
  firebase functions:secrets:set FIREBASE_CLIENT_ID
```

---

## الخطوة 5: إعادة تشغيل Dev Server

```bash
# أوقف الـ dev server (Ctrl+C)
# ثم ابدأه من جديد:
pnpm dev
```

---

## الخطوة 6: تفعيل APIs المطلوبة في Google Cloud

اذهب إلى **APIs & Services → Library** وتأكد من تفعيل:

1. ✅ **Firebase Management API**
   ```
   https://console.cloud.google.com/apis/library/firebase.googleapis.com
   ```

2. ✅ **Identity Toolkit API** (Firebase Authentication)
   ```
   https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com
   ```

3. ✅ **Cloud Resource Manager API**
   ```
   https://console.cloud.google.com/apis/library/cloudresourcemanager.googleapis.com
   ```

---

## اختبار الـ OAuth Flow

### 1. افتح المتصفح على:
```
http://localhost:3030/ar/settings/integrations
```

### 2. اضغط على زر "Connect" تحت Firebase 🔥

### 3. ستفتح نافذة OAuth من Google
- سجل دخولك بحساب Google الذي لديه صلاحيات على Firebase
- وافق على الصلاحيات المطلوبة:
  - ✅ Cloud Platform
  - ✅ Firebase
  - ✅ Identity Toolkit

### 4. بعد الموافقة:
- سيتم حفظ الـ tokens في `vault/integrations/{uid}/firebase`
- سيتم عرض "Connected ✓" في صفحة Integrations

---

## Troubleshooting

### المشكلة: "redirect_uri_mismatch"
**الحل:**
- تأكد من إضافة `http://localhost:3030/auth/callback/google` بالضبط في Google Cloud Console
- لا توجد مسافات زائدة أو slash في النهاية

### المشكلة: "Client ID is empty"
**الحل:**
- تأكد من إضافة `NEXT_PUBLIC_FIREBASE_CLIENT_ID` في `.env.local`
- أعد تشغيل dev server بعد التعديل

### المشكلة: "Authentication required" عند استدعاء Cloud Functions
**الحل:**
- تأكد من تسجيل الدخول في التطبيق أولاً
- تحقق من أن Firebase Authentication مُفعّل في المشروع

---

## الملفات ذات الصلة

### Frontend:
- `src/app/[locale]/settings/integrations/page.tsx` - صفحة الـ Integrations
- المتغير المستخدم: `process.env.NEXT_PUBLIC_FIREBASE_CLIENT_ID`
- Redirect URI: `${window.location.origin}/auth/callback/google`

### Backend:
- `functions/src/integrations/vault.ts` - Token refresh logic
- المتغيرات المستخدمة:
  - `process.env.FIREBASE_CLIENT_ID`
  - `process.env.FIREBASE_CLIENT_SECRET`

### Auto-Setup Functions:
- `functions/src/integrations/firebase-setup.ts`
  - `createFirebaseWebApp`
  - `enableAuthProviders`
  - `setFirestoreRules`
  - `listFirebaseProjects`

---

## Next Steps

بعد إتمام OAuth setup بنجاح، يمكنك:

1. ✅ الانتقال إلى `/projects/[id]/integrations` لربط مشاريع Firebase
2. ✅ استخدام **Auto-Setup Firebase** لإنشاء Web App تلقائياً
3. ✅ تفعيل Auth Providers (Google, Email, Phone, GitHub) بضغطة واحدة
4. ✅ نشر Firestore Security Rules تلقائياً

---

## Security Notes

- ⚠️ **لا تضع** `FIREBASE_CLIENT_SECRET` في متغيرات البيئة العامة (public)
- ✅ استخدم `NEXT_PUBLIC_*` فقط للمتغيرات التي يجب أن تكون متاحة للمتصفح
- ✅ الـ tokens يتم تخزينها في `vault` collection المعزولة per-user
- ✅ يتم تشفير الـ tokens تلقائياً من Firestore

---

## للنشر على Production

عند النشر، تأكد من:

1. إضافة production redirect URI في Google Cloud Console
2. إعداد Firebase Functions secrets بشكل صحيح
3. إضافة المتغيرات في Vercel/Firebase Hosting config
4. اختبار OAuth flow على production domain

---

✅ **انتهى!** الآن لديك Firebase OAuth Integration جاهز للعمل.
