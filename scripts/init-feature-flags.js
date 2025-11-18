#!/usr/bin/env node

/**
 * Initialize Feature Flags & App Config
 *
 * This script creates the required config documents in Firestore
 * for F0 (Full Production) mode with canary settings.
 *
 * Usage:
 *   node scripts/init-feature-flags.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function initFeatureFlags() {
  console.log('🚀 Initializing Feature Flags & App Config...\n');

  // 1) Feature Flags (Canary Start: 10% AI Eval)
  const featureFlags = {
    invoices: { enabled: true },
    taxes: { enabled: true },
    fx: { enabled: true },
    region_pricing: { enabled: true },
    pricing_overrides: { enabled: true },
    bundles: { enabled: true },
    marketplace: { enabled: true },
    connect: { enabled: true, platform_fee_pct: 15 },
    coupons: { enabled: true },
    reviews: { enabled: true, spam_guard: true, img_mod_required: false },
    search: { algolia: true, fallback: true },
    ai_eval: { enabled: true, sampleRate: 0.10 },  // Canary: 10%
    hitl: { enabled: true },
    policies: { enabled: true },
    alerts: { slack: true },
    analytics: { advanced: true, funnels: true },
    statements: { customer: true, creator: true },
    payouts: { enabled: true },
    accounting: { enabled: true },
    updatedAt: Date.now(),
    updatedBy: 'init-script'
  };

  console.log('📋 Feature Flags:');
  console.log(JSON.stringify(featureFlags, null, 2));

  await db.collection('config').doc('feature_flags').set(featureFlags, { merge: true });
  console.log('✅ config/feature_flags created\n');

  // 2) App Config
  const appConfig = {
    mode: 'F0',
    allowSignup: true,
    showMarketplace: true,
    defaultCurrency: 'USD',
    updatedAt: Date.now(),
    updatedBy: 'init-script'
  };

  console.log('⚙️  App Config:');
  console.log(JSON.stringify(appConfig, null, 2));

  await db.collection('config').doc('app').set(appConfig, { merge: true });
  console.log('✅ config/app created\n');

  console.log('🎯 Next Steps:');
  console.log('1. Deploy Firestore rules: firebase deploy --only firestore:rules');
  console.log('2. Monitor for 24 hours with canary settings (10% AI eval)');
  console.log('3. Gradually increase ai_eval.sampleRate: 0.10 → 0.5 → 1.0');
  console.log('4. Enable img_mod_required if needed: reviews.img_mod_required = true');
  console.log('\n📊 Monitoring:');
  console.log('- Auto-invoice success rate > 99%');
  console.log('- FX rates updating hourly');
  console.log('- Bundles issuing licenses correctly');
  console.log('- Cloud Logging filters (see GO_LIVE_SPRINT_19.md)');
  console.log('\n🧯 Emergency Kill-Switch:');
  console.log('- Disable auto-invoice: Update invoices.enabled = false');
  console.log('- Disable region pricing: Update region_pricing.enabled = false');
  console.log('\n🟢 Status: F0 Activated (Canary Mode)');
}

// Run
initFeatureFlags()
  .then(() => {
    console.log('\n✅ Initialization complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
