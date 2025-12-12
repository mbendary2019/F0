// scripts/seed-marketplace.ts
// Phase 98.1: Seed marketplace apps to Firestore

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { MarketplaceApp } from '../src/types/marketplace';

// Initialize Firebase Admin
if (!getApps().length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  if (serviceAccountPath) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceAccount = require(serviceAccountPath);
    initializeApp({
      credential: cert(serviceAccount),
      projectId: 'from-zero-84253',
    });
  } else {
    initializeApp({
      projectId: 'from-zero-84253',
    });
  }
}

const db = getFirestore();

// Sample marketplace apps
const MARKETPLACE_APPS: Omit<MarketplaceApp, 'createdAt' | 'updatedAt'>[] = [
  {
    slug: 'crypto-trading-platform',
    title: 'Crypto Trading Platform',
    titleAr: 'منصة تداول كريبتو',
    shortDescription: 'Full-featured crypto trading platform with real-time charts, order management, and wallet integration.',
    shortDescriptionAr: 'منصة تداول كريبتو متكاملة مع رسوم بيانية مباشرة، إدارة أوامر، وتكامل محفظة.',
    heroTagline: '⚡ Build Your Own Binance',
    heroTaglineAr: '⚡ ابنِ منصتك مثل Binance',
    category: 'crypto',
    platforms: ['web', 'mobile'],
    techStack: ['Next.js', 'WebSocket', 'TradingView', 'PostgreSQL'],
    estimatedMvpDays: 14,
    difficulty: 'pro',
    status: 'live',
    icon: '📈',
    featured: true,
    order: 1,
  },
  {
    slug: 'ai-agent-saas',
    title: 'AI Agent SaaS',
    titleAr: 'منصة وكيل ذكي SaaS',
    shortDescription: 'Create and deploy AI agents with custom knowledge bases, chat interfaces, and API access.',
    shortDescriptionAr: 'أنشئ ونشر وكلاء ذكاء اصطناعي مع قواعد معرفة مخصصة، واجهات دردشة، ووصول API.',
    heroTagline: '🧠 Your Own ChatGPT Platform',
    heroTaglineAr: '🧠 منصتك الخاصة مثل ChatGPT',
    category: 'ai',
    platforms: ['web', 'api'],
    techStack: ['Next.js', 'OpenAI', 'Pinecone', 'Supabase'],
    estimatedMvpDays: 10,
    difficulty: 'intermediate',
    status: 'live',
    icon: '🤖',
    featured: true,
    order: 2,
  },
  {
    slug: 'local-marketplace',
    title: 'Local Marketplace App',
    titleAr: 'تطبيق سوق محلي',
    shortDescription: 'Multi-vendor marketplace for local businesses with delivery tracking and payment processing.',
    shortDescriptionAr: 'سوق متعدد البائعين للأعمال المحلية مع تتبع التوصيل ومعالجة الدفع.',
    heroTagline: '🛒 Build the Next OLX',
    heroTaglineAr: '🛒 ابنِ السوق القادم',
    category: 'ecommerce',
    platforms: ['web', 'mobile'],
    techStack: ['Next.js', 'Stripe', 'Google Maps', 'Firebase'],
    estimatedMvpDays: 12,
    difficulty: 'intermediate',
    status: 'live',
    icon: '🏪',
    featured: true,
    order: 3,
  },
  {
    slug: 'delivery-logistics',
    title: 'Delivery & Logistics Platform',
    titleAr: 'منصة توصيل ولوجستيات',
    shortDescription: 'Complete delivery management with driver apps, route optimization, and real-time tracking.',
    shortDescriptionAr: 'إدارة توصيل كاملة مع تطبيقات للسائقين، تحسين المسارات، وتتبع مباشر.',
    heroTagline: '🚚 Your Own Uber Eats Backend',
    heroTaglineAr: '🚚 باك إند توصيل خاص بك',
    category: 'logistics',
    platforms: ['web', 'mobile', 'api'],
    techStack: ['Next.js', 'React Native', 'Google Maps', 'Redis'],
    estimatedMvpDays: 18,
    difficulty: 'pro',
    status: 'live',
    icon: '📦',
    order: 4,
  },
  {
    slug: 'fintech-wallet',
    title: 'Digital Wallet App',
    titleAr: 'تطبيق محفظة رقمية',
    shortDescription: 'Mobile-first digital wallet with P2P transfers, bill payments, and merchant integration.',
    shortDescriptionAr: 'محفظة رقمية للموبايل مع تحويلات P2P، دفع فواتير، وتكامل التجار.',
    heroTagline: '💳 Build a PayPal Alternative',
    heroTaglineAr: '💳 بديل PayPal خاص بك',
    category: 'fintech',
    platforms: ['mobile', 'api'],
    techStack: ['React Native', 'Plaid', 'Stripe', 'PostgreSQL'],
    estimatedMvpDays: 16,
    difficulty: 'pro',
    status: 'coming_soon',
    icon: '💰',
    order: 5,
  },
  {
    slug: 'social-community',
    title: 'Community Platform',
    titleAr: 'منصة مجتمع',
    shortDescription: 'Build engaging communities with forums, events, direct messaging, and content sharing.',
    shortDescriptionAr: 'ابنِ مجتمعات تفاعلية مع منتديات، أحداث، رسائل مباشرة، ومشاركة محتوى.',
    heroTagline: '👥 Your Own Discord/Slack',
    heroTaglineAr: '👥 منصتك مثل Discord',
    category: 'social',
    platforms: ['web', 'mobile'],
    techStack: ['Next.js', 'Socket.io', 'PostgreSQL', 'Redis'],
    estimatedMvpDays: 14,
    difficulty: 'intermediate',
    status: 'live',
    icon: '💬',
    order: 6,
  },
  {
    slug: 'healthcare-telemedicine',
    title: 'Telemedicine Platform',
    titleAr: 'منصة طب عن بُعد',
    shortDescription: 'HIPAA-ready telemedicine with video consultations, prescriptions, and patient records.',
    shortDescriptionAr: 'طب عن بُعد متوافق مع HIPAA مع استشارات فيديو، وصفات، وسجلات مرضى.',
    heroTagline: '🏥 Launch Your Health Startup',
    heroTaglineAr: '🏥 أطلق شركتك الصحية',
    category: 'healthcare',
    platforms: ['web', 'mobile'],
    techStack: ['Next.js', 'Twilio', 'PostgreSQL', 'AWS'],
    estimatedMvpDays: 20,
    difficulty: 'pro',
    status: 'coming_soon',
    icon: '⚕️',
    order: 7,
  },
  {
    slug: 'online-learning',
    title: 'Online Learning Platform',
    titleAr: 'منصة تعليم أونلاين',
    shortDescription: 'LMS with video courses, quizzes, certificates, and instructor dashboards.',
    shortDescriptionAr: 'نظام إدارة تعلم مع دورات فيديو، اختبارات، شهادات، ولوحات للمدرسين.',
    heroTagline: '📚 Build Your Udemy',
    heroTaglineAr: '📚 ابنِ منصتك التعليمية',
    category: 'education',
    platforms: ['web'],
    techStack: ['Next.js', 'Mux', 'Stripe', 'PostgreSQL'],
    estimatedMvpDays: 12,
    difficulty: 'intermediate',
    status: 'live',
    icon: '🎓',
    order: 8,
  },
  {
    slug: 'subscription-box',
    title: 'Subscription Box Service',
    titleAr: 'خدمة صناديق اشتراك',
    shortDescription: 'Manage subscription boxes with recurring billing, inventory, and shipping integration.',
    shortDescriptionAr: 'إدارة صناديق اشتراك مع فواتير متكررة، مخزون، وتكامل شحن.',
    heroTagline: '📦 Launch Your Box Business',
    heroTaglineAr: '📦 أطلق مشروع الصناديق',
    category: 'ecommerce',
    platforms: ['web'],
    techStack: ['Next.js', 'Stripe', 'ShipStation', 'PostgreSQL'],
    estimatedMvpDays: 10,
    difficulty: 'beginner',
    status: 'live',
    icon: '🎁',
    order: 9,
  },
  {
    slug: 'nft-marketplace',
    title: 'NFT Marketplace',
    titleAr: 'سوق NFT',
    shortDescription: 'Create, buy, and sell NFTs with wallet integration and smart contract deployment.',
    shortDescriptionAr: 'أنشئ، اشترِ، وبِع NFTs مع تكامل المحفظة ونشر العقود الذكية.',
    heroTagline: '🖼️ Your Own OpenSea',
    heroTaglineAr: '🖼️ سوقك للـ NFT',
    category: 'crypto',
    platforms: ['web'],
    techStack: ['Next.js', 'Solidity', 'IPFS', 'ethers.js'],
    estimatedMvpDays: 14,
    difficulty: 'pro',
    status: 'beta',
    icon: '🎨',
    order: 10,
  },
];

async function seedMarketplace() {
  console.log('🚀 Seeding marketplace apps...\n');

  const collection = db.collection('ops_marketplace_apps');
  const now = Timestamp.now();

  for (const app of MARKETPLACE_APPS) {
    const docRef = collection.doc(app.slug);

    await docRef.set({
      ...app,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`✅ ${app.icon} ${app.title} (${app.slug})`);
  }

  console.log(`\n🎉 Seeded ${MARKETPLACE_APPS.length} marketplace apps!`);
}

seedMarketplace()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error seeding marketplace:', err);
    process.exit(1);
  });
