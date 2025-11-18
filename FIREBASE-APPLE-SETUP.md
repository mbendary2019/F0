# 🍎 Firebase + Apple Sign-In Setup Guide

دليل شامل لإعداد تسجيل الدخول عبر Apple في Firebase

## 📋 المتطلبات الأساسية

- ✅ حساب Firebase مع مشروع نشط
- ✅ حساب Apple Developer (مطلوب)
- ✅ نطاق مستضاف أو Firebase Hosting

## 🔧 الخطوة 1: إعداد Firebase Console

### 1.1 تفعيل Apple Provider

1. افتح [Firebase Console](https://console.firebase.google.com/)
2. اختر مشروعك
3. اذهب إلى **Authentication** → **Sign-in method**
4. اضغط على **Apple**
5. فعّل المزوّد (Enable)

### 1.2 نسخ Redirect URL

انسخ الـ **OAuth redirect URI** من Firebase:

```
https://<PROJECT_ID>.firebaseapp.com/__/auth/handler
```

أو إذا كنت تستخدم Custom Domain:

```
https://<YOUR_DOMAIN>/__/auth/handler
```

**احتفظ بهذا الرابط - ستحتاجه في Apple Developer!**

## 🍎 الخطوة 2: إعداد Apple Developer

### 2.1 إنشاء Service ID (للويب)

1. افتح [Apple Developer Console](https://developer.apple.com/account/)
2. اذهب إلى **Certificates, Identifiers & Profiles**
3. اختر **Identifiers** من الجانب
4. اضغط على زر **+** لإنشاء Identifier جديد
5. اختر **Services IDs** ثم **Continue**

#### تكوين Service ID:

```
Description: F0 Agent Web Auth
Identifier: com.yourcompany.f0agent.web
```

6. فعّل **Sign In with Apple**
7. اضغط على **Configure** بجانب Sign In with Apple

#### إضافة Domains and URLs:

```
Primary App ID: (اختر App ID الرئيسي إذا كان موجوداً)

Domains and Subdomains:
- yourproject.firebaseapp.com
(أو نطاقك المخصص)

Return URLs:
- https://yourproject.firebaseapp.com/__/auth/handler
```

8. اضغط **Save** ثم **Continue** ثم **Register**

### 2.2 إنشاء Key للمصادقة

1. في نفس قسم **Certificates, Identifiers & Profiles**
2. اختر **Keys** من الجانب
3. اضغط على زر **+**
4. أدخل اسم المفتاح: `F0 Agent Auth Key`
5. فعّل **Sign In with Apple**
6. اضغط **Configure**
7. اختر **Primary App ID** الذي أنشأته
8. اضغط **Save** ثم **Continue**
9. اضغط **Register**

#### 🔑 تحميل المفتاح (مهم جداً!)

10. **حمّل ملف `.p8`** - ستحتاجه لـ Firebase
11. انسخ **Key ID** (مثال: `ABC123XYZ`)
12. انسخ **Team ID** من أعلى الصفحة (مثال: `DEF456GHI`)

⚠️ **تنبيه:** لن تستطيع تحميل المفتاح مرة أخرى! احتفظ به في مكان آمن.

### 2.3 إنشاء App ID (للـ iOS - اختياري)

إذا كنت تريد دعم iOS:

1. **Identifiers** → **App IDs** → **+**
2. اختر **App**
3. أدخل:
   ```
   Description: F0 Agent iOS
   Bundle ID: com.yourcompany.f0agent
   ```
4. في **Capabilities**، فعّل:
   - ✅ Sign In with Apple
   - ✅ Associated Domains (للـ Universal Links لاحقاً)

## 🔥 الخطوة 3: إكمال إعداد Firebase

### 3.1 إضافة معلومات Apple في Firebase

عُد إلى Firebase Console → Authentication → Apple:

1. **Service ID:** `com.yourcompany.f0agent.web`
2. **Apple Team ID:** `DEF456GHI` (من Apple Developer)
3. **Key ID:** `ABC123XYZ` (من المفتاح الذي أنشأته)
4. **Private Key:** افتح ملف `.p8` وانسخ محتواه كاملاً

```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
... (المفتاح الكامل)
-----END PRIVATE KEY-----
```

5. اضغط **Save**

### 3.2 التحقق من الإعداد

✅ تأكد من:
- [ ] Service ID صحيح
- [ ] Team ID صحيح
- [ ] Key ID صحيح
- [ ] Private Key مُدخل بالكامل
- [ ] OAuth redirect URI مُسجل في Apple

## 💻 الخطوة 4: إعداد المشروع المحلي

### 4.1 إنشاء `.env.local`

```bash
cp .env.local.template .env.local
```

### 4.2 ملء المتغيرات

```bash
# Firebase Web Config
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=yourproject
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123def456
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=yourproject.appspot.com

# Apple Sign-In (معلومات إضافية - اختيارية للتوثيق)
APPLE_TEAM_ID=DEF456GHI
APPLE_KEY_ID=ABC123XYZ
APPLE_SERVICE_ID=com.yourcompany.f0agent.web
# APPLE_KEY_P8_BASE64=... (اختياري للسيرفر)
```

### 4.3 الحصول على Firebase Config

1. Firebase Console → ⚙️ Project Settings
2. انتقل إلى **Your apps**
3. اختر تطبيق الويب أو أنشئ واحداً
4. انسخ `firebaseConfig`

## 🧪 الخطوة 5: الاختبار

### 5.1 تشغيل محلياً

```bash
npm install
npm run dev
```

افتح: http://localhost:3000/auth

### 5.2 اختبار Sign-In

1. اضغط على **Sign in with Apple**
2. سيفتح نافذة منبثقة (أو redirect)
3. سجل دخول بحساب Apple ID
4. وافق على الأذونات
5. ستُعاد توجيهك للتطبيق

### 5.3 التحقق من النجاح

افتح Console في المتصفح:

```
[Apple Auth] Sign-in successful: abc123xyz...
```

## 🐛 استكشاف الأخطاء الشائعة

### ❌ المشكلة: `auth/popup-blocked`

**السبب:** المتصفح يحظر النوافذ المنبثقة

**الحل:**
- الكود يحتوي على fallback تلقائي للـ redirect
- أو استخدم `signInWithApple(auth, true)` مباشرة

### ❌ المشكلة: `auth/invalid-oauth-client-id`

**السبب:** Service ID غير صحيح

**الحل:**
1. تحقق من Service ID في Firebase
2. تأكد أنه مطابق لما في Apple Developer
3. انتظر 5-10 دقائق بعد التعديل

### ❌ المشكلة: `auth/unauthorized-domain`

**السبب:** النطاق غير مصرح به

**الحل:**
1. Firebase Console → Authentication → Settings
2. **Authorized domains** → أضف:
   - `localhost` (للتطوير)
   - `yourproject.firebaseapp.com`
   - نطاقك المخصص (إن وُجد)

### ❌ المشكلة: Redirect لا يعمل محلياً

**السبب:** Firebase Hosting غير مفعل محلياً

**الحل:**
```bash
# استخدم Firebase emulators
firebase emulators:start

# أو استخدم Popup بدلاً من Redirect للتطوير المحلي
```

### ❌ المشكلة: `Error: Invalid key`

**السبب:** Private Key غير صحيح

**الحل:**
1. تأكد من نسخ المفتاح كاملاً من ملف `.p8`
2. يجب أن يبدأ بـ `-----BEGIN PRIVATE KEY-----`
3. وينتهي بـ `-----END PRIVATE KEY-----`

## 📱 الخطوة 6: اختبار على iOS (اختياري)

### 6.1 إعداد Associated Domains

في `ios/Runner/Runner.entitlements`:

```xml
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:yourproject.firebaseapp.com</string>
</array>
```

### 6.2 تحديث Info.plist

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.yourcompany.f0agent</string>
        </array>
    </dict>
</array>
```

## 🔐 أفضل الممارسات الأمنية

### ✅ استخدام Nonce

الكود الحالي يستخدم nonce تلقائياً:

```typescript
const rawNonce = randomString(32);
const hashedNonce = await sha256(rawNonce);
provider.setCustomParameters({ nonce: hashedNonce });
```

### ✅ التحقق من Server-side

```typescript
// في Cloud Function أو API route
import { getAuth } from 'firebase-admin/auth';

const decodedToken = await getAuth().verifyIdToken(idToken);
const uid = decodedToken.uid;
```

### ✅ Rate Limiting

```typescript
// في middleware
const attempts = await redis.get(`auth:${ip}`);
if (attempts > 5) {
  throw new Error('Too many attempts');
}
```

## 📊 Telemetry (اختياري)

تتبع محاولات تسجيل الدخول:

```typescript
console.info('auth_attempt', {
  provider: 'apple',
  success: true,
  timestamp: Date.now(),
});
```

## 🔮 الميزات القادمة

### Sprint 2.1 - MFA

- [ ] إعداد Multi-Factor Authentication
- [ ] SMS verification
- [ ] TOTP (Google Authenticator)

### Sprint 2.2 - Passkeys

- [ ] WebAuthn integration
- [ ] Passkey registration
- [ ] Biometric authentication

## 📚 المراجع

- [Firebase Apple Sign-In Docs](https://firebase.google.com/docs/auth/web/apple)
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [OAuth 2.0 Best Practices](https://tools.ietf.org/html/rfc6749)

## ✅ Checklist النهائي

قبل الإطلاق:

- [ ] تم اختبار Sign-in على Desktop
- [ ] تم اختبار Sign-in على Mobile
- [ ] تم اختبار Redirect flow
- [ ] تم اختبار Popup flow
- [ ] تم التحقق من Domains المصرح بها
- [ ] تم تأمين Private Keys
- [ ] تم إعداد Rate limiting
- [ ] تم اختبار Sign-out
- [ ] تم اختبار Session persistence

---

**تم إنشاؤه بواسطة F0 Agent 🤖**

للدعم: راجع [Firebase Support](https://firebase.google.com/support) أو [Apple Developer Support](https://developer.apple.com/support/)
