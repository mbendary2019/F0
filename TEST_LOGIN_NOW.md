# 🧪 اختبار Login - خطوة بخطوة

## ✅ التأكد من كل شيء

---

## الخطوة 1: تأكيد ملف Login صحيح

### **تحقق من الملف:**

افتح: `src/app/login/page.tsx`

**يجب أن يكون أول سطرين:**
```typescript
"use client";
import { auth } from "@/lib/firebaseClient";  // ✅ NOT @/lib/firebase
```

✅ **تم التأكد:** الملف صحيح الآن!

---

## الخطوة 2: امسح Browser Cache تماماً

### **Chrome:**

1. افتح DevTools (F12)
2. **Application** tab
3. **Storage** → **Clear site data**
4. اختر الكل
5. Click "Clear site data"

### **أو:**

- Right-click على Reload button
- **"Empty Cache and Hard Reload"**

### **ثم:**

- اغلق جميع tabs لـ localhost:3000
- افتح tab جديد

---

## الخطوة 3: افتح صفحة Login

```
http://localhost:3000/login
```

**لا تسجل دخول بعد!**

---

## الخطوة 4: افتح Console واختبر

### **اضغط F12 → Console tab**

---

### **Test 1: تحقق من authDomain**

الصق في Console:

```javascript
import('firebase/auth').then(({ getAuth }) => {
  const a = getAuth();
  console.log('authDomain=', a.config?.authDomain);
  console.log('projectId=', a.config?.projectId);
});
```

**Expected Result:**
```
authDomain= local-dev
projectId= from-zero-84253
```

✅ إذا شفت `local-dev` → جيد!
❌ إذا شفت `.firebaseapp.com` → لا يزال متصل بـ production

---

### **Test 2: تحقق من Emulator Reachability**

الصق في Console:

```javascript
fetch('http://127.0.0.1:9099/emulator/v1/projects/from-zero-84253/config')
  .then(r => r.json())
  .then(() => console.log('✅ Auth Emulator reachable'))
  .catch(e => console.error('❌ Not reachable:', e));
```

**Expected Result:**
```
✅ Auth Emulator reachable
```

---

### **Test 3: اختبر Login من Console مباشرة**

الصق في Console:

```javascript
import('firebase/auth').then(({ getAuth, signInWithEmailAndPassword }) => {
  signInWithEmailAndPassword(getAuth(), "admin@test.com", "admin123456")
    .then(u => console.log('✅ Signed in successfully! UID:', u.user.uid))
    .catch(e => console.error('❌ Error:', e.code, e.message));
});
```

**Possible Results:**

#### **✅ Success:**
```
✅ Signed in successfully! UID: 501
```

→ **يعني:** SDK شغال، المشكلة في form handler

#### **❌ Error: auth/invalid-credential**
```
❌ Error: auth/invalid-credential
```

→ **يعني:** لا يزال متصل بـ production
→ **الحل:** أعد تشغيل Next.js وامسح cache مرة أخرى

#### **❌ Error: auth/user-not-found**
```
❌ Error: auth/user-not-found
```

→ **يعني:** متصل بالـ emulator لكن المستخدم غير موجود
→ **الحل:** أنشئ المستخدم في Auth UI

---

## الخطوة 5: راقب Network Requests

### **1. افتح DevTools → Network tab**

### **2. في الفلتر اكتب:**
```
identitytoolkit
```

أو:
```
emulator
```

### **3. الآن اضغط "Sign in" في الفورم**

**يجب أن تشوف:**

#### **✅ إذا متصل بالـ Emulator:**
```
POST http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key
Status: 200 OK
```

#### **❌ إذا متصل بـ Production:**
```
POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIza...
Status: 400 Bad Request
```

---

## الخطوة 6: إذا نجح Console Test لكن الفورم فشل

**يعني:** SDK شغال، لكن Form Handler فيه مشكلة

### **افتح Console وشوف الـ errors:**

```javascript
// راقب أي error يطلع
window.addEventListener('error', e => console.error('Global Error:', e));
```

### **تحقق من Form Handler:**

في `src/app/login/page.tsx` السطر 24:

```typescript
const cred = await signInWithEmailAndPassword(auth, email, pass);
```

**تأكد من:**
- `auth` مُستورد من `@/lib/firebaseClient`
- لا يوجد `preventDefault()` مفقود
- الـ email و password صحيحين

---

## الخطوة 7: أضف Custom Claims (إذا Login نجح)

### **افتح:**
```
http://127.0.0.1:4000/auth
```

### **ابحث عن: admin@test.com**

### **Edit Custom Claims:**
```json
{"admin": true, "role": "admin", "pro": true}
```

### **Save**

### **ثم:**
- Logout من التطبيق
- Login مرة أخرى

---

## الخطوة 8: اختبر Dashboard

### **افتح:**
```
http://localhost:3000/ar/ops/incidents
```

**يجب أن:**
- ✅ يفتح بدون redirect
- ✅ لا يوجد "Access Denied"

---

## 🔍 Troubleshooting حسب النتيجة:

### **Scenario 1: Test 3 نجح من Console لكن Form فشل**

**المشكلة:** Form handler

**الحل:**

1. تحقق من `src/app/login/page.tsx` السطر 4:
   ```typescript
   import { auth } from "@/lib/firebaseClient"; // يجب أن يكون هذا
   ```

2. تحقق من Console errors
3. تحقق من Network tab - يجب أن يضرب 127.0.0.1:9099

---

### **Scenario 2: Test 3 فشل بـ auth/invalid-credential**

**المشكلة:** SDK لا يزال متصل بـ production

**الحل:**

1. **تحقق من logs في Console:**
   ```
   يجب أن تشوف:
   ✅ [firebaseClient] Connected to Auth Emulator
   ```

2. **إذا لم تشاهده:**
   ```bash
   # أعد تشغيل Next.js
   pkill -f "next dev"
   npm run dev
   ```

3. **امسح cache مرة أخرى**
4. **أعد Test 1 و Test 3**

---

### **Scenario 3: Test 2 فشل (Emulator not reachable)**

**المشكلة:** Firewall أو الـ emulator غير شغال

**الحل:**

1. **تحقق من Emulators:**
   ```bash
   lsof -ti:9099
   ```

   إذا empty:
   ```bash
   firebase emulators:start --only auth,firestore,functions,ui
   ```

2. **تحقق من Firewall:**
   - System Preferences → Security → Firewall
   - Allow connections على port 9099

3. **جرب localhost بدلاً من 127.0.0.1:**
   في Console:
   ```javascript
   fetch('http://localhost:9099/emulator/v1/projects/from-zero-84253/config')
     .then(r => r.json()).then(console.log);
   ```

---

### **Scenario 4: Test 3 فشل بـ auth/user-not-found**

**المشكلة:** المستخدم غير موجود في emulator

**الحل:**

```bash
bash create-admin-user.sh
```

أو يدوياً:
```bash
curl -X POST \
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.com","password":"admin123456","returnSecureToken":true}'
```

---

## 📊 الخطوات بالترتيب (سريع):

```
1. ✅ تحقق من import في login page
2. 🧹 امسح Browser Cache
3. 🌐 افتح http://localhost:3000/login
4. 🔍 Test 1: authDomain (يجب أن يكون local-dev)
5. 🔍 Test 2: Emulator reachable
6. 🧪 Test 3: Console login (signInWithEmailAndPassword)
7. 📡 راقب Network tab
8. 🔐 أضف Custom Claims
9. 📊 اختبر Dashboard
```

---

## 🎯 النتيجة المتوقعة:

### **في Console:**
```
✅ [firebaseClient] Connected to Auth Emulator
authDomain= local-dev
✅ Auth Emulator reachable
✅ Signed in successfully! UID: 501
```

### **في Network:**
```
POST http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword
Status: 200 OK
```

### **في Form:**
```
✓ Signed in successfully! Redirecting...
```

---

## 🚀 ابدأ الاختبار الآن!

**الخطوة 1:** امسح Cache
**الخطوة 2:** افتح http://localhost:3000/login
**الخطوة 3:** افتح Console (F12)
**الخطوة 4:** نفّذ Test 1, 2, 3

**بالتوفيق! 🎯**
