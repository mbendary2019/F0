/**
 * Seed Paid Marketplace Items
 * Creates sample paid items requiring entitlements
 */

const admin = require('firebase-admin');

// Initialize if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const paidItems = [
  {
    id: 'analytics-pro',
    title: 'Advanced Analytics Pack',
    description: 'Real-time analytics, custom dashboards, and data export features',
    category: 'analytics',
    requiresPaid: true,
    entitlement: 'advanced_analytics', // from Pro plan
    price: 0, // included in subscription
    icon: '📊',
    verified: true,
  },
  {
    id: 'custom-branding',
    title: 'Custom Branding Suite',
    description: 'White-label your platform with custom logos, colors, and domain',
    category: 'branding',
    requiresPaid: true,
    entitlement: 'custom_branding', // from Pro plan
    price: 0,
    icon: '🎨',
    verified: true,
  },
  {
    id: 'priority-support',
    title: 'Priority Support Access',
    description: '24/7 priority support with dedicated account manager',
    category: 'support',
    requiresPaid: true,
    entitlement: 'priority_support', // from Starter & Pro plans
    price: 0,
    icon: '🆘',
    verified: true,
  },
  {
    id: 'api-unlimited',
    title: 'Unlimited API Access',
    description: 'Remove rate limits and get unlimited API calls',
    category: 'api',
    requiresPaid: true,
    entitlement: 'advanced_analytics', // Pro only
    price: 0,
    icon: '🚀',
    verified: true,
  },
  {
    id: 'export-tools',
    title: 'Data Export Tools',
    description: 'Export your data in multiple formats (CSV, JSON, Excel)',
    category: 'tools',
    requiresPaid: true,
    entitlement: 'advanced_analytics', // Pro only
    price: 0,
    icon: '📤',
    verified: true,
  },
];

async function seedPaidMarketplace() {
  console.log('🌱 Seeding paid marketplace items...\n');

  let created = 0;
  let updated = 0;

  for (const item of paidItems) {
    try {
      const docRef = db.collection('ops_marketplace_paid').doc(item.id);
      const doc = await docRef.get();

      const data = {
        ...item,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (!doc.exists) {
        data.createdAt = admin.firestore.FieldValue.serverTimestamp();
        await docRef.set(data);
        console.log(`✅ Created: ${item.title} (${item.id})`);
        created++;
      } else {
        await docRef.set(data, { merge: true });
        console.log(`📝 Updated: ${item.title} (${item.id})`);
        updated++;
      }
    } catch (error) {
      console.error(`❌ Error with ${item.id}:`, error.message);
    }
  }

  console.log(`\n✨ Seeding complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total: ${paidItems.length}`);
}

// Run the seed function
seedPaidMarketplace()
  .then(() => {
    console.log('\n🎉 Done! Check Firestore console:');
    console.log('   https://console.firebase.google.com/project/from-zero-84253/firestore/data/ops_marketplace_paid');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  });
