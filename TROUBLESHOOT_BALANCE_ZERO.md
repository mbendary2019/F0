# 🔍 Troubleshooting: Balance Shows 0 in Dashboard

## المشكلة
Dashboard يعرض `FZ Tokens: 0` بالرغم من وجود wallet بـ `balance: 1000` في Firestore Emulator.

---

## ✅ ما تم التحقق منه

### 1. Wallet موجود في Emulator
```bash
$ node check-current-auth.js

📧 Email: dev@test.com
🆔 UID: upraBmuRv3PEMQOUKs7EuKXU8xLt
✅ Has wallet:
   Balance: 1000
   Plan: pro
```

### 2. Firebase Client متصل بالـ Emulator
```
✅ NEXT_PUBLIC_USE_EMULATORS=1 موجود في .env.local
✅ firebaseClient.ts يتصل بـ Firestore Emulator على 127.0.0.1:8080
```

### 3. Hook Code صحيح
```typescript
// src/hooks/useDashboardStats.ts
const walletRef = doc(db, 'wallets', uid);
const walletSnap = await getDoc(walletRef);

if (walletSnap.exists()) {
  const wData: any = walletSnap.data();
  const balance = typeof wData.balance === 'number' ? wData.balance : 0;
  setTokens(balance); // ✅ صحيح
}
```

---

## 🔧 خطوات الحل

### Step 1: تحقق من الـ Console Logs

1. افتح Dashboard: http://localhost:3030/en/f0
2. افتح Developer Console (F12 → Console tab)
3. ابحث عن:
   ```
   [useDashboardStats] Wallet check for uid: ...
   [useDashboardStats] Wallet exists? ...
   [useDashboardStats] Wallet data: ...
   [useDashboardStats] Setting tokens to: ...
   ```

**السيناريوهات المحتملة:**

#### Scenario A: Wallet exists? false
**السبب:** Firebase Client مش متصل بالـ Emulator

**الحل:**
```bash
# تأكد من .env.local
echo "NEXT_PUBLIC_USE_EMULATORS=1" >> .env.local

# أعد تشغيل Next.js dev server
# اضغط Ctrl+C في Terminal اللي شغّال فيه pnpm dev
# ثم:
PORT=3030 pnpm dev
```

#### Scenario B: Setting tokens to: 1000 (but UI shows 0)
**السبب:** React state مش بيتحدث

**الحل:**
- Hard refresh: Cmd+Shift+R (Mac) أو Ctrl+Shift+R (Windows)
- أو امسح Cache: Developer Tools → Application → Clear Storage

#### Scenario C: No logs at all
**السبب:** User مش logged in

**الحل:**
1. اذهب لـ: http://localhost:3030/en/auth
2. سجّل دخول بـ: dev@test.com
3. ارجع لـ Dashboard

---

### Step 2: تحقق من Auth State

أنشئ script للتحقق من الـ current user في المتصفح:

1. افتح Console في Dashboard page
2. اكتب:
   ```javascript
   import { auth } from '@/lib/firebaseClient';
   auth.currentUser
   ```

يجب أن يعرض:
```javascript
{
  uid: "upraBmuRv3PEMQOUKs7EuKXU8xLt",
  email: "dev@test.com",
  ...
}
```

لو `null`، يبقى مش logged in.

---

### Step 3: Force Wallet Reload

أضف button للـ Dashboard لإعادة تحميل البيانات:

```typescript
// src/app/[locale]/f0/page.tsx
const [refreshKey, setRefreshKey] = useState(0);

// في الـ useEffect
useEffect(() => {
  // ...
}, [refreshKey]);

// في الـ UI
<button onClick={() => setRefreshKey(k => k + 1)}>
  Reload Stats
</button>
```

---

### Step 4: تحقق من Firestore Rules

```bash
# افتح Firestore UI
open http://localhost:4000/firestore
```

1. اذهب لـ `wallets` collection
2. افتح document: `upraBmuRv3PEMQOUKs7EuKXU8xLt`
3. تأكد من:
   - `balance: 1000`
   - `plan: "pro"`

---

## 🚀 Quick Fix (إذا كل شيء فشل)

### Option 1: أعد إنشاء الـ Wallet

```bash
node check-current-auth.js
```

هيمسح ويعيد إنشاء الـ wallet.

### Option 2: Hard Reset للـ Emulator

```bash
# أوقف الـ Emulator
# اضغط Ctrl+C في Terminal اللي شغّال فيه firebase emulators:start

# امسح البيانات
rm -rf .firebase/

# أعد تشغيل
firebase emulators:start --only firestore,auth,functions

# في terminal تاني، أعد seeding
OWNER_UID=upraBmuRv3PEMQOUKs7EuKXU8xLt pnpm seed:emulator
```

### Option 3: استخدم onSnapshot بدلاً من useEffect

عدّل الـ hook ليستخدم real-time listener:

```typescript
useEffect(() => {
  const user = auth.currentUser;
  if (!user) return;

  const walletRef = doc(db, 'wallets', user.uid);

  const unsub = onSnapshot(walletRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      setTokens(data.balance || 0);
      setPlan(data.plan || 'starter');
    }
  });

  return () => unsub();
}, []);
```

---

## 📊 Expected Console Output

عند فتح Dashboard (http://localhost:3030/en/f0)، يجب أن تشاهد:

```
✅ [firebaseClient] Connected to Firestore Emulator: 127.0.0.1:8080
✅ [firebaseClient] Connected to Auth Emulator: http://127.0.0.1:9099
[useDashboardStats] Wallet check for uid: upraBmuRv3PEMQOUKs7EuKXU8xLt
[useDashboardStats] Wallet exists? true
[useDashboardStats] Wallet data: {balance: 1000, plan: 'pro', createdAt: ..., updatedAt: ...}
[useDashboardStats] Setting tokens to: 1000
[useDashboardStats] Setting plan to: pro
```

---

## 🎯 Final Checklist

- [ ] Emulator شغّال على port 8080
- [ ] `NEXT_PUBLIC_USE_EMULATORS=1` في .env.local
- [ ] Next.js dev server شغّال على port 3030
- [ ] User logged in (dev@test.com)
- [ ] Wallet موجود في Firestore (`wallets/upraBmuRv3PEMQOUKs7EuKXU8xLt`)
- [ ] Console logs تظهر "Setting tokens to: 1000"
- [ ] Hard refresh للـ page

---

## 🆘 لو لسه المشكلة موجودة

**شارك السكرينشوت من:**
1. Developer Console logs
2. Firestore UI (wallets collection)
3. Network tab (requests to Firestore)

---

## 🔗 Quick Links

- **Dashboard:** http://localhost:3030/en/f0
- **Firestore UI:** http://localhost:4000/firestore
- **Auth UI:** http://localhost:4000/auth

---

**آخر تحديث:** 25 نوفمبر 2025
