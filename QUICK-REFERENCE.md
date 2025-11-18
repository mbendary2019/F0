# 🚀 Quick Reference - Firebase + Apple Sign-In

مرجع سريع للمطورين

## 📦 الملفات الرئيسية

```
src/
├── lib/
│   ├── firebase.ts           # Firebase config & helpers
│   └── appleProvider.ts      # Apple Sign-In logic
├── providers/
│   └── AuthGate.tsx          # Auth context provider
└── app/
    └── auth/
        └── page.tsx          # Auth UI
```

## ⚡ أكواد سريعة

### تسجيل الدخول

```typescript
import { auth } from '@/lib/firebase';
import { signInWithAppleAuto } from '@/lib/appleProvider';

// تسجيل دخول (auto-detect popup/redirect)
const user = await signInWithAppleAuto(auth);

// تسجيل دخول صريح - popup
const user = await signInWithApple(auth, false);

// تسجيل دخول صريح - redirect
await signInWithApple(auth, true);
```

### معالجة Redirect

```typescript
import { handleAppleRedirect } from '@/lib/appleProvider';

// في useEffect أو عند تحميل الصفحة
const user = await handleAppleRedirect(auth);
```

### تسجيل الخروج

```typescript
import { auth } from '@/lib/firebase';

await auth.signOut();
```

### الحصول على المستخدم الحالي

```typescript
import { auth } from '@/lib/firebase';

const user = auth.currentUser;
const uid = user?.uid;
const email = user?.email;
const displayName = user?.displayName;
```

### استخدام Auth Context

```typescript
import { useAuth } from '@/providers/AuthGate';

function MyComponent() {
  const { user, loading, isSignedIn } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!isSignedIn) return <div>Please sign in</div>;

  return <div>Welcome {user.email}</div>;
}
```

### حماية صفحة

```typescript
import { withAuth } from '@/providers/AuthGate';

function Dashboard() {
  return <div>Protected content</div>;
}

export default withAuth(Dashboard, {
  requireAuth: true,
  redirectTo: '/auth'
});
```

## 🔧 Environment Variables

```bash
# .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-id
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=project.appspot.com

# Optional
APPLE_TEAM_ID=ABC123
APPLE_KEY_ID=XYZ789
APPLE_SERVICE_ID=com.app.web
```

## 🧪 الاختبار السريع

### في Console

```javascript
// التحقق من Firebase
console.log(auth.currentUser);

// تسجيل دخول يدوي
import { signInWithAppleAuto } from '@/lib/appleProvider';
import { auth } from '@/lib/firebase';
signInWithAppleAuto(auth).then(console.log);

// تسجيل خروج
auth.signOut();
```

### في Component

```tsx
'use client';
import { useAuth } from '@/providers/AuthGate';

export default function TestAuth() {
  const { user, isSignedIn } = useAuth();

  return (
    <div>
      <p>Signed in: {isSignedIn ? 'Yes' : 'No'}</p>
      <p>User: {user?.email || 'None'}</p>
    </div>
  );
}
```

## 🔍 استكشاف الأخطاء السريع

### المشكلة: Popup blocked

```typescript
// الحل: سيتحول تلقائياً لـ redirect
// أو استخدم redirect صريح
await signInWithApple(auth, true);
```

### المشكلة: Invalid OAuth client

```bash
# تحقق من:
1. Service ID صحيح في Firebase Console
2. Service ID مُطابق في Apple Developer
3. انتظر 5-10 دقائق بعد التعديل
```

### المشكلة: Unauthorized domain

```bash
# أضف النطاق في:
Firebase Console → Authentication → Settings → Authorized domains
```

### المشكلة: User is null

```typescript
// تأكد من useEffect أو AuthGate
useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged(setUser);
  return () => unsubscribe();
}, []);
```

## 📊 Helpers المتاحة

### من `firebase.ts`

```typescript
import {
  getCurrentUserId,    // string | null
  getCurrentUserEmail, // string | null
  isSignedIn,         // boolean
  signOut             // Promise<void>
} from '@/lib/firebase';
```

### من `appleProvider.ts`

```typescript
import {
  signInWithApple,        // (auth, redirect?) => Promise<User|null>
  handleAppleRedirect,    // (auth) => Promise<User|null>
  signInWithAppleAuto,    // (auth) => Promise<User|null>
  shouldUseRedirect,      // () => boolean
  getAppleCredential      // (credential) => OAuthCredential
} from '@/lib/appleProvider';
```

### من `AuthGate.tsx`

```typescript
import {
  useAuth,    // Hook: { user, loading, isSignedIn }
  withAuth    // HOC: (Component, options) => Component
} from '@/providers/AuthGate';
```

## 🎨 UI Components

### زر Apple Sign-In بسيط

```tsx
<button onClick={() => signInWithAppleAuto(auth)}>
  <img src="/apple-logo.svg" alt="Apple" />
  Sign in with Apple
</button>
```

### زر Apple Sign-In كامل

```tsx
import Image from 'next/image';

<button
  onClick={handleSignIn}
  disabled={loading}
  className="flex items-center gap-3 px-6 py-3 bg-black text-white rounded-xl"
>
  <Image src="/apple-logo.svg" alt="Apple" width={20} height={20} />
  <span>{loading ? 'Connecting...' : 'Sign in with Apple'}</span>
</button>
```

### عرض حالة المستخدم

```tsx
const { user, isSignedIn } = useAuth();

{isSignedIn ? (
  <div>
    <p>Welcome {user.displayName || user.email}</p>
    <button onClick={() => auth.signOut()}>Sign Out</button>
  </div>
) : (
  <button onClick={() => signInWithAppleAuto(auth)}>
    Sign In
  </button>
)}
```

## 🔐 أفضل الممارسات

### ✅ افعل

```typescript
// استخدم signInWithAppleAuto للاكتشاف التلقائي
const user = await signInWithAppleAuto(auth);

// احفظ الجلسة
setPersistence(auth, browserLocalPersistence);

// تحقق من الجلسة عند التحميل
useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged(setUser);
  return () => unsubscribe();
}, []);

// عالج الأخطاء
try {
  await signInWithApple(auth);
} catch (error) {
  console.error('Sign-in failed:', error);
  showErrorMessage(error.message);
}
```

### ❌ لا تفعل

```typescript
// ❌ لا تكشف API keys في client code
const apiKey = 'AIza...'; // خطأ!

// ❌ لا تحفظ tokens يدوياً
localStorage.setItem('token', ...); // Firebase يفعلها تلقائياً

// ❌ لا تستخدم auth.currentUser مباشرة دون تحقق
const email = auth.currentUser.email; // قد يكون null

// ✅ الصحيح
const email = auth.currentUser?.email ?? 'Guest';
```

## 📱 الاختبار على الأجهزة

### Desktop

```bash
npm run dev
# افتح: http://localhost:3000/auth
```

### Mobile (localhost)

```bash
# احصل على IP المحلي
ipconfig getifaddr en0  # macOS
# or
hostname -I  # Linux

# افتح في الموبايل:
http://192.168.x.x:3000/auth
```

### Production

```bash
npm run build
npm start
# أو deploy to Vercel/Firebase Hosting
```

## 🔗 روابط مفيدة

- [Firebase Console](https://console.firebase.google.com/)
- [Apple Developer](https://developer.apple.com/account/)
- [Setup Guide](./FIREBASE-APPLE-SETUP.md)
- [Checklist](./FIREBASE-CHECKLIST.md)

## 📞 الدعم

### أخطاء شائعة

| الخطأ | الحل |
|-------|------|
| `auth/popup-blocked` | يتحول تلقائياً للـ redirect |
| `auth/invalid-oauth-client-id` | تحقق من Service ID |
| `auth/unauthorized-domain` | أضف النطاق في Firebase |
| `auth/network-request-failed` | تحقق من الاتصال بالإنترنت |

### تواصل

- **Documentation:** [FIREBASE-APPLE-SETUP.md](./FIREBASE-APPLE-SETUP.md)
- **Issues:** [GitHub Issues](https://github.com/your-repo/issues)
- **Firebase Support:** https://firebase.google.com/support

---

**Last Updated:** [Date]
**Version:** 1.0.0

---

**Generated by F0 Agent 🤖**
