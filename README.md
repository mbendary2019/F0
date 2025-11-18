# 🤖 F0 Agent - AI Orchestration Platform

نظام متكامل لتوجيه وإدارة نماذج الذكاء الاصطناعي مع Firebase Authentication

## ⚡ التشغيل السريع

### الطريقة الأسهل

```bash
./RUN.sh
```

سيعرض خيارات:
1. **Electron** - تطبيق سطح المكتب
2. **Orchestrator only** - API فقط
3. **Both** - كلاهما معاً

### الطريقة اليدوية

```bash
# 1. إعداد البيئة
cp .env.template .env
cp .env.local.template .env.local
# عدّل الملفات وأضف API keys

# 2. تشغيل التطبيق
npm install
npm run dev
```

## 🎯 الميزات الرئيسية

### 🔐 Authentication
- 🍎 **Apple Sign-In** - تسجيل دخول آمن عبر Apple
- 🔥 **Firebase Auth** - إدارة المصادقة والجلسات
- 🔒 **Session Persistence** - حفظ الجلسة تلقائياً
- 🛡️ **Nonce Security** - حماية إضافية مع SHA-256

### 🧠 AI Orchestration
- 🤖 **Multi-Model** - GPT-5, Gemini, Claude
- 📋 **Command Queue** - تنفيذ متسلسل مع retry
- 🔧 **Cursor Integration** - تشغيل آمن للأوامر
- 📊 **Telemetry** - قياس الأداء والتكلفة

### 💳 Subscription & Billing (Sprint 3)
- 💰 **Stripe Checkout** - معالجة الاشتراكات
- 🏦 **Billing Portal** - إدارة الفوترة
- 🔒 **Entitlements Gate** - قفل الميزات المدفوعة
- 🪝 **Webhooks** - مزامنة تلقائية مع Firestore
- 📊 **Subscription Tiers** - Basic & Pro plans

## 📚 الوثائق الشاملة

### 🔐 Authentication
- [FIREBASE-APPLE-SETUP.md](FIREBASE-APPLE-SETUP.md) - دليل إعداد Apple Sign-In
- [FIREBASE-CHECKLIST.md](FIREBASE-CHECKLIST.md) - قائمة التحقق الكاملة
- [QUICK-REFERENCE.md](QUICK-REFERENCE.md) - مرجع سريع للمطورين

### 🤖 AI & Orchestration
- [QUICK-START.md](QUICK-START.md) - دليل التشغيل الشامل
- [MULTI-MODEL-USAGE.md](orchestrator/MULTI-MODEL-USAGE.md) - استخدام النماذج
- [COMMAND-QUEUE-USAGE.md](orchestrator/COMMAND-QUEUE-USAGE.md) - نظام الطابور
- [SUBSCRIPTION-GATE-EXAMPLE.md](orchestrator/SUBSCRIPTION-GATE-EXAMPLE.md) - قفل الاشتراكات

### 💳 Billing & Subscriptions
- [STRIPE-SETUP.md](STRIPE-SETUP.md) - إعداد Stripe الكامل
- [ENTITLEMENTS-RULES.md](ENTITLEMENTS-RULES.md) - قواعد Firestore والأمان

## 🧪 اختبار سريع

### Authentication

```bash
# افتح صفحة تسجيل الدخول
http://localhost:3000/auth
```

```typescript
// في الكود
import { signInWithAppleAuto } from '@/lib/appleProvider';
import { auth } from '@/lib/firebase';

const user = await signInWithAppleAuto(auth);
```

### AI Jobs

```javascript
// في Electron DevTools (Cmd+Option+I)
window.f0.addJob({
  id: 'test-' + Date.now(),
  type: 'gemini',
  llm: {
    kind: 'code',
    prompt: 'Write a function to validate emails'
  }
});
```

### Subscription & Billing

```bash
# افتح صفحة الأسعار
http://localhost:3000/pricing

# إدارة الاشتراك
http://localhost:3000/account/billing
```

```typescript
// استخدام الـ Hook
import { useEntitlements } from '@/hooks/useEntitlements';
import { ProButton } from '@/components/ProButton';

function MyFeature() {
  const entitlements = useEntitlements();

  return (
    <ProButton onClick={() => launchFeature()}>
      Launch Pro Feature
    </ProButton>
  );
}
```

## 📁 هيكل المشروع

```
from-zero-starter/
├── src/
│   ├── lib/
│   │   ├── firebase.ts              # Firebase config
│   │   └── appleProvider.ts         # Apple Sign-In
│   ├── providers/
│   │   └── AuthGate.tsx             # Auth context
│   ├── hooks/
│   │   └── useEntitlements.ts       # Subscription hook
│   ├── components/
│   │   ├── EntitlementGate.tsx      # Subscription gate
│   │   └── ProButton.tsx            # Pro feature button
│   └── app/
│       ├── auth/
│       │   └── page.tsx             # Auth UI
│       ├── pricing/
│       │   └── page.tsx             # Pricing plans
│       ├── account/billing/
│       │   └── page.tsx             # Billing dashboard
│       └── api/
│           ├── checkout/
│           │   └── route.ts         # Stripe checkout
│           └── billing-portal/
│               └── route.ts         # Billing portal
├── functions/                       # Firebase Functions
│   └── src/
│       └── index.ts                 # Stripe webhook
├── desktop/                         # Electron app
├── orchestrator/                    # Backend + AI
│   ├── src/
│   │   ├── commandQueue.ts         # Job queue
│   │   ├── providers.ts            # AI providers
│   │   ├── providerRouter.ts       # Smart routing
│   │   └── telemetry.ts            # Metrics
│   └── jobs/                       # Artifacts
├── public/
│   └── apple-logo.svg              # Assets
├── .env.template                   # Environment template
├── .env.local.template             # Firebase config template
├── firestore.rules                 # Security rules
├── firebase.json                   # Firebase config
└── RUN.sh                          # Quick start script
```

## 🚀 البدء السريع

### 1. إعداد Firebase

راجع [FIREBASE-APPLE-SETUP.md](FIREBASE-APPLE-SETUP.md) للإعداد الكامل

```bash
# نسخ قالب البيئة
cp .env.local.template .env.local

# تعديل .env.local بإعدادات Firebase
nano .env.local
```

### 2. إعداد AI Models

```bash
# نسخ قالب البيئة
cp .env.template .env

# إضافة API keys
nano .env
```

### 3. التشغيل

```bash
npm install
npm run dev
```

افتح: http://localhost:3000

## 🔐 الأمان

- ✅ Firebase Authentication مع Apple
- ✅ Nonce + SHA-256 hashing
- ✅ Session persistence آمن
- ✅ HTTPS only (enforced)
- ✅ Domain whitelisting
- ✅ Private keys محمية

## ✅ الميزات المكتملة

### Sprint 1 - Authentication
- ✅ Firebase Authentication
- ✅ Apple Sign-In
- ✅ Session Management
- ✅ Nonce Security

### Sprint 2 - AI Orchestration
- ✅ Multi-Model Support (GPT-5, Gemini, Claude)
- ✅ Command Queue System
- ✅ Telemetry & Metrics
- ✅ Cursor Integration

### Sprint 3 - Billing & Subscriptions
- ✅ Stripe Checkout Integration
- ✅ Billing Portal
- ✅ Webhook Handler (Firebase Functions)
- ✅ Entitlements Management
- ✅ Firestore Security Rules
- ✅ Subscription UI (Pricing & Billing pages)

## 🎯 الميزات القادمة

### Sprint 4 - MFA (Planned)
- [ ] SMS verification
- [ ] TOTP (Google Authenticator)
- [ ] Backup codes

### Sprint 5 - Passkeys (Planned)
- [ ] WebAuthn integration
- [ ] Biometric authentication
- [ ] Passkey management

## 📊 الإحصائيات

- 🔐 **Authentication:** Apple Sign-In + Firebase
- 🤖 **AI Models:** 3 (GPT-5, Gemini, Claude)
- 📋 **Job Queue:** Full implementation
- 📊 **Telemetry:** Real-time metrics
- 💳 **Billing:** Stripe integration (Checkout + Portal + Webhooks)
- 🔒 **Security:** Enterprise-grade with Firestore rules

## 🤝 المساهمة

راجع [FIREBASE-CHECKLIST.md](FIREBASE-CHECKLIST.md) للمتطلبات الكاملة

## 📄 الترخيص

MIT License

## 🙏 الشكر

- Firebase (Authentication)
- Apple (Sign-In with Apple)
- OpenAI (GPT-5)
- Google (Gemini)
- Anthropic (Claude)
- Electron

---

**بُني بواسطة F0 Agent 🤖**

للدعم: راجع [QUICK-REFERENCE.md](QUICK-REFERENCE.md) أو [FIREBASE-APPLE-SETUP.md](FIREBASE-APPLE-SETUP.md)