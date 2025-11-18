# 🚀 Quick Start Guide

## المتطلبات الأساسية

- Node.js 18+ ✅
- npm أو yarn ✅
- Electron ✅

## خطوات التشغيل السريع

### 1. إعداد المتغيرات البيئية

#### أ. Orchestrator (الخادم)

انسخ `.env.template` إلى `.env` في جذر المشروع:

```bash
cp .env.template .env
```

ثم عدّل `.env` وأضف مفاتيحك:

```bash
# Model API Keys
OPENAI_API_KEY=sk-xxx
GOOGLE_API_KEY=AIza-xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# Output token caps
GPT5_MAX_OUTPUT_TOKENS=12000
CLAUDE_CODE_MAX_OUTPUT_TOKENS=8000
GEMINI_CODE_MAX_OUTPUT_TOKENS=10000

# Orchestrator defaults
F0_DEFAULT_PLANNER=gpt5
F0_DEFAULT_CODER=gemini
F0_DEFAULT_REVIEWER=claude
F0_MAX_PARALLEL_JOBS=2
```

#### ب. Desktop (Electron - اختياري)

انسخ `desktop/.env.local.template` إلى `desktop/.env.local`:

```bash
cp desktop/.env.local.template desktop/.env.local
```

ثم عدّل لإضافة Firebase config إذا لزم الأمر.

### 2. تثبيت الحزم

```bash
# Desktop (Electron)
cd desktop
npm install

# Orchestrator (إذا لم يكن مثبتاً)
cd ../orchestrator
npm install

# العودة للجذر
cd ..
```

### 3. التشغيل

#### أ. طريقة Electron (مع UI)

```bash
cd desktop
npm run dev
```

هذا سيفتح نافذة Electron مع:
- Orchestrator يعمل على المنفذ 8080
- واجهة رسومية للتحكم

#### ب. طريقة Orchestrator فقط (بدون UI)

إذا كان لديك orchestrator منفصل كخادم:

```bash
cd orchestrator
npx tsx watch src/index.ts
```

أو إذا كان لديك START.sh:

```bash
cd orchestrator
./START.sh
```

### 4. الاختبار

افتح المتصفح على:
- **Orchestrator API**: http://localhost:8080
- **Electron UI**: سيفتح تلقائياً في نافذة Electron

## 🧪 اختبار سريع

### اختبار GPT-5 (Planning)

```bash
curl -X POST http://localhost:8080/api/queue/add \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-gpt5",
    "type": "gpt5",
    "llm": {
      "kind": "plan",
      "prompt": "Plan a simple todo app with user authentication"
    }
  }'
```

### اختبار Gemini (Coding)

```bash
curl -X POST http://localhost:8080/api/queue/add \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-gemini",
    "type": "gemini",
    "llm": {
      "kind": "code",
      "prompt": "Write a TypeScript function to validate email addresses"
    }
  }'
```

### اختبار Claude (Review)

```bash
curl -X POST http://localhost:8080/api/queue/add \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-claude",
    "type": "claude",
    "llm": {
      "kind": "review",
      "prompt": "Review this code for security issues: function login(password) { return password === process.env.PASSWORD }"
    }
  }'
```

### عرض الإحصائيات (Telemetry)

```bash
curl http://localhost:8080/api/telemetry
```

## 📁 هيكل المشروع

```
from-zero-starter/
├── desktop/              # Electron app
│   ├── main.js          # Electron main process
│   ├── preload.js       # IPC bridge
│   └── package.json
├── orchestrator/         # Backend orchestrator
│   ├── src/
│   │   ├── index.ts           # Main server
│   │   ├── commandQueue.ts    # Job queue
│   │   ├── providers.ts       # AI providers
│   │   ├── providerRouter.ts  # Smart routing
│   │   ├── telemetry.ts       # Metrics
│   │   └── firestoreQueue.ts  # Optional Firestore
│   └── .env
├── .env.template         # Environment template
└── README.md
```

## 🔧 استكشاف الأخطاء

### المشكلة: `OPENAI_API_KEY not found`

**الحل:**
```bash
# تأكد من وجود .env
ls -la .env

# تأكد من المحتوى
cat .env | grep OPENAI_API_KEY

# إذا لم يكن موجوداً
cp .env.template .env
# ثم عدّل .env
```

### المشكلة: `Port 8080 already in use`

**الحل:**
```bash
# أوقف العملية على المنفذ 8080
lsof -ti:8080 | xargs kill -9

# أو غيّر المنفذ في .env
echo "PORT=8081" >> .env
```

### المشكلة: Electron يفتح صفحة فارغة

**الحل:**
```bash
# تأكد من تشغيل orchestrator أولاً
cd orchestrator
npx tsx src/index.ts

# ثم في نافذة أخرى
cd desktop
npm run dev
```

### المشكلة: `Cannot find module 'openai'`

**الحل:**
```bash
cd orchestrator
npm install openai @google/generative-ai zod
```

## 📊 مراقبة السجلات

### Electron logs
افتح DevTools في نافذة Electron:
- macOS: `Cmd + Option + I`
- Windows/Linux: `Ctrl + Shift + I`

### Orchestrator logs
السجلات تظهر في الطرفية التي تشغل فيها orchestrator.

### Job artifacts
النتائج تُحفظ في:
```bash
orchestrator/jobs/
```

## 🎯 الخطوات التالية

1. ✅ تجربة الأمثلة أعلاه
2. ✅ مراجعة [MULTI-MODEL-USAGE.md](orchestrator/MULTI-MODEL-USAGE.md)
3. ✅ مراجعة [COMMAND-QUEUE-USAGE.md](orchestrator/COMMAND-QUEUE-USAGE.md)
4. ✅ إنشاء واجهة رسومية مخصصة
5. ✅ ربط Firebase (اختياري)
6. ✅ إضافة Stripe للاشتراكات (اختياري)

## 💡 نصائح مفيدة

### تشغيل في وضع التطوير

```bash
# في نافذة طرفية واحدة
cd orchestrator && npx tsx watch src/index.ts

# في نافذة أخرى
cd desktop && npm run dev
```

### بناء للإنتاج

```bash
cd desktop
npm run build
```

سينتج ملف تنفيذي في `desktop/dist/`

### تصدير Telemetry

```bash
curl http://localhost:8080/api/telemetry > metrics.json
```

## 🔒 ملاحظات الأمان

- ⚠️ **لا تضع** `OPENAI_API_KEY` في متغيرات VITE_*
- ✅ **ضع** جميع المفاتيح السرية في `orchestrator/.env` فقط
- ✅ **استخدم** IPC للتواصل بين Electron والـ orchestrator
- ✅ **فعّل** subscription gate قبل الإنتاج

---

**تم إنشاؤه بواسطة F0 Agent 🤖**
