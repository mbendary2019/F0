#!/usr/bin/env node

/**
 * سكريبت بذر البيانات الشامل
 * يضيف جميع البيانات الأولية المطلوبة للمشروع
 *
 * الاستخدام:
 *   FIREBASE_SERVICE_ACCOUNT_FILE=/path/to/service-account.json node scripts/seed-all.js
 *   أو (للمحاكي المحلي):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/seed-all.js
 */

const admin = require('firebase-admin');

// تهيئة Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_FILE);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ تم الاتصال بـ Firebase Production');
  } else if (process.env.FIRESTORE_EMULATOR_HOST) {
    admin.initializeApp({ projectId: 'demo-project' });
    console.log('✅ تم الاتصال بـ Firebase Emulator');
  } else {
    admin.initializeApp();
    console.log('✅ تم الاتصال بـ Firebase (Application Default Credentials)');
  }
}

const db = admin.firestore();

// 1️⃣ إعدادات الهوية البصرية
const branding = {
  id: 'prod',
  appName: 'From Zero',
  appNameAr: 'من الصفر',
  logo: '/logo.png',
  primaryColor: '#2563eb',
  accentColor: '#10b981',
  theme: 'light',
  supportEmail: 'support@fromzero.app',
  supportUrl: 'https://fromzero.app/support',
  socialLinks: {
    twitter: 'https://twitter.com/fromzero',
    github: 'https://github.com/fromzero',
    discord: 'https://discord.gg/fromzero',
  },
  features: {
    auth: true,
    marketplace: true,
    billing: true,
    analytics: true,
    aiInsights: true,
  },
  locale: {
    default: 'ar',
    supported: ['ar', 'en'],
  },
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

// 2️⃣ خطط الفوترة
const billingPlans = [
  {
    id: 'trial',
    title: 'تجريبي',
    titleEn: 'Trial',
    price: 0,
    interval: 'month',
    stripePriceId: '',
    features: [
      '500 استدعاء يوميًا',
      'الدعم الأساسي',
      'الوصول للمميزات المجانية',
    ],
    featuresEn: [
      '500 daily API calls',
      'Basic support',
      'Access to free features',
    ],
    limits: {
      dailyQuota: 500,
      marketplacePaid: false,
      maxProjects: 1,
      maxTeamMembers: 1,
    },
    entitlements: [],
    popular: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'starter',
    title: 'المبتدئ',
    titleEn: 'Starter',
    price: 9,
    interval: 'month',
    stripePriceId: process.env.STRIPE_PRICE_STARTER || 'price_starter_changeme',
    features: [
      '5,000 استدعاء يوميًا',
      'دعم بالأولوية',
      '3 مشاريع',
      '5 أعضاء فريق',
    ],
    featuresEn: [
      '5,000 daily API calls',
      'Priority support',
      '3 projects',
      '5 team members',
    ],
    limits: {
      dailyQuota: 5000,
      marketplacePaid: false,
      maxProjects: 3,
      maxTeamMembers: 5,
    },
    entitlements: ['priority_support'],
    popular: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'pro',
    title: 'المحترف',
    titleEn: 'Pro',
    price: 29,
    interval: 'month',
    stripePriceId: process.env.STRIPE_PRICE_PRO || 'price_pro_changeme',
    features: [
      '50,000 استدعاء يوميًا',
      'الوصول للمتجر المدفوع',
      'تقارير متقدمة',
      'هوية مخصصة',
      'مشاريع غير محدودة',
      '20 عضو فريق',
    ],
    featuresEn: [
      '50,000 daily API calls',
      'Paid marketplace access',
      'Advanced analytics',
      'Custom branding',
      'Unlimited projects',
      '20 team members',
    ],
    limits: {
      dailyQuota: 50000,
      marketplacePaid: true,
      maxProjects: -1, // unlimited
      maxTeamMembers: 20,
    },
    entitlements: [
      'priority_support',
      'marketplace_paid',
      'advanced_analytics',
      'custom_branding',
    ],
    popular: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

// 3️⃣ عناصر المتجر المجانية
const marketplaceItems = [
  {
    id: 'basic-auth',
    title: 'المصادقة الأساسية',
    titleEn: 'Basic Authentication',
    description: 'نظام مصادقة شامل مع email/password و OAuth',
    descriptionEn: 'Complete authentication system with email/password and OAuth',
    category: 'auth',
    price: 0,
    requiresPaid: false,
    icon: '🔐',
    verified: true,
    downloads: 0,
    rating: 5.0,
    ratingCount: 0,
    tags: ['auth', 'security', 'oauth'],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'basic-analytics',
    title: 'تحليلات أساسية',
    titleEn: 'Basic Analytics',
    description: 'لوحة تحكم تحليلية بسيطة لتتبع المستخدمين والأحداث',
    descriptionEn: 'Simple analytics dashboard to track users and events',
    category: 'analytics',
    price: 0,
    requiresPaid: false,
    icon: '📊',
    verified: true,
    downloads: 0,
    rating: 4.8,
    ratingCount: 0,
    tags: ['analytics', 'metrics', 'dashboard'],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'notification-basic',
    title: 'إشعارات أساسية',
    titleEn: 'Basic Notifications',
    description: 'نظام إشعارات بسيط داخل التطبيق',
    descriptionEn: 'Simple in-app notification system',
    category: 'communication',
    price: 0,
    requiresPaid: false,
    icon: '🔔',
    verified: true,
    downloads: 0,
    rating: 4.5,
    ratingCount: 0,
    tags: ['notifications', 'alerts', 'communication'],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

// 4️⃣ عناصر المتجر المدفوعة
const paidMarketplaceItems = [
  {
    id: 'analytics-pro',
    title: 'تحليلات احترافية',
    titleEn: 'Analytics Pro',
    description: 'لوحة تحليلات متقدمة مع تقارير مخصصة وتنبؤات AI',
    descriptionEn: 'Advanced analytics dashboard with custom reports and AI predictions',
    category: 'analytics',
    price: 0, // مشمول في الخطة
    requiresPaid: true,
    entitlement: 'advanced_analytics',
    icon: '📊',
    verified: true,
    downloads: 0,
    rating: 5.0,
    ratingCount: 0,
    tags: ['analytics', 'ai', 'reports', 'premium'],
    features: [
      'تقارير مخصصة',
      'تنبؤات AI',
      'تصدير البيانات',
      'تحليل في الوقت الفعلي',
    ],
    featuresEn: [
      'Custom reports',
      'AI predictions',
      'Data export',
      'Real-time analysis',
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'custom-branding-pack',
    title: 'حزمة الهوية المخصصة',
    titleEn: 'Custom Branding Pack',
    description: 'خصص التطبيق بهويتك البصرية الكاملة',
    descriptionEn: 'White-label your instance with custom branding',
    category: 'branding',
    price: 0,
    requiresPaid: true,
    entitlement: 'custom_branding',
    icon: '🎨',
    verified: true,
    downloads: 0,
    rating: 5.0,
    ratingCount: 0,
    tags: ['branding', 'customization', 'white-label', 'premium'],
    features: [
      'شعار مخصص',
      'ألوان مخصصة',
      'نطاق مخصص',
      'رسائل بريد مخصصة',
    ],
    featuresEn: [
      'Custom logo',
      'Custom colors',
      'Custom domain',
      'Custom email templates',
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

// 5️⃣ إعدادات النظام
const systemSettings = {
  id: 'global',
  maintenance: false,
  maintenanceMessage: {
    ar: 'النظام تحت الصيانة، يرجى المحاولة لاحقاً',
    en: 'System under maintenance, please try again later',
  },
  features: {
    auth: true,
    marketplace: true,
    billing: true,
    analytics: true,
    aiInsights: true,
    subscriptions: true,
    teams: false,
  },
  limits: {
    maxFreeProjects: 1,
    maxUploadSizeMB: 10,
    sessionTimeoutMinutes: 60,
  },
  notifications: {
    email: true,
    push: false,
    inApp: true,
  },
  integrations: {
    stripe: {
      enabled: true,
      testMode: process.env.NODE_ENV !== 'production',
    },
    analytics: {
      enabled: true,
    },
  },
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

// دوال البذر
async function seedBranding() {
  console.log('\n🎨 بذر إعدادات الهوية البصرية...');
  await db.collection('ops_branding').doc(branding.id).set(branding, { merge: true });
  console.log('  ✅ تم إنشاء: ops_branding/prod');
}

async function seedBillingPlans() {
  console.log('\n💳 بذر خطط الفوترة...');
  for (const plan of billingPlans) {
    await db.collection('ops_billing_plans').doc(plan.id).set(plan, { merge: true });
    console.log(`  ✅ تم إنشاء خطة: ${plan.title} (${plan.titleEn})`);
  }
}

async function seedMarketplace() {
  console.log('\n🏪 بذر عناصر المتجر المجانية...');
  for (const item of marketplaceItems) {
    await db.collection('ops_marketplace_items').doc(item.id).set(item, { merge: true });
    console.log(`  ✅ تم إنشاء: ${item.title} (${item.titleEn})`);
  }
}

async function seedPaidMarketplace() {
  console.log('\n💎 بذر عناصر المتجر المدفوعة...');
  for (const item of paidMarketplaceItems) {
    await db.collection('ops_marketplace_paid').doc(item.id).set(item, { merge: true });
    console.log(`  ✅ تم إنشاء: ${item.title} (${item.titleEn})`);
  }
}

async function seedSystemSettings() {
  console.log('\n⚙️  بذر إعدادات النظام...');
  await db.collection('ops_system_settings').doc(systemSettings.id).set(systemSettings, { merge: true });
  console.log('  ✅ تم إنشاء: ops_system_settings/global');
}

async function main() {
  try {
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║   🌱 بذر البيانات الشامل - From Zero   ║');
    console.log('╚═══════════════════════════════════════════╝');

    await seedBranding();
    await seedBillingPlans();
    await seedMarketplace();
    await seedPaidMarketplace();
    await seedSystemSettings();

    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║   ✅ تم بذر جميع البيانات بنجاح!        ║');
    console.log('╚═══════════════════════════════════════════╝');

    console.log('\n📋 ملخص البيانات المضافة:');
    console.log('  • ops_branding: 1 مستند');
    console.log('  • ops_billing_plans: 3 خطط');
    console.log('  • ops_marketplace_items: 3 عناصر');
    console.log('  • ops_marketplace_paid: 2 عناصر');
    console.log('  • ops_system_settings: 1 مستند');

    console.log('\n⚠️  هام: تحديث Stripe Price IDs');
    console.log('═══════════════════════════════════════');
    console.log('1. افتح Stripe Dashboard');
    console.log('2. أنشئ Products و Price IDs للخطط');
    console.log('3. حدّث حقول stripePriceId في:');
    console.log('   ops_billing_plans/starter');
    console.log('   ops_billing_plans/pro');
    console.log('\n4. أو استخدم متغيرات البيئة:');
    console.log('   export STRIPE_PRICE_STARTER=price_xxx');
    console.log('   export STRIPE_PRICE_PRO=price_yyy');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ خطأ في بذر البيانات:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
