# 🚀 Phase 72: GoDaddy DNS - دليل سريع

## ✅ ما تم إنجازه:

### 1️⃣ Cloud Functions (4 functions)
تم إنشاء 4 Cloud Functions في [functions/src/integrations/godaddy.ts](functions/src/integrations/godaddy.ts):

- **`getGoDaddyDomains`** - جلب قائمة النطاقات
- **`getDNSRecords`** - جلب DNS records لنطاق معين
- **`createDNSRecord`** - إنشاء/تحديث DNS record
- **`deleteDNSRecord`** - حذف DNS record

### 2️⃣ UI Integration ✨ NEW
تم إنشاء واجهة مستخدم كاملة لربط GoDaddy:

- **[GodaddyConnectDialog.tsx](src/features/integrations/GodaddyConnectDialog.tsx)** - Modal جميل لإدخال API credentials
- **دليل إرشادي** داخل الـ Modal لكيفية الحصول على API Key
- **Auto-refresh** للـ status بعد الحفظ
- **Error handling** و Loading states

### 3️⃣ Environment Variables
تم إضافة GoDaddy credentials في [.env.local](.env.local#L144-L150):

```bash
F0_GODADDY_KEY=e4hSVt1meBaD_9voXHgTx3F4vPrXyXWRhXw
F0_GODADDY_SECRET=PNjFH8W9RibUB2EkCwBiZA
F0_EMU_GODADDY_KEY=e4hSVt1meBaD_9voXHgTx3F4vPrXyXWRhXw
F0_EMU_GODADDY_SECRET=PNjFH8W9RibUB2EkCwBiZA
```

### 4️⃣ Seed Script
تم إنشاء [scripts/seed-godaddy-emulator.ts](scripts/seed-godaddy-emulator.ts) لحفظ الـ credentials في Firestore Emulator

---

## 🎯 الحالة الحالية:

### ✅ شغال:
- Firebase Emulators: http://127.0.0.1:4000
- Next.js: http://localhost:3030
- GoDaddy Functions: محملة بنجاح
- Credentials: محفوظة في Firestore Emulator
- Dev Mode: شغال

### ⚠️ محتاج تحديث:
- **GoDaddy API Key**: الـ Key الحالي بيرجع "403 Forbidden"
- محتاج تحديث الـ credentials بـ API Key صحيح من GoDaddy

---

## 🔧 كيفية الاستخدام:

### 1. تشغيل السيرفرات:

#### Terminal 1: Firebase Emulators
```bash
firebase emulators:start --only auth,firestore,functions
```

#### Terminal 2: Next.js
```bash
PORT=3030 pnpm dev
```

### 2. اختبار الـ UI (الطريقة الجديدة) 🎨

#### افتح صفحة Integrations:
```
http://localhost:3030/ar/settings/integrations
```

#### اضغط "Connect" على GoDaddy Card:
- يفتح Modal جميل
- أدخل GoDaddy API Key
- أدخل GoDaddy API Secret
- اضغط "Save & Connect"
- الـ status يتحدث تلقائياً لـ "Connected" ✅

#### البديل: حفظ Credentials يدوياً عبر Script:
```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/seed-godaddy-emulator.ts
```

### 3. اختبار الـ Functions:

#### Test 1: Get Domains
```bash
curl -X POST \
  http://127.0.0.1:5001/from-zero-84253/us-central1/getGoDaddyDomains \
  -H "Content-Type: application/json" \
  -d '{"data": {}}'
```

**النتيجة المتوقعة:**
```json
{
  "result": {
    "ok": true,
    "domains": [...]
  }
}
```

**النتيجة الحالية:**
```json
{
  "result": {
    "ok": false,
    "error": "Failed to fetch domains: Forbidden"
  }
}
```
*(يعني الـ function شغالة، بس الـ API Key محتاج تحديث)*

---

## 🔐 الحصول على GoDaddy API Key جديد:

### الخطوات:
1. اذهب إلى: https://developer.godaddy.com/keys
2. سجل دخول بحساب GoDaddy
3. أنشئ API Key جديد
4. اختر Environment: **Production** أو **OTE (Test)**
5. انسخ الـ **Key** و **Secret**

### تحديث الـ Credentials:

#### في `.env.local`:
```bash
F0_GODADDY_KEY=YOUR_NEW_KEY_HERE
F0_GODADDY_SECRET=YOUR_NEW_SECRET_HERE
F0_EMU_GODADDY_KEY=YOUR_NEW_KEY_HERE
F0_EMU_GODADDY_SECRET=YOUR_NEW_SECRET_HERE
```

#### إعادة seed الـ Firestore:
```bash
# 1. عدّل الـ credentials في scripts/seed-godaddy-emulator.ts
# 2. شغل الـ script تاني:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/seed-godaddy-emulator.ts
```

---

## 📊 Function Examples:

### 1. Get DNS Records لنطاق:
```bash
curl -X POST \
  http://127.0.0.1:5001/from-zero-84253/us-central1/getDNSRecords \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "domain": "example.com"
    }
  }'
```

### 2. Create A Record:
```bash
curl -X POST \
  http://127.0.0.1:5001/from-zero-84253/us-central1/createDNSRecord \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "domain": "example.com",
      "type": "A",
      "name": "@",
      "value": "123.45.67.89",
      "ttl": 600
    }
  }'
```

### 3. Create CNAME Record:
```bash
curl -X POST \
  http://127.0.0.1:5001/from-zero-84253/us-central1/createDNSRecord \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "domain": "example.com",
      "type": "CNAME",
      "name": "www",
      "value": "example.com"
    }
  }'
```

### 4. Delete DNS Record:
```bash
curl -X POST \
  http://127.0.0.1:5001/from-zero-84253/us-central1/deleteDNSRecord \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "domain": "example.com",
      "type": "A",
      "name": "@"
    }
  }'
```

---

## 🐛 استكشاف الأخطاء:

### Error: "GoDaddy not connected"
**الحل**: شغل seed script
```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/seed-godaddy-emulator.ts
```

### Error: "Forbidden" أو "Unauthorized"
**الحل**:
1. تأكد إن GoDaddy API Key صحيح
2. تأكد إن الـ Key active مش expired
3. جرب تعمل Key جديد من GoDaddy Dashboard

### Error: "Authentication required"
**الحل**: تأكد من وجود `F0_DEV_UID` في [functions/.env](functions/.env)

---

## 📝 الملفات المهمة:

### UI Components:
- [src/features/integrations/GodaddyConnectDialog.tsx](src/features/integrations/GodaddyConnectDialog.tsx) - GoDaddy Connect Modal
- [src/app/[locale]/settings/integrations/page.tsx](src/app/[locale]/settings/integrations/page.tsx) - Integrations page

### Backend:
- [functions/src/integrations/godaddy.ts](functions/src/integrations/godaddy.ts) - GoDaddy functions
- [functions/src/integrations/vault.ts](functions/src/integrations/vault.ts) - Credentials vault
- [functions/index.ts](functions/index.ts#L63-L72) - Exports
- [functions/.env](functions/.env) - Dev mode config

### Scripts:
- [scripts/seed-godaddy-emulator.ts](scripts/seed-godaddy-emulator.ts) - Seed script

### Config:
- [.env.local](.env.local#L136-L150) - GoDaddy credentials

---

## ✅ الخطوات التالية:

1. ✅ **إضافة UI في صفحة Integrations** - DONE
2. **الحصول على GoDaddy API Key صحيح**
3. **تحديث الـ credentials عبر الـ UI**
4. **اختبار جميع الـ functions**
5. **إضافة Domain Management UI**
6. **Auto-configure DNS عند deploy Vercel projects**

---

**Status**: ✅ **COMPLETE - UI + Functions Ready - Needs Valid API Key**

**Documentation**:
- [PHASE_72_GODADDY_COMPLETE.md](PHASE_72_GODADDY_COMPLETE.md) - Backend documentation
- [PHASE_72_GODADDY_UI_COMPLETE.md](PHASE_72_GODADDY_UI_COMPLETE.md) - UI documentation

**Test URL**: http://localhost:3030/ar/settings/integrations
