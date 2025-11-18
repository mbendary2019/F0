# 🚀 Deployment Guide - دليل النشر الشامل

دليل خطوة بخطوة لنشر F0 Agent على Vercel أو Firebase Hosting

---

## 📋 قبل البدء

### ✅ Pre-Deployment Checklist

- [ ] جميع الملفات محدّثة ومُختبرة محلياً
- [ ] `.env.local` محدّث وجاهز (لكن **لا تُرفعه لـ Git**)
- [ ] Firebase Console مُعدّ بالكامل
- [ ] Apple Developer Service ID مُعدّ
- [ ] جميع الاختبارات ناجحة
- [ ] لا توجد `console.log` غير ضرورية
- [ ] التوثيق محدّث

---

## 🌐 الخيار 1: النشر على Vercel

### 1.1 ربط المستودع بـ Vercel

#### أ. رفع المشروع إلى GitHub

```bash
# تهيئة Git (إذا لم يكن موجوداً)
git init

# إضافة .gitignore
echo ".env.local
.env
node_modules/
.next/
out/
jobs/
.DS_Store" > .gitignore

# Commit أول
git add .
git commit -m "Initial commit: F0 Agent with Firebase Auth"

# ربط بـ GitHub
git remote add origin https://github.com/username/f0-agent.git
git branch -M main
git push -u origin main
```

#### ب. ربط Vercel بالمستودع

1. افتح [Vercel Dashboard](https://vercel.com/dashboard)
2. اضغط **New Project**
3. اختر **Import Git Repository**
4. اختر مستودعك `f0-agent`
5. اضغط **Import**

### 1.2 إعداد Framework في Vercel

```
Framework Preset: Next.js
Root Directory: ./
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

### 1.3 إضافة Environment Variables

في Vercel Dashboard → Settings → Environment Variables:

#### Firebase Variables (مطلوبة)

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=yourproject
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123def456
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=yourproject.appspot.com
```

#### Apple Sign-In (اختياري - للسيرفر)

```bash
APPLE_TEAM_ID=ABC123XYZ
APPLE_KEY_ID=DEF456GHI
APPLE_SERVICE_ID=com.yourapp.web
```

#### Application Settings

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NODE_ENV=production
```

**⚠️ مهم:**
- اضغط على **All** أو **Production, Preview, Development** لكل متغير
- تأكد من نسخ القيم بالكامل (لا مسافات زائدة)

### 1.4 النشر

```bash
# Deploy تلقائي
# بمجرد الضغط على "Deploy" في Vercel، سيبدأ البناء

# أو عبر CLI
npm i -g vercel
vercel login
vercel --prod
```

### 1.5 تحديث Apple Service ID

بعد نشر المشروع على Vercel:

1. احصل على النطاق من Vercel (مثال: `your-app.vercel.app`)
2. افتح [Apple Developer Console](https://developer.apple.com/account/)
3. **Identifiers** → **Service IDs** → اختر Service ID
4. **Sign In with Apple** → **Configure**
5. أضف النطاق الجديد:
   ```
   Domains: your-app.vercel.app
   Return URLs: https://your-app.vercel.app/__/auth/handler
   ```

   **⚠️ ملاحظة:** قد تحتاج أيضاً لاستخدام Firebase redirect:
   ```
   Return URL: https://yourproject.firebaseapp.com/__/auth/handler
   ```

6. **Save** → **Done** → **Continue** → **Save**

### 1.6 تحديث Firebase Authorized Domains

1. افتح [Firebase Console](https://console.firebase.google.com/)
2. اختر مشروعك
3. **Authentication** → **Settings** → **Authorized domains**
4. اضغط **Add domain**
5. أضف: `your-app.vercel.app`
6. **Add**

### 1.7 التحقق من النشر

```bash
# افتح النطاق
https://your-app.vercel.app/auth

# اختبر Sign-In
# يجب أن يعمل Apple Sign-In بدون مشاكل
```

---

## 🔥 الخيار 2: النشر على Firebase Hosting

### 2.1 تثبيت Firebase Tools

```bash
npm install -g firebase-tools

# تسجيل الدخول
firebase login

# التحقق
firebase projects:list
```

### 2.2 تهيئة Firebase Hosting

```bash
# في جذر المشروع
firebase init hosting
```

#### الإجابات:

```
? What do you want to use as your public directory?
→ out  (أو .next للـ SSR)

? Configure as a single-page app (rewrite all urls to /index.html)?
→ Yes

? Set up automatic builds and deploys with GitHub?
→ No (أو Yes إذا أردت CI/CD تلقائي)

? File out/index.html already exists. Overwrite?
→ No
```

### 2.3 إعداد `firebase.json`

```json
{
  "hosting": {
    "public": "out",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains"
          }
        ]
      }
    ]
  }
}
```

### 2.4 إعداد Next.js للـ Static Export

في `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // إذا كنت تستخدم trailing slashes
  trailingSlash: true,
};

module.exports = nextConfig;
```

**⚠️ ملاحظة:** Static export لا يدعم:
- API Routes
- Server-side rendering (getServerSideProps)
- Incremental Static Regeneration

### 2.5 بناء المشروع

```bash
# بناء للإنتاج
npm run build

# تصدير Static files
npm run export
# أو إذا كان في package.json
npx next export
```

سيُنشأ مجلد `out/` يحتوي على الملفات الثابتة.

### 2.6 اختبار محلي (اختياري)

```bash
firebase serve --only hosting

# افتح: http://localhost:5000/auth
```

### 2.7 النشر

```bash
# نشر على Firebase Hosting
firebase deploy --only hosting

# أو نشر كامل (hosting + functions + firestore)
firebase deploy
```

### 2.8 التحقق من النشر

```bash
# افتح الرابط الناتج
https://yourproject.firebaseapp.com/auth

# أو إذا كان لديك custom domain
https://yourdomain.com/auth
```

---

## 🔧 الخيار 3: Custom Domain

### 3.1 على Vercel

1. **Vercel Dashboard** → **Settings** → **Domains**
2. اضغط **Add**
3. أدخل النطاق: `app.yourdomain.com`
4. اتبع التعليمات لإضافة:
   - **A Record** أو **CNAME** في DNS provider
5. انتظر التحقق (قد يستغرق دقائق)

### 3.2 على Firebase Hosting

```bash
firebase hosting:channel:deploy production --expires 30d

# أو استخدام custom domain من Console
```

1. **Firebase Console** → **Hosting** → **Add custom domain**
2. أدخل النطاق: `app.yourdomain.com`
3. أضف السجلات التالية في DNS:
   ```
   Type: A
   Name: @
   Value: [Firebase IP]

   Type: TXT
   Name: @
   Value: [Verification code]
   ```

---

## 🔒 الأمان في Production

### Security Headers (إضافية)

في `next.config.js`:

```javascript
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

### Environment Variables Security

```bash
# ✅ آمن - في Vercel/Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=xxx

# ❌ خطر - لا تضعها في NEXT_PUBLIC_*
STRIPE_SECRET_KEY=sk_live_xxx
APPLE_KEY_P8=xxx
```

---

## 📊 Monitoring & Analytics

### Google Analytics (اختياري)

```bash
# في .env.local (Vercel)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

في `src/app/layout.tsx`:

```tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
              `}
            </Script>
          </>
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Sentry (اختياري)

```bash
npm install @sentry/nextjs

# .env.local
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## 🧪 Post-Deployment Testing

### Checklist

- [ ] `/auth` صفحة تُحمّل بشكل صحيح
- [ ] Apple Sign-In يعمل (popup + redirect)
- [ ] Session يُحفظ بعد refresh
- [ ] Sign-out يعمل
- [ ] لا توجد أخطاء في Console
- [ ] SSL certificate صالح (HTTPS)
- [ ] Authorized domains محدّثة
- [ ] Performance مقبول (<3s load time)

### أدوات الاختبار

```bash
# Lighthouse
npm install -g lighthouse
lighthouse https://your-app.vercel.app/auth --view

# Security Headers
curl -I https://your-app.vercel.app

# SSL Check
openssl s_client -connect your-app.vercel.app:443
```

---

## 🔄 Continuous Deployment

### Vercel (Auto-deploy)

```bash
# كل push لـ main يُنشر تلقائياً
git add .
git commit -m "feat: add new feature"
git push origin main

# Vercel ستقوم بـ deploy تلقائياً
```

### GitHub Actions (Firebase)

في `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build && npm run export
        env:
          NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          # ... باقي المتغيرات

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: your-project-id
```

---

## 🐛 Troubleshooting

### المشكلة: Build failed on Vercel

```bash
# تحقق من logs في Vercel Dashboard
# غالباً السبب:
# 1. Missing environment variables
# 2. TypeScript errors
# 3. Missing dependencies
```

**الحل:**
```bash
# اختبر build محلياً
npm run build

# إذا نجح محلياً، تحقق من env vars في Vercel
```

### المشكلة: Apple Sign-In لا يعمل في Production

**الحل:**
1. تحقق من Authorized domains في Firebase
2. تحقق من Return URL في Apple Developer
3. انتظر 5-10 دقائق بعد التعديل
4. مسح cache المتصفح

### المشكلة: CORS errors

**الحل:**
```javascript
// في next.config.js
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        // أو حدد النطاقات المسموحة
      ],
    },
  ];
}
```

---

## ✅ Production Checklist النهائي

### قبل الإطلاق

- [ ] جميع Environment variables مُضافة
- [ ] Firebase authorized domains محدّثة
- [ ] Apple Service ID محدّث بنطاق الإنتاج
- [ ] SSL certificate صالح
- [ ] Security headers مُفعّلة
- [ ] Analytics/Monitoring مُفعّل
- [ ] Error tracking (Sentry) مُفعّل (اختياري)
- [ ] Performance optimization (<3s load)
- [ ] SEO metadata محدّث
- [ ] Favicon + assets محدّثة

### يوم الإطلاق

- [ ] Deployment ناجح
- [ ] Smoke tests كلها نجحت
- [ ] Monitoring نشط
- [ ] فريق الدعم جاهز
- [ ] Rollback plan جاهز

### بعد الإطلاق (أول أسبوع)

- [ ] مراقبة error rates
- [ ] تتبع user adoption
- [ ] جمع feedback
- [ ] معالجة critical issues
- [ ] تحسين بناءً على metrics

---

**🎉 Production Ready! مبروك النشر الناجح! 🚀**

للدعم: راجع [FIREBASE-CHECKLIST.md](FIREBASE-CHECKLIST.md) أو [QUICK-REFERENCE.md](QUICK-REFERENCE.md)

---

**Generated by F0 Agent 🤖**
