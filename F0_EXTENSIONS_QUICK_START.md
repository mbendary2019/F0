# F0 Extensions - دليل البدء السريع 🚀

## التثبيت والإعداد ✅

جميع المكونات مثبتة ومُعدّة مسبقًا:
- ✅ JSON Schema Validator (Ajv)
- ✅ Sandbox System
- ✅ Extension Runners (HTTP & CLI)
- ✅ App Check Integration
- ✅ Test Scripts

## الاختبار السريع

### 1. اختبار شامل لجميع Extensions
```bash
./scripts/test-all-extensions.sh
```

### 2. اختبار مانيفست محدد
```bash
# Firebase
pnpm tsx scripts/ext-validate.ts f0/extensions/examples/firebase.deploy.json

# Stripe
pnpm tsx scripts/ext-validate.ts f0/extensions/examples/stripe.billing.json

# HTTP Test
pnpm tsx scripts/ext-validate.ts f0/extensions/examples/http.test.json
```

### 3. اختبار Sandbox
```bash
pnpm tsx scripts/sandbox-simple-test.ts
```

## تشغيل التطبيق

### Terminal 1: Next.js Web App
```bash
npm run dev
```
يعمل على: [http://localhost:3000](http://localhost:3000)

### Terminal 2: Orchestrator (يعمل حالياً)
```bash
cd orchestrator && pnpm dev
```
يعمل على: [http://localhost:8080](http://localhost:8080)

تحقق من الحالة:
```bash
curl http://localhost:8080/readyz
# Response: {"ok":true,"ts":...}
```

## App Check - التحقق من التكامل

### 1. تحقق من المتغيرات
ملف [.env.local](/.env.local):
```bash
NEXT_PUBLIC_APPCHECK_SITE_KEY=6Lf0zuYrAAAAAIcaoPPh6pq3jvZdPHpqy0AoFbN5
NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN=true
```

### 2. افتح التطبيق
افتح [http://localhost:3000](http://localhost:3000) في المتصفح

### 3. تحقق من Firebase Console
1. اذهب إلى [Firebase Console](https://console.firebase.google.com)
2. اختر المشروع: `from-zero-84253`
3. App Check → Monitoring
4. يجب أن ترى Requests خلال دقائق

### 4. اختبر Cloud Function
في console المتصفح:
```javascript
// Test heartbeat function
const result = await fetch('http://localhost:8080/api/heartbeat');
console.log(await result.json());
```

## إنشاء Extension جديد

### 1. أنشئ Manifest JSON
```json
{
  "name": "my-extension",
  "displayName": "My Extension",
  "version": "1.0.0",
  "provider": "custom",
  "description": "My custom extension",
  "capabilities": ["deploy"],
  "runner": {
    "type": "http",
    "url": "https://api.example.com/endpoint",
    "method": "POST"
  }
}
```

### 2. تحقق من Validation
```bash
pnpm tsx scripts/ext-validate.ts path/to/my-extension.json
```

### 3. أضف Inputs (اختياري)
```json
{
  ...
  "inputs": {
    "apiKey": {
      "type": "secret",
      "required": true,
      "description": "API Key"
    },
    "region": {
      "type": "enum",
      "enum": ["us", "eu", "asia"],
      "default": "us"
    }
  }
}
```

### 4. أضف Security Settings
```json
{
  ...
  "security": {
    "scopes": ["deploy"],
    "whitelist": ["npm", "git"],
    "dangerous": false
  }
}
```

## الأوامر المفيدة

### اختبار
```bash
# All tests
./scripts/test-all-extensions.sh

# Validate specific manifest
pnpm tsx scripts/ext-validate.ts [path]

# Test sandbox
pnpm tsx scripts/sandbox-simple-test.ts
```

### التطوير
```bash
# Start web app
npm run dev

# Start orchestrator
cd orchestrator && pnpm dev

# Check orchestrator health
curl http://localhost:8080/readyz
```

### Build
```bash
# Build web app
npm run build

# Build orchestrator
cd orchestrator && pnpm build
```

## الملفات الرئيسية

### Extensions Core
- [orchestrator/src/extensions/index.ts](orchestrator/src/extensions/index.ts)
- [orchestrator/src/extensions/validators/jsonschema.ts](orchestrator/src/extensions/validators/jsonschema.ts)
- [orchestrator/src/extensions/sandbox.ts](orchestrator/src/extensions/sandbox.ts)

### Firebase Integration
- [src/lib/firebaseClient.ts](src/lib/firebaseClient.ts) - Client-side
- [src/server/firebaseAdmin.ts](src/server/firebaseAdmin.ts) - Server-side

### Environment
- [.env.local](/.env.local) - Local environment variables

## الميزات الأمنية

### ✅ Whitelist System
فقط الأوامر المصرح بها

### ✅ Input Validation
Type checking + Required fields

### ✅ Secret Management
Secrets منفصلة ومحمية

### ✅ Sandbox Isolation
Temp directory + Timeout

### ✅ App Check
reCAPTCHA Enterprise protection

## الدعم

### التوثيق الكامل
راجع [F0_EXTENSIONS_TESTING_COMPLETE.md](F0_EXTENSIONS_TESTING_COMPLETE.md)

### المشاكل الشائعة

**Orchestrator لا يعمل:**
```bash
cd orchestrator
pnpm install
pnpm dev
```

**App Check لا يعمل:**
1. تأكد من `.env.local` يحتوي على المفاتيح
2. أعد تشغيل `npm run dev`
3. افتح المتصفح في وضع incognito

**Validation تفشل:**
تحقق من JSON syntax:
```bash
cat your-manifest.json | jq .
```

## النتيجة

✅ **جميع الاختبارات تعمل**
✅ **Orchestrator يعمل على :8080**
✅ **App Check مُعدّ ومُفعّل**
✅ **3 Extension examples جاهزة**

**جاهز للاستخدام!** 🎉

---

للمزيد من التفاصيل، راجع:
- [F0_EXTENSIONS_TESTING_COMPLETE.md](F0_EXTENSIONS_TESTING_COMPLETE.md)
- [APP_CHECK_SETUP.md](APP_CHECK_SETUP.md)
