# ⚡ إعداد صلاحيات Admin - Phase 49

## 🎯 خطوة بخطوة (3 دقائق)

### 1️⃣ افتح Auth Emulator

```
http://localhost:4000/auth
```

---

### 2️⃣ أنشئ مستخدم (إذا لم يكن موجود)

**في صفحة Auth:**
1. انقر على **"Add User"**
2. املأ البيانات:
   - **Email:** `admin@test.com`
   - **Password:** `admin123456`
3. انقر **"Save"**

---

### 3️⃣ أضف Custom Claims

**في قائمة المستخدمين:**
1. ابحث عن المستخدم الذي أنشأته
2. انقر على **"Edit Custom Claims"** (أيقونة القلم أو زر Edit)
3. الصق هذا JSON:

```json
{"admin": true, "role": "admin", "pro": true}
```

4. انقر **"Save"**
5. **مهم:** اعمل **Refresh** للصفحة

---

### 4️⃣ سجّل الدخول في التطبيق

**افتح:**
```
http://localhost:3000/login
```

**سجّل الدخول بـ:**
- **Email:** `admin@test.com`
- **Password:** `admin123456`

---

### 5️⃣ اختبر الوصول للـ Dashboard

**افتح:**
```
http://localhost:3000/ar/ops/incidents
```

**يجب أن:**
- ✅ تفتح الصفحة بدون redirect
- ✅ تشوف واجهة الـ Dashboard
- ✅ قد تكون فاضية (لأنه ما فيه incidents بعد)

---

## 🧪 الآن: أرسل Spike Test

### في Terminal، نفّذ:

```bash
# تأكد من URL الإيميلاتور
export NEXT_PUBLIC_CF_LOG_URL="http://127.0.0.1:5001/from-zero-84253/us-central1/log"

# أرسل 12 Error
for i in {1..12}; do
  curl -s -X POST "http://localhost:3000/api/log" \
    -H 'Content-Type: application/json' \
    -d "{\"level\":\"error\",\"service\":\"web\",\"code\":500,\"message\":\"Spike $i\",\"fingerprint\":\"ui-spike-1\"}" >/dev/null
done

echo "✅ تم إرسال 12 خطأ"
```

---

### انتظر 3 ثواني ثم افتح:

```
http://localhost:3000/ar/ops/incidents
```

**يجب أن تشوف:**
- 🟡 **Incident واحد**
- **Fingerprint:** `ui-spike-1`
- **Event Count:** `~12`
- **Severity:** `medium` (لون أصفر)
- **Status:** `open`

---

## 🔍 إذا لم يظهر شيء - خط الأنابيب

### الخطوة 1️⃣: تحقق من Events

**افتح:**
```
http://localhost:4000/firestore
```

**ابحث عن:**
- Collection: `ops_events`
- يجب أن يكون فيها **12 مستند على الأقل**

**✅ إذا وجدت ops_events:**
- الـ Log API شغال بشكل صحيح
- المشكلة في الـ Trigger

**❌ إذا لم تجد ops_events:**
- الـ Log Function لا تكتب في Firestore
- تحقق من Functions logs في Terminal

---

### الخطوة 2️⃣: تحقق من Incidents

**في نفس Firestore UI:**
- ابحث عن Collection: `ops_incidents`

**✅ إذا وجدت ops_incidents:**
- الـ Trigger شغال
- قد تكون المشكلة في صلاحيات Dashboard

**❌ إذا لم تجد ops_incidents:**
- الـ Trigger (`onEventWrite`) لم يعمل
- انتقل للخطوة 3

---

### الخطوة 3️⃣: إصلاح الـ Trigger

**تحقق من Exports في `functions/src/index.ts`:**

```bash
grep -E "export.*onEventWrite" functions/src/index.ts
```

**يجب أن تشوف:**
```typescript
export { onEventWrite } from './incidents/onEventWrite';
```

**إذا لم تجدها:**

```bash
# افتح functions/src/index.ts وأضف:
export { log } from './http/log';
export { onEventWrite } from './incidents/onEventWrite';
```

**ثم أعد البناء:**

```bash
cd functions && npm run build
```

---

### الخطوة 4️⃣: أعد تشغيل Emulators (إذا لزم الأمر)

```bash
# أوقف الـ Emulators
pkill -f "firebase emulators"

# أعد التشغيل
firebase emulators:start --only functions,firestore,auth
```

**ثم أعد Spike Test:**

```bash
for i in {1..12}; do
  curl -s -X POST "http://localhost:3000/api/log" \
    -H 'Content-Type: application/json' \
    -d "{\"level\":\"error\",\"service\":\"web\",\"code\":500,\"message\":\"Spike $i\",\"fingerprint\":\"ui-spike-2\"}" >/dev/null
done
```

---

## 🚨 مشاكل شائعة

### Problem 1: "Access Denied" في Dashboard

**السبب:**
- Custom claims لم تُطبّق
- لم تعمل refresh للـ token

**الحل:**
1. اعمل **Logout** من التطبيق
2. أعد تسجيل الدخول
3. افتح Dashboard مرة أخرى

---

### Problem 2: Dashboard فاضي رغم وجود ops_incidents

**السبب:**
- مشكلة في query الـ Dashboard
- Firestore rules تمنع القراءة

**الحل:**

```bash
# تحقق من Rules
cat firestore.rules | grep ops_incidents
```

يجب أن تسمح للـ admin:

```
match /ops_incidents/{id} {
  allow read: if request.auth != null && request.auth.token.admin == true;
}
```

---

### Problem 3: Redirect إلى /billing

**السبب:**
- Paywall/Entitlements تمنع الوصول
- `pro: true` غير موجود في claims

**الحل 1: أضف `pro` في Claims:**
```json
{"admin": true, "role": "admin", "pro": true}
```

**الحل 2: عطّل Paywall في .env.local:**
```bash
NEXT_PUBLIC_DISABLE_PAYWALL=1
```

**الحل 3: أضف Entitlements:**
```json
{
  "admin": true,
  "role": "admin",
  "pro": true,
  "entitlements": ["pro", "unlimited"]
}
```

---

## ✅ النتيجة المتوقعة

بعد تنفيذ كل الخطوات:

**في Dashboard:**
```
┌─────────────────────────────────────────┐
│ 🟡 ui-spike-1                           │
│ Service: web                            │
│ Count: 12 events                        │
│ Severity: medium                        │
│ First seen: منذ 30 ثانية                │
│ Status: open                            │
│                                         │
│ [Acknowledge] [Resolve]                 │
└─────────────────────────────────────────┘
```

**في Firestore:**
- `ops_events`: 12+ مستندات
- `ops_incidents`: 1 مستند على الأقل
- `ops_incident_updates`: 1+ تحديث

---

## 🎯 سكربت سريع (كل شيء في أمر واحد)

```bash
# اختصار لكل الخطوات:
bash -c '
  # أرسل 12 error
  for i in {1..12}; do
    curl -s -X POST "http://localhost:3000/api/log" \
      -H "Content-Type: application/json" \
      -d "{\"level\":\"error\",\"service\":\"web\",\"code\":500,\"message\":\"Spike $i\",\"fingerprint\":\"quick-test\"}" >/dev/null
  done

  # انتظر
  echo "⏳ انتظار 3 ثواني..."
  sleep 3

  # افتح Dashboard
  echo "✅ افتح Dashboard:"
  echo "   http://localhost:3000/ar/ops/incidents"

  # افتح Firestore
  echo ""
  echo "✅ أو تحقق من Firestore:"
  echo "   http://localhost:4000/firestore"
'
```

---

## 📚 المراجع السريعة

| الرابط | الوصف |
|--------|-------|
| http://localhost:4000/auth | Auth Emulator |
| http://localhost:4000/firestore | Firestore UI |
| http://localhost:3000/login | تسجيل دخول |
| http://localhost:3000/ar/ops/incidents | Dashboard عربي |
| http://localhost:3000/en/ops/incidents | Dashboard إنجليزي |
| http://localhost:3000/test-toast | صفحة اختبار |

---

**Phase 49 - Error Tracking Ready! 🚀**

**Next:** راجع [PHASE_49_COMPLETE_SUMMARY.md](PHASE_49_COMPLETE_SUMMARY.md) للدليل الكامل
