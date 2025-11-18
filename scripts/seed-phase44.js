#!/usr/bin/env node
/**
 * Seed Phase 44 data to Firestore
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

async function seed() {
  console.log('🌱 Seeding Phase 44 data...\n');

  try {
    // 1. Branding preset
    console.log('1️⃣ Creating branding preset...');
    await db.collection('ops_branding').doc('prod').set({
      primaryColor: '#7C3AED',
      accentColor: '#22D3EE',
      logoUrl: '/logo.svg',
      mascot: {
        name: 'F0 Spark',
        mood: 'friendly',
        svgUrl: '/mascots/example-mascot.svg',
      },
      routes: [
        { path: '/dashboard', label: 'Dashboard', visible: true },
        { path: '/ops/marketplace', label: 'Marketplace', visible: true },
        { path: '/ops/branding', label: 'Branding', visible: true },
        { path: '/ops/assets', label: 'Assets', visible: true },
        { path: '/ops/mesh', label: 'Mesh', visible: true },
      ],
    });
    console.log('   ✅ Branding preset created\n');

    // 2. Marketplace items
    console.log('2️⃣ Creating marketplace items...');

    await db.collection('ops_marketplace_items').doc('branding-pack').set({
      title: 'Branding Quick Start',
      category: 'branding',
      brief: 'Preset colors, routes, and a mascot for instant brand identity',
      installScript: 'applyBrandingPreset:v1',
      docsUrl: 'https://docs.example.com/branding-pack',
      verified: true,
    });
    console.log('   ✅ Created: Branding Quick Start');

    await db.collection('ops_marketplace_items').doc('analytics-pro').set({
      title: 'Analytics Pro',
      category: 'analytics',
      brief: 'Advanced metrics dashboard with real-time charts',
      installScript: 'enableAnalyticsPro:v1',
      docsUrl: 'https://docs.example.com/analytics-pro',
      verified: true,
    });
    console.log('   ✅ Created: Analytics Pro');

    await db.collection('ops_marketplace_items').doc('dark-mode').set({
      title: 'Dark Mode Theme',
      category: 'ui',
      brief: 'Beautiful dark theme with customizable accent colors',
      installScript: 'applyDarkTheme:v1',
      docsUrl: 'https://docs.example.com/dark-mode',
      verified: false,
    });
    console.log('   ✅ Created: Dark Mode Theme\n');

    console.log('✅ Phase 44 data seeded successfully!\n');
    console.log('📋 Created:');
    console.log('   - Branding preset (ops_branding/prod)');
    console.log('   - 3 marketplace items:');
    console.log('     • Branding Quick Start ✓');
    console.log('     • Analytics Pro ✓');
    console.log('     • Dark Mode Theme\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seed();
