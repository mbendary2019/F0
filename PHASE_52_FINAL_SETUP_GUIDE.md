# Phase 52 — GitHub Integration | دليل الإعداد النهائي

**تاريخ:** 2025-11-05
**الحالة:** ✅ جاهز للنشر والاختبار

---

## 📋 المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [إعداد GitHub OAuth App](#إعداد-github-oauth-app)
3. [متغيرات البيئة](#متغيرات-البيئة)
4. [نشر Functions](#نشر-functions)
5. [إعداد Webhooks](#إعداد-webhooks)
6. [الاختبار المحلي](#الاختبار-المحلي)
7. [الاختبار في Production](#الاختبار-في-production)
8. [استكشاف الأخطاء](#استكشاف-الأخطاء)

---

## 🎯 نظرة عامة

تتيح المرحلة 52 ربط حسابات GitHub مع F0 لتمكين:

- **OAuth Authentication**: تسجيل دخول آمن عبر GitHub
- **Repository Management**: ربط وإدارة المستودعات
- **Webhook Integration**: استقبال أحداث GitHub (push, pull_request, etc.)
- **Activity Tracking**: تتبع نشاط GitHub في الوقت الفعلي

### المكونات الرئيسية

| المكون | الوصف | الحالة |
|--------|--------|---------|
| `functions/src/lib/crypto.ts` | مكتبة التشفير AES-256-GCM | ✅ |
| `functions/src/github/oauth.ts` | دوال OAuth (3 functions) | ✅ |
| `functions/src/github/repos.ts` | إدارة المستودعات (5 functions) | ✅ |
| `src/app/api/github/callback/route.ts` | OAuth callback handler | ✅ |
| `src/app/api/github/webhooks/route.ts` | Webhook handler + signature verification | ✅ |
| `src/app/[locale]/ops/github/page.tsx` | واجهة المستخدم | ✅ |
| `firestore.rules` | قواعد الأمان | ✅ Deployed |
| `storage.rules` | قواعد التخزين | ✅ Deployed |
| `firestore.indexes.json` | الفهارس | ✅ |

---

## 🔧 إعداد GitHub OAuth App

### الخطوة 1: إنشاء OAuth App

1. اذهب إلى [GitHub Developer Settings](https://github.com/settings/developers)
2. اضغط **New OAuth App**
3. املأ البيانات:

```
Application name: F0 Platform
Homepage URL: https://from-zero-84253.web.app
Authorization callback URL: https://from-zero-84253.web.app/api/github/callback
```

4. احفظ **Client ID** و **Client Secret**

### الخطوة 2: إنشاء Webhook Secret

```bash
# توليد مفتاح عشوائي آمن
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

احفظ هذا المفتاح لاستخدامه في `GITHUB_WEBHOOK_SECRET`.

---

## ⚙️ متغيرات البيئة

### A) Functions Environment (`.env` في functions/)

تم إعداده مسبقاً في `functions/.env`:

```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=Ov23li9OjAw9N9OKNo0n
GITHUB_CLIENT_SECRET=42a3cabd8432a0d6c66c4025336f1b0268f919b9
GITHUB_REDIRECT_URI=https://from-zero-84253.web.app/api/github/callback

# Token Encryption Key (32 bytes = 64 hex chars)
TOKEN_ENCRYPTION_KEY=41982f452ac8d6a4135eaa834f7481a6afb230c5307b60c5e8761eeb54b5417c
```

### B) Next.js Environment (`.env.local`)

أضف هذه السطور إلى `.env.local`:

```bash
# GitHub Integration
NEXT_PUBLIC_GITHUB_CLIENT_ID=Ov23li9OjAw9N9OKNo0n
GITHUB_WEBHOOK_SECRET=<your-webhook-secret-here>
```

⚠️ **مهم:** لا تكشف `GITHUB_CLIENT_SECRET` في المتصفح! استخدم `NEXT_PUBLIC_` فقط لـ Client ID.

### C) Firebase Functions Config (Deprecated - تم الانتقال إلى .env)

إذا كنت تستخدم `firebase functions:config:set` (deprecated):

```bash
firebase functions:config:set \
  github.client_id="Ov23li9OjAw9N9OKNo0n" \
  github.client_secret="42a3cabd8432a0d6c66c4025336f1b0268f919b9" \
  github.redirect_uri="https://from-zero-84253.web.app/api/github/callback" \
  encryption.key="41982f452ac8d6a4135eaa834f7481a6afb230c5307b60c5e8761eeb54b5417c"
```

**ملاحظة:** الأفضل استخدام `.env` بدلاً من `functions.config()` (سيتم إيقافه في مارس 2026).

---

## 🚀 نشر Functions

### الخطوة 1: Build

```bash
cd functions
npm install
npm run build
```

### الخطوة 2: Deploy

```bash
firebase deploy --only functions
```

### الخطوة 3: التحقق من النشر

```bash
firebase functions:list
```

يجب أن ترى 8 دوال جديدة:

```
✔ exchangeOAuthCode(us-central1)
✔ revokeGitHubConnection(us-central1)
✔ getGitHubAccount(us-central1)
✔ listRepositories(us-central1)
✔ connectRepository(us-central1)
✔ disconnectRepository(us-central1)
✔ getConnectedRepositories(us-central1)
✔ updateRepositorySettings(us-central1)
```

---

## 🔗 إعداد Webhooks

### الخطوة 1: الحصول على Webhook URL

```
https://from-zero-84253.web.app/api/github/webhooks
```

### الخطوة 2: إعداد الويب هوك على GitHub

يمكنك إعداد الويب هوك على مستويين:

#### A) Repository-level Webhook (لمستودع واحد)

1. اذهب إلى Repository → Settings → Webhooks
2. اضغط **Add webhook**
3. املأ البيانات:

```
Payload URL: https://from-zero-84253.web.app/api/github/webhooks
Content type: application/json
Secret: <your-webhook-secret>
Events:
  ☑ Push events
  ☑ Pull requests
  ☑ Create
  ☑ Delete
```

#### B) OAuth App-level Webhooks (لجميع المستودعات)

لسوء الحظ، GitHub OAuth Apps لا تدعم webhooks على مستوى التطبيق. يجب:

1. **استخدام GitHub App بدلاً من OAuth App** (أكثر تعقيداً، لكن يدعم webhooks عامة)
2. **أو** إضافة webhook لكل مستودع عبر API:

```bash
# استخدام GitHub API لإضافة webhook
curl -X POST \
  -H "Authorization: Bearer <user-token>" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/OWNER/REPO/hooks \
  -d '{
    "name": "web",
    "active": true,
    "events": ["push", "pull_request", "create", "delete"],
    "config": {
      "url": "https://from-zero-84253.web.app/api/github/webhooks",
      "content_type": "json",
      "secret": "<your-webhook-secret>"
    }
  }'
```

### الخطوة 3: اختبار الويب هوك

```bash
# من لوحة GitHub Webhook Settings
# اضغط "Test delivery" → "push"
# تحقق من استقبال البيانات في /ops/github activity feed
```

---

## 🧪 الاختبار المحلي

### A) تشغيل Firebase Emulators

```bash
# Terminal 1: Start Firebase Emulators
firebase emulators:start --only functions,firestore,auth

# Terminal 2: Start Next.js Dev Server
npm run dev
```

### B) إعداد متغيرات البيئة المحلية

في `.env.local`:

```bash
NEXT_PUBLIC_USE_EMULATORS=1
NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
NEXT_PUBLIC_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

### C) اختبار OAuth Flow

1. افتح المتصفح: `http://localhost:3000/ops/github`
2. اضغط "Connect with GitHub"
3. سجل دخول GitHub وأذن التطبيق
4. تحقق من إعادة التوجيه إلى `/ops/github?connected=1`
5. تحقق من ظهور بيانات الحساب

### D) اختبار Repository Management

```typescript
// في المتصفح Console
import {getFunctions, httpsCallable} from 'firebase/functions';
import {app} from '@/lib/firebaseClient';

const functions = getFunctions(app);

// 1. List repositories
const listRepos = httpsCallable(functions, 'listRepositories');
const result = await listRepos({page: 1, perPage: 10});
console.log(result.data);

// 2. Connect a repository
const connectRepo = httpsCallable(functions, 'connectRepository');
await connectRepo({
  repoId: 123456,
  fullName: 'username/repo',
  syncEnabled: true
});

// 3. Get connected repos
const getRepos = httpsCallable(functions, 'getConnectedRepositories');
const repos = await getRepos({});
console.log(repos.data);
```

### E) اختبار Webhooks محلياً

استخدم [ngrok](https://ngrok.com/) للتوجيه:

```bash
# Terminal 3: Start ngrok
ngrok http 3000

# استخدم ngrok URL في GitHub webhook settings
# مثال: https://abc123.ngrok.io/api/github/webhooks
```

---

## ✅ الاختبار في Production

### الخطوة 1: OAuth Flow

1. اذهب إلى `https://from-zero-84253.web.app/ops/github`
2. اضغط **Connect with GitHub**
3. أذن التطبيق
4. تحقق من:
   - ✅ إعادة التوجيه نجحت
   - ✅ ظهور اسم المستخدم وصورة الحساب
   - ✅ وجود document في `ops_github_accounts/<uid>`

### الخطوة 2: Repository Listing

1. اضغط **Browse Repositories**
2. تحقق من:
   - ✅ ظهور قائمة المستودعات
   - ✅ عرض الأسماء والوصف والـ branch الافتراضي

### الخطوة 3: Connect Repository

1. اختر مستودع واضغط **Connect**
2. تحقق من:
   - ✅ ظهور رسالة النجاح
   - ✅ ظهور المستودع في قائمة "Connected Repositories"
   - ✅ وجود document في `ops_github_repos/<uid>__<repoId>`

### الخطوة 4: Webhook Events

1. قم بعمل push إلى المستودع المربوط
2. تحقق من:
   - ✅ استقبال webhook في `/api/github/webhooks`
   - ✅ تخزين activity في `ops_github_activity`
   - ✅ ظهور النشاط في activity feed (قريباً)

### الخطوة 5: Firestore Verification

```bash
# تحقق من بيانات GitHub Account
firebase firestore:get ops_github_accounts/<your-uid>

# تحقق من المستودعات المربوطة
firebase firestore:list ops_github_repos

# تحقق من النشاط
firebase firestore:list ops_github_activity
```

---

## 🐛 استكشاف الأخطاء

### خطأ: "Missing TOKEN_ENCRYPTION_KEY"

**السبب:** مفتاح التشفير غير موجود في `.env`

**الحل:**

```bash
cd functions

# توليد مفتاح جديد (32 bytes = 64 hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# إضافته إلى .env
echo "TOKEN_ENCRYPTION_KEY=<generated-key>" >> .env
```

### خطأ: "Invalid signature" في Webhooks

**السبب:** توقيع الويب هوك غير صحيح

**الحل:**

1. تحقق من `GITHUB_WEBHOOK_SECRET` في `.env.local`
2. تحقق من Secret في GitHub webhook settings
3. تأكد من تطابق القيمتين

### خطأ: "GitHub account not connected"

**السبب:** المستخدم لم يكمل OAuth flow

**الحل:**

1. اذهب إلى `/ops/github`
2. اضغط **Connect with GitHub**
3. أذن التطبيق مرة أخرى

### خطأ: "Failed to exchange code for token"

**السبب:** Client ID أو Secret خاطئ، أو redirect URI غير مطابق

**الحل:**

1. تحقق من `GITHUB_CLIENT_ID` و `GITHUB_CLIENT_SECRET` في `functions/.env`
2. تحقق من redirect URI في GitHub OAuth App settings
3. يجب أن يكون:
   ```
   https://from-zero-84253.web.app/api/github/callback
   ```

### خطأ: "Repository not found in ops_github_repos"

**السبب:** webhook استُقبل لمستودع غير مربوط

**الحل:**

1. تحقق من ربط المستودع عبر `/ops/github`
2. تحقق من وجود document في `ops_github_repos`
3. Document ID يجب أن يكون `<userId>__<repoId>`

### خطأ: Build Errors في Functions

**السبب:** TypeScript compilation errors

**الحل:**

```bash
cd functions

# تنظيف build
rm -rf lib/

# Rebuild
npm run build

# إذا كان الخطأ في GitHub files
# تحقق من imports:
# ✅ import {encryptToken, decryptToken} from '../lib/crypto';
# ❌ import * as crypto from 'crypto';
```

---

## 📊 Data Schemas المنفذة

### 1. ops_github_accounts

```typescript
{
  userId: string;           // <uid>
  login: string;            // GitHub username
  avatarUrl: string;        // Profile picture URL
  scopes: string[];         // ['repo', 'user:email', ...]
  connectedAt: Timestamp;   // When connected
  tokenEnc: {              // Encrypted OAuth token
    alg: 'aes-256-gcm';
    iv: string;            // base64
    ct: string;            // base64 ciphertext
    tag: string;           // base64 auth tag
  }
}
```

**Document ID:** `<uid>`

### 2. ops_github_repos

```typescript
{
  userId: string;           // Owner UID
  repoId: number;          // GitHub repository ID
  fullName: string;        // 'owner/repo'
  defaultBranch: string;   // 'main' | 'master' | ...
  permissions: {
    pull: boolean;
    push: boolean;
    admin: boolean;
  };
  syncEnabled: boolean;    // Auto-sync enabled?
  lastSyncAt: Timestamp | null;
}
```

**Document ID:** `<uid>__<repoId>` (compound)

### 3. ops_github_activity

```typescript
{
  userId: string;          // Owner UID
  repoId: number;         // Repository ID
  type: string;           // 'push' | 'pull_request' | 'create' | 'delete'
  branch: string | null;  // Branch name
  commit: string | null;  // Commit SHA
  by: string | null;      // Actor login
  payload: {
    action: string | null;    // 'opened' | 'closed' | ...
    size: number;            // Number of commits/files
    deliveryId: string;      // Webhook delivery ID
  };
  ts: string;             // ISO timestamp
  signature: string;      // sha256 signature (without 'sha256=' prefix)
}
```

**Document ID:** Auto-generated

---

## 🔒 أمان البيانات

### التشفير (AES-256-GCM)

- **الخوارزمية:** AES-256-GCM (Galois/Counter Mode)
- **IV Size:** 12 bytes (موصى به لـ GCM)
- **Key Size:** 32 bytes (256 bits)
- **المزايا:**
  - ✅ Confidentiality (سرية)
  - ✅ Integrity (سلامة)
  - ✅ Authenticity (أصالة)
  - ✅ Tamper Detection (كشف التلاعب)

### Firestore Security Rules

```javascript
// ops_github_accounts: Users read/write own account
match /ops_github_accounts/{userId} {
  allow read, write: if isSignedIn() && request.auth.uid == userId;
}

// ops_github_repos: Users read/write own repos
match /ops_github_repos/{docId} {
  allow read, write: if isSignedIn()
    && request.auth.uid == resource.data.userId;
}

// ops_github_activity: Users read own, CF writes
match /ops_github_activity/{activityId} {
  allow read: if isSignedIn() && (
    resource.data.userId == request.auth.uid ||
    isAdmin()
  );
  allow create, update, delete: if false; // Cloud Functions only
}
```

### Storage Rules (Deploy Exports)

```javascript
match /deploy-exports/{uid}/{fileName} {
  allow read: if isAuth() && request.auth.uid == uid;
  allow write: if false; // Cloud Functions only
}
```

---

## 📚 الملفات المُنشأة/المعدّلة

### Backend (Functions)

1. ✅ `functions/src/lib/crypto.ts` - مكتبة التشفير المركزية
2. ✅ `functions/src/github/oauth.ts` - OAuth functions (updated)
3. ✅ `functions/src/github/repos.ts` - Repository management (v2 API)
4. ✅ `functions/src/index.ts` - Exports GitHub functions
5. ✅ `functions/.env` - Environment variables
6. ✅ `functions/.gitignore` - Excludes .env

### Frontend (Next.js)

7. ✅ `src/app/api/github/callback/route.ts` - OAuth callback
8. ✅ `src/app/api/github/webhooks/route.ts` - Webhook handler
9. ✅ `src/app/[locale]/ops/github/page.tsx` - UI page

### Configuration

10. ✅ `firestore.rules` - Updated with Phase 52 rules (Deployed)
11. ✅ `storage.rules` - Added deploy-exports rules (Deployed)
12. ✅ `firestore.indexes.json` - Added GitHub indexes
13. ✅ `.env.local.example` - Added GitHub env vars

### Documentation

14. ✅ `PHASE_52_FINAL_SETUP_GUIDE.md` - هذا الملف
15. ✅ `PHASE_52_COMPLETE.md` - Implementation summary
16. ✅ `PHASE_52_SCHEMA_UPDATE.md` - Schema specifications
17. ✅ `PHASE_52_DEPLOY_NOW.md` - Quick deploy guide
18. ✅ `PHASE_52_READY_TO_DEPLOY.md` - Pre-deployment checklist

---

## ✅ قائمة المراجعة النهائية

### قبل النشر

- [x] إنشاء GitHub OAuth App
- [x] توليد webhook secret
- [x] إعداد `functions/.env`
- [x] إعداد `.env.local`
- [x] Build functions بنجاح
- [x] نشر Firestore rules
- [x] نشر Storage rules
- [x] إضافة Firestore indexes

### بعد النشر

- [ ] نشر Cloud Functions
- [ ] اختبار OAuth flow
- [ ] اختبار repository connection
- [ ] إعداد webhooks على GitHub
- [ ] اختبار webhook events
- [ ] التحقق من Firestore data

### الخطوات التالية (Day 2)

- [ ] بناء Activity Feed UI
- [ ] دعم sync modes (push/pull/pr/both)
- [ ] Repository sync automation
- [ ] Conflict resolution UI
- [ ] Deploy logs integration

---

## 🎉 الخلاصة

تم إعداد **Phase 52 - GitHub Integration** بنجاح!

### ما تم إنجازه:

✅ **OAuth Authentication** - تسجيل دخول آمن عبر GitHub
✅ **Token Encryption** - AES-256-GCM مع authentication tags
✅ **Repository Management** - ربط وإدارة المستودعات
✅ **Webhook Integration** - استقبال أحداث GitHub
✅ **Activity Tracking** - تتبع النشاط في الوقت الفعلي
✅ **Security Rules** - حماية البيانات حسب المستخدم
✅ **TypeScript Compilation** - لا أخطاء في GitHub files

### الخطوة التالية:

```bash
# نشر Functions
cd functions
firebase deploy --only functions

# اختبار OAuth
open https://from-zero-84253.web.app/ops/github
```

**جاهز للإطلاق!** 🚀

---

**آخر تحديث:** 2025-11-05
**الحالة:** ✅ Ready for Production Deployment
