# Phase 52 — اختبار محلي مع Firebase Emulators

**التاريخ:** 2025-11-05
**الغرض:** اختبار GitHub Integration محلياً دون لمس البيئة الإنتاجية

---

## 🎯 نظرة عامة

هذا الدليل يشرح كيفية اختبار **Phase 52 - GitHub Integration** محلياً باستخدام Firebase Emulators.

### ✅ الميزات المتاحة محلياً

- ✅ **Auth Emulator** - تسجيل دخول المستخدمين
- ✅ **Firestore Emulator** - قاعدة بيانات محلية
- ✅ **Functions Emulator** - تشغيل Cloud Functions محلياً
- ✅ **Storage Emulator** - تخزين الملفات محلياً
- ✅ **Emulator UI** - واجهة رسومية للإدارة
- ⚠️ **GitHub OAuth** - يتطلب ngrok للاختبار الكامل

---

## 🚀 البدء السريع

### الخطوة 1: تشغيل Emulators

```bash
# في Terminal 1
cd /Users/abdo/Downloads/from-zero-starter
firebase emulators:start
```

**الخدمات المتوفرة:**
- 🔐 Auth UI: `http://127.0.0.1:4000/auth`
- 📊 Firestore UI: `http://127.0.0.1:4000/firestore`
- ⚡ Functions Logs: `http://127.0.0.1:4000/logs`
- 📦 Storage Browser: `http://127.0.0.1:4000/storage`
- 🎛️ Emulator UI: `http://127.0.0.1:4000`

### الخطوة 2: تشغيل Next.js Dev Server

```bash
# في Terminal 2
npm run dev
```

**التطبيق متاح على:**
- 🌐 Next.js: `http://localhost:3000`
- 🔗 GitHub Page: `http://localhost:3000/ops/github`

---

## ⚙️ إعدادات البيئة المحلية

### A) التحقق من `.env.local`

تأكد من وجود هذه المتغيرات:

```bash
# Enable Emulators
NEXT_PUBLIC_USE_EMULATORS=1

# Auth Emulator
NEXT_PUBLIC_AUTH_EMULATOR_HOST=http://127.0.0.1:9099
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099

# Firestore Emulator
NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080

# Functions Emulator
NEXT_PUBLIC_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001

# Storage Emulator
NEXT_PUBLIC_STORAGE_EMULATOR_HOST=127.0.0.1:9199

# GitHub OAuth (for testing)
NEXT_PUBLIC_GITHUB_CLIENT_ID=Ov23li9OjAw9N9OKNo0n
GITHUB_WEBHOOK_SECRET=your-test-webhook-secret
```

### B) التحقق من `functions/.env`

```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=Ov23li9OjAw9N9OKNo0n
GITHUB_CLIENT_SECRET=42a3cabd8432a0d6c66c4025336f1b0268f919b9
GITHUB_REDIRECT_URI=http://localhost:3000/api/github/callback

# Token Encryption Key
TOKEN_ENCRYPTION_KEY=41982f452ac8d6a4135eaa834f7481a6afb230c5307b60c5e8761eeb54b5417c

# Local Development
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

---

## 🧪 اختبار الوظائف

### 1. اختبار تسجيل الدخول

```bash
# 1. افتح المتصفح
open http://localhost:3000/ops/github

# 2. سجل دخول كمستخدم تجريبي عبر Auth Emulator
# Username: test@example.com
# Password: password123

# 3. تحقق من Emulator UI
open http://127.0.0.1:4000/auth
```

### 2. اختبار Functions محلياً

#### A) من Browser Console

افتح `http://localhost:3000/ops/github` واكتب في Console:

```javascript
// Import Firebase
import {getFunctions, httpsCallable, connectFunctionsEmulator} from 'firebase/functions';
import {app} from '@/lib/firebaseClient';

// Connect to emulator
const functions = getFunctions(app);
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

// Test getGitHubAccount
const getAccount = httpsCallable(functions, 'getGitHubAccount');
const result = await getAccount({});
console.log(result.data);
```

#### B) من Terminal (curl)

```bash
# Get GitHub Account Status
curl -X POST \
  http://127.0.0.1:5001/from-zero-84253/us-central1/getGitHubAccount \
  -H "Content-Type: application/json" \
  -d '{}'

# List Repositories
curl -X POST \
  http://127.0.0.1:5001/from-zero-84253/us-central1/listRepositories \
  -H "Content-Type: application/json" \
  -d '{"data": {"page": 1, "perPage": 10}}'
```

### 3. اختبار OAuth Flow (مع ngrok)

⚠️ **ملاحظة:** GitHub OAuth يتطلب HTTPS، لذا نستخدم ngrok:

```bash
# Terminal 3: Start ngrok
ngrok http 3000

# استخدم ngrok URL في GitHub OAuth App settings
# مثال: https://abc123.ngrok.io/api/github/callback
```

**الخطوات:**

1. افتح `https://abc123.ngrok.io/ops/github`
2. اضغط "Connect with GitHub"
3. سجل دخول GitHub وأذن التطبيق
4. تحقق من redirect إلى `?connected=1`
5. تحقق من Firestore Emulator UI:
   ```
   http://127.0.0.1:4000/firestore/data/ops_github_accounts
   ```

### 4. اختبار Webhooks محلياً

#### A) إعداد Webhook على GitHub

استخدم ngrok URL:
```
Payload URL: https://abc123.ngrok.io/api/github/webhooks
Content type: application/json
Secret: your-test-webhook-secret
```

#### B) محاكاة Webhook يدوياً

```bash
# محاكاة push event
curl -X POST \
  http://localhost:3000/api/github/webhooks \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-delivery-123" \
  -H "X-Hub-Signature-256: sha256=$(echo -n '{"repository":{"id":123456},"ref":"refs/heads/main","commits":[{"id":"abc123"}],"pusher":{"name":"testuser"}}' | openssl dgst -sha256 -hmac 'your-test-webhook-secret' | cut -d' ' -f2)" \
  -d '{
    "repository": {"id": 123456, "full_name": "test/repo"},
    "ref": "refs/heads/main",
    "commits": [{"id": "abc123", "message": "Test commit"}],
    "pusher": {"name": "testuser"},
    "sender": {"login": "testuser"}
  }'
```

### 5. اختبار Firestore Data

#### A) من Emulator UI

```bash
# افتح Firestore UI
open http://127.0.0.1:4000/firestore

# تصفح المجموعات:
# - ops_github_accounts
# - ops_github_repos
# - ops_github_activity
```

#### B) إضافة بيانات تجريبية يدوياً

في Emulator UI → Firestore → Start Collection:

**ops_github_accounts:**
```json
{
  "userId": "test-user-123",
  "login": "octocat",
  "avatarUrl": "https://avatars.githubusercontent.com/u/1?v=4",
  "scopes": ["repo", "user:email"],
  "connectedAt": "2025-11-05T10:00:00.000Z",
  "tokenEnc": {
    "alg": "aes-256-gcm",
    "iv": "dGVzdGl2MTIzNDU2",
    "ct": "encrypted-token-here",
    "tag": "auth-tag-here"
  }
}
```

**ops_github_repos:**
```json
{
  "userId": "test-user-123",
  "repoId": 123456,
  "fullName": "octocat/Hello-World",
  "defaultBranch": "main",
  "permissions": {
    "pull": true,
    "push": true,
    "admin": false
  },
  "syncEnabled": true,
  "lastSyncAt": null
}
```

---

## 🔍 مراقبة Logs

### A) Functions Logs

```bash
# في Emulator UI
open http://127.0.0.1:4000/logs

# أو في Terminal حيث يعمل firebase emulators:start
# سترى logs مباشرة
```

### B) Next.js Logs

```bash
# في Terminal حيث يعمل npm run dev
# سترى API route logs
```

### C) Browser DevTools

```javascript
// في Console
console.log('Testing GitHub integration...');
```

---

## 🐛 استكشاف الأخطاء

### خطأ: "ECONNREFUSED 127.0.0.1:5001"

**السبب:** Functions Emulator غير مشغّل

**الحل:**
```bash
firebase emulators:start
```

### خطأ: "Firebase: Error (auth/network-request-failed)"

**السبب:** Auth Emulator غير متصل

**الحل:** تحقق من:
```bash
# في .env.local
NEXT_PUBLIC_AUTH_EMULATOR_HOST=http://127.0.0.1:9099
```

### خطأ: "Invalid signature" في Webhooks

**السبب:** Webhook secret غير مطابق

**الحل:**
```bash
# تأكد من تطابق GITHUB_WEBHOOK_SECRET في .env.local
# مع Secret في curl command
```

### خطأ: "GitHub account not connected"

**الحل:**
```bash
# أضف بيانات تجريبية يدوياً في Firestore Emulator UI
# أو استخدم ngrok لاختبار OAuth flow الحقيقي
```

---

## 📊 Emulator Ports

| Service | Port | URL |
|---------|------|-----|
| Emulator UI | 4000 | http://127.0.0.1:4000 |
| Auth | 9099 | http://127.0.0.1:9099 |
| Firestore | 8080 | http://127.0.0.1:8080 |
| Functions | 5001 | http://127.0.0.1:5001 |
| Storage | 9199 | http://127.0.0.1:9199 |
| Hosting | 5000 | http://127.0.0.1:5000 |
| Next.js Dev | 3000 | http://localhost:3000 |

---

## 🔄 إعادة تعيين البيانات

### مسح جميع البيانات

```bash
# أوقف Emulators (Ctrl+C)
# ثم أعد تشغيلها
firebase emulators:start

# أو امسح بيانات محددة من UI
# http://127.0.0.1:4000/firestore → Clear all data
```

### استيراد بيانات تجريبية

```bash
# إنشاء ملف seed data
# functions/test-data/github-seed.json

# استيراده عبر Firebase CLI (قريباً)
```

---

## ✅ قائمة الاختبار المحلي

### قبل البدء
- [ ] تشغيل `firebase emulators:start`
- [ ] تشغيل `npm run dev`
- [ ] التحقق من `.env.local`
- [ ] التحقق من `functions/.env`

### اختبار Auth
- [ ] تسجيل دخول مستخدم تجريبي
- [ ] عرض المستخدم في Auth Emulator UI
- [ ] تسجيل خروج

### اختبار Functions
- [ ] `getGitHubAccount` - الحصول على حالة الحساب
- [ ] `listRepositories` - قائمة المستودعات
- [ ] `connectRepository` - ربط مستودع
- [ ] `disconnectRepository` - فك ربط
- [ ] `getConnectedRepositories` - المستودعات المربوطة

### اختبار OAuth (مع ngrok)
- [ ] تشغيل ngrok
- [ ] تحديث GitHub OAuth App redirect URI
- [ ] اختبار "Connect with GitHub"
- [ ] التحقق من tokenEnc في Firestore

### اختبار Webhooks
- [ ] إرسال test webhook
- [ ] التحقق من signature verification
- [ ] التحقق من تخزين activity

### اختبار UI
- [ ] عرض GitHub page
- [ ] عرض قائمة المستودعات
- [ ] ربط/فك ربط مستودع
- [ ] عرض Connected Repositories

---

## 📚 أدوات مفيدة

### 1. Firebase Emulator UI
```bash
open http://127.0.0.1:4000
```

### 2. Firestore Query في Console

```javascript
// في Browser Console على http://localhost:3000
import {getFirestore, collection, getDocs} from 'firebase/firestore';
import {app} from '@/lib/firebaseClient';

const db = getFirestore(app);
const snapshot = await getDocs(collection(db, 'ops_github_accounts'));
snapshot.forEach(doc => console.log(doc.id, doc.data()));
```

### 3. Test Data Generator

```bash
# قريباً: سكريبت لتوليد بيانات تجريبية
node functions/scripts/generate-test-data.js
```

---

## 🎉 الخلاصة

الآن يمكنك اختبار **GitHub Integration** محلياً بالكامل دون لمس البيئة الإنتاجية!

### الخطوات الأساسية:
1. ✅ تشغيل Emulators
2. ✅ تشغيل Next.js Dev
3. ✅ (اختياري) تشغيل ngrok للـ OAuth
4. ✅ اختبار Functions والواجهة
5. ✅ مراقبة Logs في Emulator UI

**جاهز للاختبار!** 🚀

---

**آخر تحديث:** 2025-11-05
**الإصدار:** Phase 52 - Local Testing Guide
