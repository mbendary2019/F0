# Phase 52 — تحديث نماذج البيانات (Schema Update)

**تاريخ:** 2025-11-05
**الحالة:** ✅ تم تحديث النماذج بنجاح

---

## 📋 ملخص التحديثات

تم تحديث نماذج البيانات (Firestore Schemas) وخوارزميات التشفير لتتوافق مع المواصفات المحددة.

---

## 🔄 التغييرات الرئيسية

### 1. تحديث خوارزمية التشفير

**من:** AES-256-CBC
**إلى:** AES-256-GCM (Galois/Counter Mode)

**المزايا:**
- ✅ Authenticated encryption (تشفير موثّق)
- ✅ يوفر سلامة وأصالة البيانات (Integrity + Authenticity)
- ✅ يكشف التلاعب في البيانات المشفرة
- ✅ Authentication Tag للتحقق من صحة البيانات

**التنفيذ:**

```typescript
// التشفير - AES-256-GCM
function encrypt(text: string): {alg: string; iv: string; ct: string; tag: string} {
  const iv = crypto.randomBytes(12); // 12 bytes for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    ct: encrypted,
    tag: authTag.toString('base64'),
  };
}

// فك التشفير
function decrypt(encData: {alg: string; iv: string; ct: string; tag: string}): string {
  const iv = Buffer.from(encData.iv, 'base64');
  const authTag = Buffer.from(encData.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encData.ct, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

---

## 📊 نماذج البيانات المحدثة

### 1) ops_github_accounts — حسابات GitHub المتصلة

**Document ID:** `<uid>` (معرف المستخدم)

**البنية:**
```json
{
  "userId": "u123",
  "login": "octocat",
  "avatarUrl": "https://avatars.githubusercontent.com/u/1?v=4",
  "scopes": ["repo", "user:email", "workflow"],
  "connectedAt": "2025-11-06T08:00:00.000Z",
  "tokenEnc": {
    "alg": "aes-256-gcm",
    "iv": "base64-encoded-iv",
    "ct": "base64-encoded-ciphertext",
    "tag": "base64-encoded-auth-tag"
  }
}
```

**الحقول:**
- `userId` (string) - معرف المستخدم في F0
- `login` (string) - اسم المستخدم في GitHub
- `avatarUrl` (string) - رابط صورة الملف الشخصي
- `scopes` (string[]) - الصلاحيات الممنوحة
- `connectedAt` (Timestamp) - وقت الاتصال
- `tokenEnc` (object) - التوكن المشفر بـ AES-256-GCM

**Security Rules:**
```javascript
match /ops_github_accounts/{userId} {
  allow read, write: if isSignedIn() && request.auth.uid == userId;
}
```

---

### 2) ops_github_repos — المستودعات المرتبطة

**Document ID:** `<uid>__<repoId>` (مثال: `u123__456789`)

**البنية:**
```json
{
  "userId": "u123",
  "repoId": 123456,
  "fullName": "fz-labs/from-zero",
  "defaultBranch": "main",
  "permissions": {
    "pull": true,
    "push": true,
    "admin": false
  },
  "syncEnabled": true,
  "lastSyncAt": "2025-11-06T08:30:00.000Z"
}
```

**الحقول:**
- `userId` (string) - معرف المستخدم
- `repoId` (number) - معرف المستودع في GitHub
- `fullName` (string) - الاسم الكامل (owner/repo)
- `defaultBranch` (string) - الفرع الافتراضي
- `permissions` (object) - الصلاحيات (pull, push, admin)
- `syncEnabled` (boolean) - حالة المزامنة
- `lastSyncAt` (Timestamp) - آخر مزامنة

**Security Rules:**
```javascript
match /ops_github_repos/{docId} {
  allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
  allow create, update, delete: if false; // Cloud Functions only
}
```

---

### 3) ops_github_activity — أحداث الويب هوك

**Document ID:** Auto-generated

**البنية:**
```json
{
  "userId": "u123",
  "repoId": 123456,
  "type": "push",
  "branch": "main",
  "commit": "abcd1234",
  "by": "octocat",
  "payload": {
    "size": 3,
    "commits": [...]
  },
  "ts": "2025-11-06T09:00:00.000Z",
  "signature": "sha256=..."
}
```

**الحقول:**
- `userId` (string) - معرف المستخدم
- `repoId` (number) - معرف المستودع
- `type` (string) - نوع الحدث (push, pull_request, create, delete, issues)
- `branch` (string) - اسم الفرع
- `commit` (string) - معرف الـ commit
- `by` (string) - اسم المستخدم الذي قام بالحدث
- `payload` (object) - البيانات الخام من GitHub
- `ts` (Timestamp) - وقت الحدث
- `signature` (string) - التوقيع من GitHub (X-Hub-Signature-256)

**Security Rules:**
```javascript
match /ops_github_activity/{activityId} {
  allow read: if isSignedIn() && (
    resource.data.userId == request.auth.uid ||
    isAdmin()
  );
  allow create, update, delete: if false; // Cloud Functions only
}
```

---

## 🔒 الأمان

### التشفير

**الخوارزمية:** AES-256-GCM
**IV Size:** 12 bytes (موصى به لـ GCM)
**Key Size:** 32 bytes (256 bits)
**Encoding:** Base64 للـ IV, Ciphertext, و Auth Tag

**فوائد GCM:**
1. **Confidentiality** - سرية البيانات
2. **Integrity** - سلامة البيانات
3. **Authenticity** - أصالة البيانات
4. **Detection** - كشف التلاعب

### صلاحيات Firestore

**المبدأ الأساسي:** Principle of Least Privilege

1. **ops_github_accounts**
   - القراءة/الكتابة: المستخدم نفسه فقط
   - المفتاح: docId = userId

2. **ops_github_repos**
   - القراءة: المستخدم نفسه فقط
   - الكتابة: Cloud Functions فقط
   - المفتاح: docId = userId__repoId

3. **ops_github_activity**
   - القراءة: المستخدم أو الأدمن
   - الكتابة: Cloud Functions فقط (webhooks)

---

## 📝 الملفات المعدلة

### 1. functions/src/github/oauth.ts

**التغييرات:**
- ✅ تحديث `encrypt()` لاستخدام AES-256-GCM
- ✅ تحديث `decrypt()` للتعامل مع البنية الجديدة
- ✅ تغيير `tokenEncrypted` إلى `tokenEnc`
- ✅ تبسيط نموذج `ops_github_accounts`
- ✅ إزالة الحقول غير الضرورية (name, email, githubId, etc.)

### 2. functions/src/github/repos.ts

**التغييرات:**
- ✅ استخدام Document ID مركب: `${userId}__${repoId}`
- ✅ تبسيط نموذج `ops_github_repos`
- ✅ الاحتفاظ بالحقول الأساسية فقط
- ✅ إزالة الحقول الزائدة (description, htmlUrl, cloneUrl, etc.)

### 3. firestore.rules

**التغييرات:**
- ✅ إضافة قواعد `ops_github_accounts`
- ✅ إضافة قواعد `ops_github_repos`
- ✅ إضافة قواعد `ops_github_activity`
- ✅ تأمين الوصول حسب userId

---

## 🧪 الاختبار

### اختبار التشفير

```typescript
// Test encryption/decryption
const testToken = 'ghp_test123456789';
const encrypted = encrypt(testToken);

console.log('Encrypted:', encrypted);
// Output: {
//   alg: 'aes-256-gcm',
//   iv: 'base64...',
//   ct: 'base64...',
//   tag: 'base64...'
// }

const decrypted = decrypt(encrypted);
console.log('Decrypted:', decrypted); // 'ghp_test123456789'
```

### اختبار Firestore

```bash
# Deploy security rules
firebase deploy --only firestore:rules

# Test read/write
# User can read own account
# User CANNOT read other users' accounts
# Cloud Functions can write to all collections
```

---

## ⚠️ ملاحظات مهمة

### 1. مفتاح التشفير

يجب أن يكون **32 byte** (64 hex characters):

```bash
# Generate new key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Document IDs

**ops_github_accounts:** `<uid>`
```
u123
```

**ops_github_repos:** `<uid>__<repoId>`
```
u123__456789
```

**ops_github_activity:** Auto-generated
```
auto-generated-id
```

### 3. الهجرة من النموذج القديم

إذا كانت هناك بيانات موجودة بالنموذج القديم:

```typescript
// Migration script (if needed)
async function migrateAccounts() {
  const accounts = await db.collection('ops_github_accounts').get();

  for (const doc of accounts.docs) {
    const data = doc.data();

    // Old format: tokenEncrypted (string)
    if (typeof data.tokenEncrypted === 'string') {
      // Need to re-encrypt with new format
      // This requires the original plaintext token
      // Can't decrypt old format if encryption changed
      console.warn('Cannot migrate without original token');
    }
  }
}
```

**⚠️ تحذير:** لا يمكن ترحيل التوكنات المشفرة بالطريقة القديمة تلقائيًا.
**الحل:** يجب على المستخدمين إعادة الاتصال بـ GitHub.

---

## ✅ قائمة المراجعة

### التحديثات المكتملة

- [x] تحديث خوارزمية التشفير إلى AES-256-GCM
- [x] تحديث نموذج `ops_github_accounts`
- [x] تحديث نموذج `ops_github_repos`
- [x] تحديث Document IDs
- [x] إضافة قواعد Firestore الأمنية
- [x] تحديث دوال OAuth
- [x] تحديث دوال Repository Management

### المطلوب للنشر

- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Deploy functions: `firebase deploy --only functions`
- [ ] اختبار OAuth flow
- [ ] اختبار repository connection
- [ ] التحقق من security rules

---

## 📚 المراجع

**AES-GCM Documentation:**
- [Node.js Crypto - createCipheriv](https://nodejs.org/api/crypto.html#crypto_crypto_createcipheriv_algorithm_key_iv_options)
- [NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)

**GitHub OAuth:**
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)
- [Authorizing OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)

---

**الحالة:** ✅ جاهز للنشر

**آخر تحديث:** 2025-11-05
