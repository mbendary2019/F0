#!/usr/bin/env node

/**
 * Phase 45 - Seed Billing Plans Data
 * Run with: node scripts/seed-phase45.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const plans = [
  {
    id: 'trial',
    title: 'Trial',
    price: 0,
    interval: 'month',
    stripePriceId: '',
    limits: {
      dailyQuota: 500,
      marketplacePaid: false,
    },
    entitlements: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'starter',
    title: 'Starter',
    price: 9,
    interval: 'month',
    stripePriceId: process.env.STRIPE_PRICE_STARTER || 'price_starter_changeme',
    limits: {
      dailyQuota: 5000,
      marketplacePaid: false,
    },
    entitlements: ['priority_support'],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'pro',
    title: 'Pro',
    price: 29,
    interval: 'month',
    stripePriceId: process.env.STRIPE_PRICE_PRO || 'price_pro_changeme',
    limits: {
      dailyQuota: 50000,
      marketplacePaid: true,
    },
    entitlements: [
      'priority_support',
      'marketplace_paid',
      'advanced_analytics',
      'custom_branding',
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

const paidMarketplaceItems = [
  {
    id: 'analytics-pro',
    title: 'Analytics Pro',
    description: 'Advanced analytics dashboard with custom reports',
    category: 'analytics',
    price: 0,
    requiresPaid: true,
    entitlement: 'advanced_analytics',
    icon: '📊',
    verified: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'custom-branding-pack',
    title: 'Custom Branding Pack',
    description: 'White-label your instance with custom branding',
    category: 'branding',
    price: 0,
    requiresPaid: true,
    entitlement: 'custom_branding',
    icon: '🎨',
    verified: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

async function seedPlans() {
  console.log('🌱 Seeding billing plans...');

  for (const plan of plans) {
    await db.collection('ops_billing_plans').doc(plan.id).set(plan, { merge: true });
    console.log(`  ✅ Created plan: ${plan.title}`);
  }

  console.log('✅ Plans seeded successfully');
}

async function seedMarketplaceItems() {
  console.log('🌱 Seeding paid marketplace items...');

  for (const item of paidMarketplaceItems) {
    await db.collection('ops_marketplace_paid').doc(item.id).set(item, { merge: true });
    console.log(`  ✅ Created paid item: ${item.title}`);
  }

  console.log('✅ Paid marketplace items seeded successfully');
}

async function main() {
  try {
    console.log('🚀 Phase 45 Data Seeding');
    console.log('========================\n');

    await seedPlans();
    console.log('');
    await seedMarketplaceItems();

    console.log('');
    console.log('✅ All Phase 45 data seeded successfully!');
    console.log('');
    console.log('⚠️  Important: Update Stripe Price IDs in Firebase Console:');
    console.log('   Collection: ops_billing_plans');
    console.log('   Update stripePriceId fields with your actual Stripe price IDs');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

main();
