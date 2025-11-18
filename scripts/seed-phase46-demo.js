#!/usr/bin/env node
/**
 * Seeds sample usage & invoice docs for a demo user
 * Phase 46: Usage Metering & Invoices
 */

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// Initialize Firebase Admin
initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function seedPhase46Demo() {
  const uid = process.env.DEMO_UID || 'demo-user-uid';

  console.log('🌱 Seeding Phase 46 demo data...');
  console.log(`   User ID: ${uid}`);

  // Get today's date
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  // Seed daily usage
  console.log('\n📊 Creating daily usage record...');
  await db
    .doc(`ops_usage_daily/${uid}_${today}`)
    .set(
      {
        uid,
        date: today,
        tokens: 3210,
        requests: 12,
        costUsd: 0.0023,
        planAtUse: 'starter',
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  console.log(`   ✅ Created: ops_usage_daily/${uid}_${today}`);

  // Seed monthly usage
  console.log('\n📈 Creating monthly usage record...');
  await db
    .doc(`ops_usage_monthly/${uid}_${month}`)
    .set(
      {
        uid,
        month,
        tokens: 45670,
        requests: 234,
        costUsd: 0.0456,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  console.log(`   ✅ Created: ops_usage_monthly/${uid}_${month}`);

  // Seed sample invoices
  console.log('\n🧾 Creating sample invoices...');

  const now = Math.floor(Date.now() / 1000);
  const invoices = [
    {
      id: 'inv_demo_1',
      uid,
      number: 'INV-0001',
      created: now - 86400 * 30, // 30 days ago
      total: 990,
      subtotal: 990,
      tax: 0,
      currency: 'usd',
      status: 'paid',
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/demo1',
      invoicePdf: 'https://invoice.stripe.com/i/demo1/pdf',
    },
    {
      id: 'inv_demo_2',
      uid,
      number: 'INV-0002',
      created: now - 86400 * 60, // 60 days ago
      total: 990,
      subtotal: 990,
      tax: 0,
      currency: 'usd',
      status: 'paid',
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/demo2',
      invoicePdf: 'https://invoice.stripe.com/i/demo2/pdf',
    },
    {
      id: 'inv_demo_3',
      uid,
      number: 'INV-0003',
      created: now - 86400 * 90, // 90 days ago
      total: 990,
      subtotal: 990,
      tax: 0,
      currency: 'usd',
      status: 'paid',
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/demo3',
      invoicePdf: 'https://invoice.stripe.com/i/demo3/pdf',
    },
  ];

  for (const invoice of invoices) {
    await db.doc(`ops_invoices/${invoice.id}`).set(invoice);
    console.log(`   ✅ Created: ops_invoices/${invoice.id} (#${invoice.number})`);
  }

  // Seed user plan if it doesn't exist
  console.log('\n👤 Checking user plan...');
  const planRef = db.doc(`ops_user_plans/${uid}`);
  const planDoc = await planRef.get();

  if (!planDoc.exists) {
    console.log('   Creating demo user plan...');
    await planRef.set({
      plan: 'starter',
      status: 'active',
      dailyQuota: 10000,
      monthlyQuota: 300000,
      entitlements: [],
      limits: {
        marketplacePaid: false,
      },
      updatedAt: Timestamp.now(),
    });
    console.log('   ✅ Created: ops_user_plans/${uid}');
  } else {
    console.log('   ℹ️  User plan already exists');
  }

  console.log('\n✅ Phase 46 demo data seeded successfully!');
  console.log('\n📝 Summary:');
  console.log(`   - Daily usage: ${uid}_${today}`);
  console.log(`   - Monthly usage: ${uid}_${month}`);
  console.log(`   - Invoices: ${invoices.length} records`);
  console.log('\n🔗 Test the functions:');
  console.log('   1. Call recordUsage({ tokens: 100, requests: 1 })');
  console.log('   2. Call listInvoices() to see invoice history');
  console.log('   3. Query ops_usage_daily collection for usage data');
}

// Run the seeding
seedPhase46Demo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Error seeding data:', err);
    process.exit(1);
  });
